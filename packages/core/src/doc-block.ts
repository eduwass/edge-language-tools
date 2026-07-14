import type { CommentToken } from 'edge-lexer/types'
import { LineIndex } from './offsets.ts'
import { findTypesBlock } from './types-block.ts'
import { tokenize } from './tokenize.ts'

/**
 * Template doc header — JSDoc for Edge templates. Lives in the same comment
 * as the `@types` block; editor-facing only (stock Edge ignores comments):
 *
 *   {{--
 *   @name User Card
 *   @desc Displays a user card with title and body.
 *     Used on the profile and team pages.
 *   @types { user: { name: string } }
 *   --}}
 *
 * `@name` is rest-of-line; `@desc` runs until the next directive line or the
 * comment's end.
 */
export interface TemplateDocs {
  name: string | null
  desc: string | null
  /** The `@types` body, verbatim. */
  types: string | null
  /** Reference documentation URL from `@url`, if declared. */
  url: string | null
  /** Usage examples from `@example` directives, in declaration order. */
  examples: TemplateExample[]
  /** true when a doc comment contains a line-start `@client` directive. */
  client: boolean
}

export interface TemplateExample {
  /** Optional title from the directive line (text after `@example` and any key=value pairs). */
  title: string | null
  /** Optional preview height hint from a `height=N` pair on the directive line. */
  height: number | null
  /** The example body, verbatim Edge markup. */
  raw: string
}

const NAME_DIRECTIVE = /(^|\n)[ \t]*@name[ \t]+([^\n]+)/
const DESC_DIRECTIVE = /(^|\n)[ \t]*@desc\b[ \t]*/
const URL_DIRECTIVE = /(^|\n)[ \t]*@url[ \t]+([^\n]+)/
const EXAMPLE_DIRECTIVE = /(^|\n)[ \t]*@example\b([^\n]*)/g
const CLIENT_DIRECTIVE = /(^|\n)[ \t]*@client\b/
const NEXT_DIRECTIVE = /\n[ \t]*@(?:name|desc|types|example|url|client)\b/

export function templateDocs(source: string, filename: string): TemplateDocs {
  let tokens: ReturnType<typeof tokenize>
  try {
    tokens = tokenize(source, filename)
  } catch {
    return { name: null, desc: null, types: null, url: null, examples: [], client: false }
  }
  const lines = new LineIndex(source)
  const comments = tokens.filter((t): t is CommentToken => t.type === 'comment')
  const types = findTypesBlock(comments, lines)

  let name: string | null = null
  let desc: string | null = null
  let url: string | null = null
  let client = false
  const examples: TemplateExample[] = []
  for (const token of comments) {
    if (CLIENT_DIRECTIVE.test(token.value)) client = true
    url ??= URL_DIRECTIVE.exec(token.value)?.[2]?.trim() ?? null
    for (const match of token.value.matchAll(EXAMPLE_DIRECTIVE)) {
      const headerRest = match[2] ?? ''
      const bodyStart = (match.index ?? 0) + match[0].length
      const next = NEXT_DIRECTIVE.exec(token.value.slice(bodyStart))
      const bodyEnd = next ? bodyStart + next.index : token.value.length
      const raw = dedent(token.value.slice(bodyStart, bodyEnd)).trim()
      if (raw.length === 0) continue
      let height: number | null = null
      const title = headerRest
        .replace(/\bheight=(\d+)\b/, (_, h: string) => {
          height = Number(h)
          return ''
        })
        .trim()
      examples.push({ title: title.length > 0 ? title : null, height, raw })
    }
    name ??= NAME_DIRECTIVE.exec(token.value)?.[2]?.trim() ?? null
    if (desc === null) {
      const start = DESC_DIRECTIVE.exec(token.value)
      if (start) {
        const body = token.value.slice(start.index + start[0].length)
        const next = NEXT_DIRECTIVE.exec(body)
        const text = (next ? body.slice(0, next.index) : body)
          .split('\n')
          .map((line) => line.trim())
          .join('\n')
          .trim()
        desc = text.length > 0 ? text : null
      }
    }
  }

  return { name, desc, types: types?.raw ?? null, url, examples, client }
}

/** Strips the common leading indentation from an example body. */
function dedent(text: string): string {
  const lines = text.replace(/^\n/, '').split('\n')
  let min = Infinity
  for (const line of lines) {
    if (line.trim().length === 0) continue
    const indent = line.length - line.trimStart().length
    if (indent < min) min = indent
  }
  if (!Number.isFinite(min) || min === 0) return text
  return lines.map((line) => line.slice(min)).join('\n')
}
