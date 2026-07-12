import ts from 'typescript'
import type { CommentToken } from 'edge-lexer/types'
import type { LineIndex } from './offsets.ts'

export interface TypesBlock {
  raw: string
  sourceOffset: number
  propertyNames: string[]
}

/** Finds the `{{-- @types { ... } --}} ` comment, if present, and locates its brace body verbatim. */
export function findTypesBlock(tokens: CommentToken[], lines: LineIndex): TypesBlock | null {
  for (const token of tokens) {
    const trimmed = token.value.trimStart()
    if (!trimmed.startsWith('@types')) continue

    const braceStart = token.value.indexOf('{', token.value.indexOf('@types'))
    if (braceStart === -1) continue
    const braceEnd = matchBrace(token.value, braceStart)
    if (braceEnd === -1) continue

    const commentStart = lines.toOffset(token.loc.start.line, token.loc.start.col)
    const raw = token.value.slice(braceStart, braceEnd + 1)
    const sourceOffset = commentStart + braceStart
    return { raw, sourceOffset, propertyNames: propertyNames(raw) }
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
