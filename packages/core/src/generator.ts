import ts from 'typescript'
import type { CommentToken, MustacheToken, TagToken, Token } from 'edge-lexer/types'
import { GLOBALS_TS } from './globals.ts'
import { LineIndex } from './offsets.ts'
import { tokenize } from './tokenize.ts'
import { findTypesBlock, findTypesTag } from './types-block.ts'
import { collectStateIdents } from './used-idents.ts'
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
  // The tag form (`@types ... @end`) wins deterministically when both forms
  // are present in the same template — the comment form is never consulted.
  const typesBlock =
    findTypesTag(tokens, lines) ??
    findTypesBlock(
      tokens.filter((t): t is CommentToken => t.type === 'comment'),
      lines,
    )

  const ctx: Ctx = {
    // export {} makes the virtual file a module: without it, tsserver treats
    // every template's virtual TS as a script sharing ONE global scope, so
    // `const user` from two templates collide (and DOM's `declare var name`
    // shadows props named `name`).
    code: 'export {}\n' + GLOBALS_TS + CROSS_FILE_TS + '\n',
    segments: [],
    lines,
    resolveTemplate: opts?.resolveTemplate,
  }

  if (typesBlock) {
    emit(ctx, 'type __Types = ')
    if (typesBlock.lines) {
      // Tag block form: each body line is emitted as its own verbatim
      // segment (real per-line source offsets) rather than one span covering
      // the reconstructed `raw` string, which isn't a contiguous slice of
      // the source once lines are rejoined.
      emit(ctx, '{\n')
      for (const line of typesBlock.lines) {
        emitVerbatim(ctx, line.text, line.sourceOffset)
        emit(ctx, '\n')
      }
      emit(ctx, '}')
    } else {
      emitVerbatim(ctx, typesBlock.raw, typesBlock.sourceOffset)
    }
    emit(ctx, '\ndeclare const state: __Types\n')
    // Wrapped in an async IIFE (rather than left at module top level) so
    // `{{ await expr }}` is syntactically legal; narrowing across @if is
    // unaffected since TS control-flow analysis works the same inside a
    // function body as at module scope. The prop destructure lives inside
    // it too (not at module scope) so a prop named e.g. `truncate` shadows
    // the ambient Edge global of the same name instead of colliding with
    // its `declare const` in a TS2451 redeclare error.
    emit(ctx, ';(async () => {\n')
    if (typesBlock.literal) {
      if (typesBlock.propertyNames.length > 0) {
        emit(ctx, `const { ${typesBlock.propertyNames.join(', ')} } = state\n`)
      }
    } else {
      // Imported type expression: prop names aren't statically knowable, so
      // destructure the identifiers the template actually uses, each mapped
      // to its first usage — a nonexistent prop then errors where it's used.
      const used = collectStateIdents(tokens, lines)
      if (used.size > 0) {
        emit(ctx, 'const { ')
        let first = true
        for (const [name, usageOffset] of used) {
          if (!first) emit(ctx, ', ')
          emitVerbatim(ctx, name, usageOffset)
          first = false
        }
        emit(ctx, ' } = state\n')
      }
    }
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

  // Static-only construct already consumed via findTypesTag above — never
  // markup, never a checkable jsArg, never walked as a child scope.
  if (name === 'types') {
    return index
  }
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

  // Supercharged component tag (AdonisJS `components/` dir convention, e.g.
  // `@modal(...)` for components/modal/index.edge, `@checkoutForm.input(...)`
  // for components/checkout_form/input.edge). Unresolved or no `@types` block
  // falls through to the generic unknown-tag handling below.
  if (emitSuperchargedComponent(ctx, token)) {
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
  const typesBlock =
    findTypesTag(resolvedTokens, resolvedLines) ??
    findTypesBlock(
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
        const propsArg = parsed.args[1]
        if (propsArg) {
          const start = propsArg.getStart(parsed.sourceFile) - parsed.prefixLength
          const end = propsArg.getEnd() - parsed.prefixLength
          emitComponentCall(ctx, componentTypes, jsArg.slice(start, end), base + start)
        } else {
          emitComponentCall(ctx, componentTypes, null, base)
        }
      }
    }
  }
  emitComponentBody(ctx, token)
}

/** Emits `__component<Types>(propsExpr)`, or `__component<Types>({})` when `propsText` is null. */
function emitComponentCall(ctx: Ctx, componentTypes: { raw: string }, propsText: string | null, propsOffset: number): void {
  emit(ctx, '__component<')
  emit(ctx, componentTypes.raw)
  emit(ctx, '>(')
  if (propsText !== null) {
    emitVerbatim(ctx, propsText, propsOffset)
  } else {
    emit(ctx, '{}')
  }
  emit(ctx, ');\n')
}

/**
 * AdonisJS "supercharged" components: any unrecognized tag name is checked
 * against the `components/` directory convention (see edge.js
 * `src/loader.ts#getDiskComponents` and `src/plugins/supercharged.ts`).
 * `form/input.edge` -> `@form.input`, `tool_tip.edge` -> `@toolTip`,
 * `modal/index.edge` -> `@modal` (index elided). The reverse mapping is
 * lossy (camelCase -> snake_case isn't invertible in general), so this
 * probes candidate template names and takes the first that resolves.
 * Disk-prefixed tags (`@!uikit.input`) aren't supported — they stay unchecked.
 * The whole jsArg is the props object directly (supercharged rewrites the tag
 * to `@component('<path>', <jsArg>)`, dropping the path argument from the
 * source), so it's checked the same way as `@component`'s second argument.
 */
function emitSuperchargedComponent(ctx: Ctx, token: TagToken): boolean {
  const { name, jsArg } = token.properties
  for (const candidate of superchargedCandidates(name)) {
    const componentTypes = resolveTypesBlock(ctx, candidate)
    if (!componentTypes) continue
    const base = tagOffset(ctx, token)
    emitComponentCall(ctx, componentTypes, jsArg.trim() === '' ? null : jsArg, base)
    emitComponentBody(ctx, token)
    return true
  }
  return false
}

/** `checkoutForm.input` -> `['components/checkout_form/input', 'components/checkout_form/input/index']`. */
function superchargedCandidates(tagName: string): string[] {
  const path = tagName
    .split('.')
    .map((segment) => segment.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`))
    .join('/')
  return [`components/${path}`, `components/${path}/index`]
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
