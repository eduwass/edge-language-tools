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
    // `@types` must start a line of the comment, but other doc directives
    // (`@name`, `@desc`) may precede it in the same comment.
    const directive = /(^|\n)[ \t]*@types\b/.exec(token.value)
    if (!directive) continue

    const commentStart = lines.toOffset(token.loc.start.line, token.loc.start.col)
    const bodyStart = directive.index + directive[0].length
    const exprStart = bodyStart + (token.value.slice(bodyStart).match(/^\s*/)?.[0].length ?? 0)
    if (exprStart >= token.value.length) continue

    if (token.value[exprStart] === '{') {
      const braceEnd = matchBrace(token.value, exprStart)
      if (braceEnd === -1) continue
      const raw = token.value.slice(exprStart, braceEnd + 1)
      return { raw, sourceOffset: commentStart + exprStart, propertyNames: propertyNames(raw), literal: true }
    }

    // Expression form: runs to the next directive line, or the comment's end.
    const next = /\n[ \t]*@(?:name|desc|example|client)\b/.exec(token.value.slice(exprStart))
    const exprEnd = next ? exprStart + next.index : token.value.length
    const raw = token.value.slice(exprStart, exprEnd).trimEnd()
    if (raw.length === 0) continue
    return { raw, sourceOffset: commentStart + exprStart, propertyNames: [], literal: false }
  }
  return null
}

function matchBrace(text: string, openIndex: number): number {
  let depth = 0
  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i]

    if (ch === "'" || ch === '"') {
      i = skipQuotedString(text, i, ch)
      continue
    }
    if (ch === '`') {
      i = skipTemplateLiteral(text, i)
      continue
    }
    if (ch === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++
      continue
    }
    if (ch === '/' && text[i + 1] === '*') {
      i += 2
      while (i < text.length - 1 && !(text[i] === '*' && text[i + 1] === '/')) i++
      i++
      continue
    }

    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

function skipQuotedString(text: string, start: number, quote: string): number {
  for (let i = start + 1; i < text.length; i++) {
    if (text[i] === '\\') {
      i++
      continue
    }
    if (text[i] === quote) return i
  }
  return text.length - 1
}

function skipTemplateLiteral(text: string, start: number): number {
  for (let i = start + 1; i < text.length; i++) {
    if (text[i] === '\\') {
      i++
      continue
    }
    if (text[i] === '`') return i
    if (text[i] === '$' && text[i + 1] === '{') {
      i = skipTemplateExpression(text, i + 2)
    }
  }
  return text.length - 1
}

function skipTemplateExpression(text: string, start: number): number {
  let depth = 0
  for (let i = start; i < text.length; i++) {
    const ch = text[i]

    if (ch === "'" || ch === '"') {
      i = skipQuotedString(text, i, ch)
      continue
    }
    if (ch === '`') {
      i = skipTemplateLiteral(text, i)
      continue
    }
    if (ch === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++
      continue
    }
    if (ch === '/' && text[i + 1] === '*') {
      i += 2
      while (i < text.length - 1 && !(text[i] === '*' && text[i + 1] === '/')) i++
      i++
      continue
    }

    if (ch === '{') depth++
    else if (ch === '}') {
      if (depth === 0) return i
      depth--
    }
  }
  return text.length - 1
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
