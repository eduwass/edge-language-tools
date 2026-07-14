import ts from 'typescript'
import type { CommentToken, Token } from 'edge-lexer/types'
import type { LineIndex } from './offsets.ts'

export interface TypesBlock {
  raw: string
  sourceOffset: number
  propertyNames: string[]
  /** true for a `{ ... }` object-literal body; false for any other type expression (e.g. `import('./x.ts').Props`). */
  literal: boolean
  /**
   * Present only for the `@types ... @end` tag block form: one verbatim
   * segment per body line. The generator emits these individually instead of
   * `raw`+`sourceOffset` as a single span — each edge-lexer raw child token
   * only carries a line number (no column), so per-line offsets are the only
   * ones we can compute without fabricating a contiguous range.
   */
  lines?: { text: string; sourceOffset: number }[]
}

/**
 * Finds the `@types` comment, if present. The body is either an object literal
 * (`{{-- @types { user: User } --}}`) or any other TS type expression
 * (`{{-- @types import('./props.ts').Props --}}`) — for the latter, prop names
 * aren't statically knowable, so `propertyNames` is empty and the generator
 * destructures the identifiers the template actually uses instead.
 */
export function findTypesBlock(tokens: CommentToken[], lines: LineIndex): TypesBlock | null {
  for (const token of tokens) {
    const trimmed = token.value.trimStart()
    if (!trimmed.startsWith('@types')) continue

    const commentStart = lines.toOffset(token.loc.start.line, token.loc.start.col)
    const bodyStart = token.value.indexOf('@types') + '@types'.length
    const exprStart = bodyStart + (token.value.slice(bodyStart).match(/^\s*/)?.[0].length ?? 0)
    if (exprStart >= token.value.length) continue

    if (token.value[exprStart] === '{') {
      const braceEnd = matchBrace(token.value, exprStart)
      if (braceEnd === -1) continue
      const raw = token.value.slice(exprStart, braceEnd + 1)
      return { raw, sourceOffset: commentStart + exprStart, propertyNames: propertyNames(raw), literal: true }
    }

    const raw = token.value.slice(exprStart).trimEnd()
    if (raw.length === 0) continue
    return { raw, sourceOffset: commentStart + exprStart, propertyNames: [], literal: false }
  }
  return null
}

/**
 * Finds the `@types` tag form, if present — a real edge tag registered as
 * {block: true, seekable: true} in tokenize.ts (see the comment there for
 * why). Two shapes share that one lexer config:
 *
 *   @types()                    (block form: empty jsArg, member lines as children)
 *     user: import('#models/user').User
 *   @end
 *
 *   @types(import('./shared.ts').Props)   (inline form: jsArg present, empty body)
 *   @end
 *
 * Only top-level tokens are scanned (matching findTypesBlock's comment scan) —
 * `@types` isn't meant to be nested inside another tag.
 */
export function findTypesTag(tokens: Token[], lines: LineIndex): TypesBlock | null {
  for (const token of tokens) {
    if (token.type !== 'tag' || token.properties.name !== 'types') continue

    const jsArg = token.properties.jsArg.trim()
    if (jsArg.length > 0) {
      const sourceOffset = lines.toOffset(token.loc.start.line, token.loc.start.col)
      return { raw: jsArg, sourceOffset, propertyNames: [], literal: false }
    }

    const bodyLines = token.children
      .filter((c): c is Extract<Token, { type: 'raw' }> => c.type === 'raw')
      .map((c) => ({ text: c.value, sourceOffset: lines.toOffset(c.line, 0) }))
    const raw = `{\n${bodyLines.map((l) => l.text).join('\n')}\n}`
    return { raw, sourceOffset: lines.toOffset(token.loc.start.line, token.loc.start.col), propertyNames: propertyNames(raw), literal: true, lines: bodyLines }
  }
  return null
}

function matchBrace(text: string, openIndex: number): number {
  let depth = 0
  for (let i = openIndex; i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

export function propertyNames(objectLiteral: string): string[] {
  const wrapper = `type __T = ${objectLiteral}`
  const source = ts.createSourceFile('__types.ts', wrapper, ts.ScriptTarget.Latest, true)
  const names: string[] = []

  const visit = (node: ts.Node) => {
    if (ts.isTypeAliasDeclaration(node) && ts.isTypeLiteralNode(node.type)) {
      for (const member of node.type.members) {
        if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name)) {
          names.push(member.name.text)
        }
      }
    }
  }
  source.forEachChild(visit)
  return names
}
