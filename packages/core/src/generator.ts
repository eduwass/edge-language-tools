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

export function generateVirtualTs(source: string, filename: string, opts?: GenerateOptions): VirtualFile {
  const lines = new LineIndex(source)
  const tokens = tokenize(source, filename)
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
    emitTokens(ctx, tokens)
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
  const { name, jsArg } = token.properties

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

  void jsArg
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
  const resolvedTokens = tokenize(resolved.source, resolved.filename)
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
 */
function emitComponent(ctx: Ctx, token: TagToken): void {
  const jsArg = token.properties.jsArg
  const parsed = parseTagArgs(jsArg)
  if (!parsed || parsed.args.length === 0) return
  const nameArg = parsed.args[0]!
  if (!ts.isStringLiteralLike(nameArg)) return

  const componentTypes = resolveTypesBlock(ctx, nameArg.text)
  if (!componentTypes) return

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

function emitEach(ctx: Ctx, token: TagToken): void {
  const jsArg = token.properties.jsArg
  const match = /^(.*?) in (.*)$/s.exec(jsArg)
  if (!match) return
  const [, binding, list] = match as unknown as [string, string, string]
  const listOffset = tagOffset(ctx, token) + jsArg.indexOf(list, binding.length)

  const withIndex = /^\s*\(\s*([\w$]+)\s*,\s*([\w$]+)\s*\)\s*$/.exec(binding)
  if (withIndex) {
    const [, item, idx] = withIndex as unknown as [string, string, string]
    emit(ctx, `for (const [${idx}, ${item}] of (`)
  } else {
    emit(ctx, `for (const ${binding.trim()} of (`)
  }
  emitVerbatim(ctx, list, listOffset)
  emit(ctx, withIndex ? ').entries()) {\n' : ')) {\n')
  emitTokens(ctx, token.children)
  emit(ctx, '}\n')
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
