import ts from 'typescript'
import type { CommentToken } from 'edge-lexer/types'
import type { LineIndex } from './offsets.ts'

export interface TypesBlock {
  raw: string
  sourceOffset: number
  propertyNames: string[]
  /** true for a `{ ... }` object-literal body; false for any other type expression (e.g. `import('./x.ts').Props`). */
  literal: boolean
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

function propertyNames(objectLiteral: string): string[] {
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
