import ts from 'typescript'
import type { CommentToken, TagToken, Token } from 'edge-lexer/types'
import { superchargedCandidates, tokenize } from '@edge-language-tools/core'

const BUILTIN_TAGS = new Set([
  'if',
  'unless',
  'elseif',
  'else',
  'each',
  'let',
  'assign',
  'component',
  'include',
  'includeIf',
  'slot',
  'eval',
  'stack',
  'newError',
  'pushTo',
  'pushOnceTo',
  'debugger',
  'inject',
])

export type ResolveTemplate = (name: string) => { source: string; filename: string } | null

function safeTokenize(source: string, filename: string): Token[] {
  try {
    return tokenize(source, filename)
  } catch {
    return tokenize(source, filename, { claimUnknownTags: false })
  }
}

function parseTagArgs(jsArg: string): readonly ts.Expression[] | null {
  const prefix = '__f('
  const sourceFile = ts.createSourceFile('__args.ts', `${prefix}${jsArg})`, ts.ScriptTarget.Latest, true)
  const stmt = sourceFile.statements[0]
  if (!stmt || !ts.isExpressionStatement(stmt) || !ts.isCallExpression(stmt.expression)) return null
  return stmt.expression.arguments
}

function staticStringArg(jsArg: string, index: number): string | null {
  const args = parseTagArgs(jsArg)
  const arg = args?.[index]
  if (!arg || !ts.isStringLiteralLike(arg)) return null
  return arg.text
}

function walkTags(tokens: Token[], visit: (tag: TagToken) => void): void {
  for (const token of tokens) {
    if (token.type !== 'tag' && token.type !== 'e__tag') continue
    const tag = token as TagToken
    visit(tag)
    if (tag.children.length > 0) walkTags(tag.children, visit)
  }
}

/** Collects static component/include references from a template. */
export function collectTemplateDependencies(
  source: string,
  filename: string,
  resolve: ResolveTemplate,
): string[] {
  const tokens = safeTokenize(source, filename)
  const deps = new Set<string>()

  walkTags(tokens, (tag) => {
    const { name, jsArg } = tag.properties
    if (name === 'component') {
      const path = staticStringArg(jsArg, 0)
      if (path) deps.add(path)
      return
    }
    if (name === 'include') {
      const path = staticStringArg(jsArg, 0)
      if (path) deps.add(path)
      return
    }
    if (name === 'includeIf') {
      const path = staticStringArg(jsArg, 1)
      if (path) deps.add(path)
      return
    }
    if (BUILTIN_TAGS.has(name)) return
    for (const candidate of superchargedCandidates(name)) {
      if (resolve(candidate)) {
        deps.add(candidate)
        break
      }
    }
  })

  return [...deps].sort()
}

export function detectSlotNames(source: string): string[] {
  const names = new Set<string>()
  for (const match of source.matchAll(/\$slots\.(\w+)/g)) {
    names.add(match[1]!)
  }
  return [...names].sort()
}

export function isClientTemplate(source: string, filename: string): boolean {
  const tokens = safeTokenize(source, filename)
  const comments = tokens.filter((t): t is CommentToken => t.type === 'comment')
  return comments.some((token) => /(^|\n)[ \t]*@client\b/.test(token.value))
}
