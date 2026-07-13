import ts from 'typescript'
import type { MustacheToken, TagToken, Token } from 'edge-lexer/types'
import { GLOBALS_TS } from './globals.ts'
import type { LineIndex } from './offsets.ts'

const EDGE_GLOBAL_NAMES = new Set(
  [...GLOBALS_TS.matchAll(/declare const (\w+)/g)].map((m) => m[1]!),
)

/**
 * Collects the identifiers a template's expressions would resolve against
 * state, mapped to the source offset of their first usage. Mirrors Edge's own
 * resolution rule: not a template-local binding (@let/@each/@slot), not an
 * Edge global, not a JS host global. Used when the @types body is an imported
 * type expression, where declared prop names aren't statically knowable.
 */
export function collectStateIdents(tokens: Token[], lines: LineIndex): Map<string, number> {
  const locals = new Set<string>()
  collectLocals(tokens, locals)

  const found = new Map<string, number>()
  walk(tokens, lines, (jsArg, baseOffset) => {
    const parsed = parseExpr(jsArg)
    if (!parsed) return
    const visit = (node: ts.Node) => {
      const start = node.getStart(parsed.sourceFile)
      if (start >= parsed.prefixLength && ts.isIdentifier(node) && isStateReference(node) && !locals.has(node.text)) {
        const name = node.text
        if (!found.has(name)) {
          found.set(name, baseOffset + start - parsed.prefixLength)
        }
      }
      node.forEachChild(visit)
    }
    parsed.sourceFile.forEachChild(visit)
  })
  return found
}

function isStateReference(node: ts.Identifier): boolean {
  const name = node.text
  if (name.startsWith('$')) return false
  if (EDGE_GLOBAL_NAMES.has(name)) return false
  if (name in globalThis) return false
  const parent = node.parent
  // `.name` of a property access / property key in an object literal — not a value read.
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return false
  if ((ts.isPropertyAssignment(parent) || ts.isPropertySignature(parent)) && parent.name === node) return false
  return true
}

function collectLocals(tokens: Token[], locals: Set<string>): void {
  for (const token of tokens) {
    if (token.type !== 'tag' && token.type !== 'e__tag') continue
    const tag = token as TagToken
    const { name } = tag.properties
    const jsArg = tag.properties.jsArg
    if (name === 'let' || name === 'assign') {
      addBindingNames(jsArg.split('=')[0] ?? '', locals)
    } else if (name === 'each') {
      addBindingNames(jsArg.split(/\bin\b/)[0] ?? '', locals)
    } else if (name === 'slot') {
      const parsed = parseExpr(jsArg)
      const second = parsed?.args?.[1]
      if (second && ts.isIdentifier(second)) locals.add(second.text)
    }
    if (tag.children.length > 0) collectLocals(tag.children, locals)
  }
}

function addBindingNames(text: string, locals: Set<string>): void {
  for (const m of text.matchAll(/[A-Za-z_$][\w$]*/g)) locals.add(m[0])
}

function parseExpr(jsArg: string): { sourceFile: ts.SourceFile; prefixLength: number; args?: readonly ts.Expression[] } | null {
  const prefix = '__f('
  const sourceFile = ts.createSourceFile('__expr.ts', `${prefix}${jsArg})`, ts.ScriptTarget.Latest, true)
  const stmt = sourceFile.statements[0]
  if (!stmt || !ts.isExpressionStatement(stmt) || !ts.isCallExpression(stmt.expression)) return null
  return { sourceFile, prefixLength: prefix.length, args: stmt.expression.arguments }
}

function walk(tokens: Token[], lines: LineIndex, fn: (jsArg: string, baseOffset: number) => void): void {
  for (const token of tokens) {
    if (token.type === 'mustache' || token.type === 's__mustache') {
      const m = token as MustacheToken
      fn(m.properties.jsArg, lines.toOffset(m.loc.start.line, m.loc.start.col))
      continue
    }
    if (token.type === 'tag' || token.type === 'e__tag') {
      const tag = token as TagToken
      if (tag.properties.jsArg.trim().length > 0) {
        fn(tag.properties.jsArg, lines.toOffset(tag.loc.start.line, tag.loc.start.col))
      }
      if (tag.children.length > 0) walk(tag.children, lines, fn)
    }
  }
}
