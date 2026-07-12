import ts from 'typescript'
import type { CommentToken, MustacheToken, TagToken, Token } from 'edge-lexer/types'
import { GLOBALS_TS } from './globals.ts'
import { LineIndex } from './offsets.ts'
import { tokenize } from './tokenize.ts'
import { findTypesBlock } from './types-block.ts'
import type { GenerateOptions, Segment, VirtualFile } from './index.ts'

/** Glue for cross-file checks: `declare function __component<T>(props: T): void` etc. */
const CROSS_FILE_TS = `
declare function __component<T>(props: T): void
declare function __include<T>(state: T): void
`

interface Ctx {
  code: string
  segments: Segment[]
  lines: LineIndex
  resolveTemplate?: GenerateOptions['resolveTemplate']
}

/** Tokenizes, retrying without the unknown-tag-as-block guess if that guess causes an unclosed-tag failure. */
function safeTokenize(source: string, filename: string): Token[] {
  try {
    return tokenize(source, filename)
  } catch {
    return tokenize(source, filename, { claimUnknownTags: false })
  }
}

export function generateVirtualTs(source: string, filename: string, opts?: GenerateOptions): VirtualFile {
  const lines = new LineIndex(source)
  const tokens = safeTokenize(source, filename)
  const typesBlock = findTypesBlock(
    tokens.filter((t): t is CommentToken => t.type === 'comment'),
    lines,
  )

  const ctx: Ctx = {
    code: GLOBALS_TS + CROSS_FILE_TS + '\n',
    segments: [],
    lines,
    resolveTemplate: opts?.resolveTemplate,
  }

  if (typesBlock) {
    emit(ctx, 'type __Types = ')
    emitVerbatim(ctx, typesBlock.raw, typesBlock.sourceOffset)
    emit(ctx, '\ndeclare const state: __Types\n')
    if (typesBlock.propertyNames.length > 0) {
      emit(ctx, `const { ${typesBlock.propertyNames.join(', ')} } = state\n`)
    }
    // Wrapped in an async IIFE (rather than left at module top level) so
    // `{{ await expr }}` is syntactically legal; narrowing across @if is
    // unaffected since TS control-flow analysis works the same inside a
    // function body as at module scope.
    emit(ctx, ';(async () => {\n')
    emitTokens(ctx, tokens)
    emit(ctx, '})();\n')
  } else {
    emit(ctx, 'declare const state: any\n')
  }

  return {
    code: ctx.code,
    segments: ctx.segments.sort((a, b) => a.sourceOffset - b.sourceOffset),
    typesBlock: typesBlock ? { raw: typesBlock.raw, sourceOffset: typesBlock.sourceOffset } : null,
  }
}

function emit(ctx: Ctx, text: string): void {
  ctx.code += text
}

/** Appends `text` verbatim, recording a segment mapping it back to `sourceOffset`. */
function emitVerbatim(ctx: Ctx, text: string, sourceOffset: number): void {
  ctx.segments.push({ sourceOffset, generatedOffset: ctx.code.length, length: text.length })
  ctx.code += text
}

function tagOffset(ctx: Ctx, tag: TagToken): number {
  return ctx.lines.toOffset(tag.loc.start.line, tag.loc.start.col)
}

function mustacheOffset(ctx: Ctx, m: MustacheToken): number {
  return ctx.lines.toOffset(m.loc.start.line, m.loc.start.col)
}

function emitTokens(ctx: Ctx, tokens: Token[]): void {
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!
    if (token.type === 'comment' || token.type === 'raw' || token.type === 'newline') continue

    if (token.type === 'mustache' || token.type === 's__mustache') {
      const jsArg = token.properties.jsArg
      emit(ctx, ';(')
      emitVerbatim(ctx, jsArg, mustacheOffset(ctx, token))
      emit(ctx, ');\n')
      continue
    }
    // `@{{ ... }}` / `@{{{ ... }}}` — escaped mustaches render literally, never evaluated.
    if (token.type === 'e__mustache' || token.type === 'es__mustache') continue

    if (token.type === 'tag' || token.type === 'e__tag') {
      i = emitTag(ctx, tokens, i)
      continue
    }
  }
}

/** Emits one tag (and, for if/unless, any trailing elseif/else siblings). Returns the last consumed index. */
function emitTag(ctx: Ctx, tokens: Token[], index: number): number {
  const token = tokens[index] as TagToken
  const { name } = token.properties

  if (name === 'each') {
    emitEach(ctx, token)
    return index
  }
  if (name === 'let') {
    emitLet(ctx, token)
    return index
  }
  if (name === 'if' || name === 'unless') {
    return emitIfChain(ctx, tokens, index)
  }
  if (name === 'component') {
    emitComponent(ctx, token)
    return index
  }
  if (name === 'include') {
    emitInclude(ctx, token)
    return index
  }
  if (name === 'assign' || name === 'eval' || name === 'stack') {
    emitBareExpr(ctx, token)
    return index
  }
  if (name === 'newError') {
    emitNewError(ctx, token)
    return index
  }
  if (name === 'includeIf') {
    emitIncludeIf(ctx, token)
    return index
  }
  if (name === 'pushTo' || name === 'pushOnceTo') {
    emitBareExpr(ctx, token)
    if (token.children.length > 0) emitTokens(ctx, token.children)
    return index
  }

  // Anything else we don't have dedicated handling for — a built-in tag with
  // no checkable jsArg (@debugger, @inject) or an unrecognized/plugin tag
  // (@modal.foo, ...) claimed as a block by the tokenizer. Its body (if any)
  // still sees the enclosing scope so typos inside are caught; the jsArg
  // itself is left unchecked (dropped, never leaked).
  if (token.children.length > 0) {
    emitTokens(ctx, token.children)
  }
  return index
}

/** Parses a tag's `jsArg` (raw call-args text, e.g. `'path', { a: 1 }`) into TS argument nodes. */
function parseTagArgs(jsArg: string): { args: readonly ts.Expression[]; sourceFile: ts.SourceFile; prefixLength: number } | null {
  const prefix = '__f('
  const wrapper = `${prefix}${jsArg})`
  const sourceFile = ts.createSourceFile('__args.ts', wrapper, ts.ScriptTarget.Latest, true)
  const stmt = sourceFile.statements[0]
  if (!stmt || !ts.isExpressionStatement(stmt) || !ts.isCallExpression(stmt.expression)) return null
  return { args: stmt.expression.arguments, sourceFile, prefixLength: prefix.length }
}

/** Resolves a static string-literal template name to its parsed `@types` block, if any. */
function resolveTypesBlock(ctx: Ctx, name: string): { raw: string } | null {
  const resolved = ctx.resolveTemplate?.(name)
  if (!resolved) return null
  const resolvedLines = new LineIndex(resolved.source)
  const resolvedTokens = safeTokenize(resolved.source, resolved.filename)
  const typesBlock = findTypesBlock(
    resolvedTokens.filter((t): t is CommentToken => t.type === 'comment'),
    resolvedLines,
  )
  return typesBlock ? { raw: typesBlock.raw } : null
}

/**
 * `@component('path', { props })` — resolves the component's `@types` block and
 * type-checks the caller's props object against it, verbatim, so diagnostics land
 * at the caller's offsets. No resolver, unresolved name, dynamic name, or a
 * component with no `@types` block all degrade to unchecked (skip silently).
 * The component/slot BODIES are checked separately by `emitComponentBody`
 * regardless of whether the props themselves could be checked.
 */
function emitComponent(ctx: Ctx, token: TagToken): void {
  const jsArg = token.properties.jsArg
  const parsed = parseTagArgs(jsArg)
  if (parsed && parsed.args.length > 0) {
    const nameArg = parsed.args[0]!
    if (ts.isStringLiteralLike(nameArg)) {
      const componentTypes = resolveTypesBlock(ctx, nameArg.text)
      if (componentTypes) {
        const base = tagOffset(ctx, token)
        emit(ctx, '__component<')
        emit(ctx, componentTypes.raw)
        emit(ctx, '>(')

        const propsArg = parsed.args[1]
        if (propsArg) {
          const start = propsArg.getStart(parsed.sourceFile) - parsed.prefixLength
          const end = propsArg.getEnd() - parsed.prefixLength
          emitVerbatim(ctx, jsArg.slice(start, end), base + start)
        } else {
          emit(ctx, '{}')
        }
        emit(ctx, ');\n')
      }
    }
  }
  emitComponentBody(ctx, token)
}

/**
 * Component/slot bodies are closures over the caller's scope in Edge — they're
 * NOT compiled against the component's own state. Content outside `@slot(...)`
 * is the main slot; each `@slot('name', slotProps)` gets its own nested block
 * (with `slotProps` declared as `any`, since its shape isn't statically knowable
 * from the caller side) so a typo inside either surfaces a diagnostic at the
 * caller's offset, without leaking slot-only bindings into the main slot.
 */
function emitComponentBody(ctx: Ctx, token: TagToken): void {
  const mainChildren: Token[] = []
  const slots: TagToken[] = []
  for (const child of token.children) {
    if (child.type === 'tag' && child.properties.name === 'slot') {
      slots.push(child)
    } else {
      mainChildren.push(child)
    }
  }

  if (mainChildren.length > 0) {
    emit(ctx, '{\n')
    emitTokens(ctx, mainChildren)
    emit(ctx, '}\n')
  }
  for (const slot of slots) {
    emitSlot(ctx, slot)
  }
}

function emitSlot(ctx: Ctx, token: TagToken): void {
  const jsArg = token.properties.jsArg
  const parsed = parseTagArgs(jsArg)

  emit(ctx, '{\n')
  const propsArg = parsed && parsed.args.length > 1 ? parsed.args[1] : undefined
  if (parsed && propsArg && ts.isIdentifier(propsArg)) {
    const base = tagOffset(ctx, token)
    const start = propsArg.getStart(parsed.sourceFile) - parsed.prefixLength
    emit(ctx, 'let ')
    emitVerbatim(ctx, propsArg.text, base + start)
    emit(ctx, ': any\n')
  }
  emitTokens(ctx, token.children)
  emit(ctx, '}\n')
}

/**
 * `@include('path')` — the included template's own `@types` block (if any) must
 * be satisfiable from the caller's state. Checked as `__include<Included>(state)`;
 * since there's no caller expression to anchor to, a mismatch surfaces as an
 * unmapped diagnostic (start: null) rather than one pinned to the jsArg offset —
 * see generator.ts ponytail note. No resolver/unresolved/dynamic name/no @types
 * on the included template all degrade to unchecked.
 */
function emitInclude(ctx: Ctx, token: TagToken): void {
  const jsArg = token.properties.jsArg
  const parsed = parseTagArgs(jsArg)
  if (!parsed || parsed.args.length === 0) return
  const nameArg = parsed.args[0]!
  if (!ts.isStringLiteralLike(nameArg)) return

  const includedTypes = resolveTypesBlock(ctx, nameArg.text)
  if (!includedTypes) return

  // ponytail: unmapped (diagnostic.start === null) — see doc comment above.
  emit(ctx, `__include<${includedTypes.raw}>(state);\n`)
}

/** `@assign`, `@eval`, `@stack` — the whole jsArg is a checkable expression, copied verbatim. */
function emitBareExpr(ctx: Ctx, token: TagToken): void {
  const jsArg = token.properties.jsArg
  if (!jsArg) return
  emit(ctx, ';(')
  emitVerbatim(ctx, jsArg, tagOffset(ctx, token))
  emit(ctx, ');\n')
}

/** `@newError(message, filename?, line?, col?)` — only the message (1st arg) is a checkable expression. */
function emitNewError(ctx: Ctx, token: TagToken): void {
  const jsArg = token.properties.jsArg
  const parsed = parseTagArgs(jsArg)
  if (!parsed || parsed.args.length === 0) return
  const first = parsed.args[0]!
  const base = tagOffset(ctx, token)
  const start = first.getStart(parsed.sourceFile) - parsed.prefixLength
  const end = first.getEnd() - parsed.prefixLength
  emit(ctx, ';(')
  emitVerbatim(ctx, jsArg.slice(start, end), base + start)
  emit(ctx, ');\n')
}

/** `@includeIf(condition, 'path')` — checks the condition expression, and resolves the include like `@include`. */
function emitIncludeIf(ctx: Ctx, token: TagToken): void {
  const jsArg = token.properties.jsArg
  const parsed = parseTagArgs(jsArg)
  if (!parsed || parsed.args.length < 2) return
  const [condArg, includeArg] = parsed.args as [ts.Expression, ts.Expression]
  const base = tagOffset(ctx, token)

  const condStart = condArg.getStart(parsed.sourceFile) - parsed.prefixLength
  const condEnd = condArg.getEnd() - parsed.prefixLength
  emit(ctx, ';(')
  emitVerbatim(ctx, jsArg.slice(condStart, condEnd), base + condStart)
  emit(ctx, ');\n')

  if (!ts.isStringLiteralLike(includeArg)) return
  const includedTypes = resolveTypesBlock(ctx, includeArg.text)
  if (!includedTypes) return
  // ponytail: unmapped, same reasoning as @include.
  emit(ctx, `__include<${includedTypes.raw}>(state);\n`)
}

function emitEach(ctx: Ctx, token: TagToken): void {
  const jsArg = token.properties.jsArg
  const match = /^(.*?) in (.*)$/s.exec(jsArg)
  if (!match) return
  const [, binding, list] = match as unknown as [string, string, string]
  const listOffset = tagOffset(ctx, token) + jsArg.indexOf(list, binding.length)

  // `@else` inside `@each` renders when the list is empty — it's a sibling
  // block, not part of the loop body, so it doesn't see the loop variable(s).
  const elseIndex = token.children.findIndex((c) => c.type === 'tag' && c.properties.name === 'else')
  const bodyChildren = elseIndex > -1 ? token.children.slice(0, elseIndex) : token.children
  const elseChildren = elseIndex > -1 ? token.children.slice(elseIndex + 1) : []

  const withIndex = /^\s*\(\s*([\w$]+)\s*,\s*([\w$]+)\s*\)\s*$/.exec(binding)
  if (withIndex) {
    const [, item, idx] = withIndex as unknown as [string, string, string]
    emit(ctx, `for (const [${idx}, ${item}] of (`)
  } else {
    emit(ctx, `for (const ${binding.trim()} of (`)
  }
  emitVerbatim(ctx, list, listOffset)
  emit(ctx, withIndex ? ').entries()) {\n' : ')) {\n')
  emitTokens(ctx, bodyChildren)
  emit(ctx, '}\n')

  if (elseChildren.length > 0) {
    emit(ctx, '{\n')
    emitTokens(ctx, elseChildren)
    emit(ctx, '}\n')
  }
}

function emitLet(ctx: Ctx, token: TagToken): void {
  const jsArg = token.properties.jsArg
  const match = /^([^=]+?)=(?!=)(.*)$/s.exec(jsArg)
  if (!match) return
  const [, name, rhs] = match as unknown as [string, string, string]
  const rhsOffset = tagOffset(ctx, token) + jsArg.indexOf(rhs, name.length)

  emit(ctx, `let ${name.trim()} = (`)
  emitVerbatim(ctx, rhs, rhsOffset)
  emit(ctx, ');\n')
}

/** Consumes an if/unless tag plus any elseif/else siblings edge-lexer folds into its children. */
function emitIfChain(ctx: Ctx, tokens: Token[], index: number): number {
  const head = tokens[index] as TagToken
  const negate = head.properties.name === 'unless'

  emit(ctx, negate ? 'if (!(' : 'if (')
  emitVerbatim(ctx, head.properties.jsArg, tagOffset(ctx, head))
  emit(ctx, negate ? ')) {\n' : ') {\n')

  const children = head.children
  let branchStart = 0
  for (let i = 0; i < children.length; i++) {
    const child = children[i]!
    if (child.type === 'tag' && (child.properties.name === 'elseif' || child.properties.name === 'else')) {
      emitTokens(ctx, children.slice(branchStart, i))
      emit(ctx, '}\n')
      if (child.properties.name === 'elseif') {
        emit(ctx, 'if (')
        emitVerbatim(ctx, child.properties.jsArg, tagOffset(ctx, child))
        emit(ctx, ') {\n')
      } else {
        emit(ctx, 'else {\n')
      }
      branchStart = i + 1
    }
  }
  emitTokens(ctx, children.slice(branchStart))
  emit(ctx, '}\n')

  return index
}
