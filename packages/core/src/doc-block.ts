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
  /** The `@types` body (either form), verbatim. */
  types: string | null
}

const NAME_DIRECTIVE = /(^|\n)[ \t]*@name[ \t]+([^\n]+)/
const DESC_DIRECTIVE = /(^|\n)[ \t]*@desc\b[ \t]*/

export function templateDocs(source: string, filename: string): TemplateDocs {
  let tokens: ReturnType<typeof tokenize>
  try {
    tokens = tokenize(source, filename)
  } catch {
    return { name: null, desc: null, types: null }
  }
  const lines = new LineIndex(source)
  const comments = tokens.filter((t): t is CommentToken => t.type === 'comment')
  const types = findTypesBlock(comments, lines)

  let name: string | null = null
  let desc: string | null = null
  for (const token of comments) {
    name ??= NAME_DIRECTIVE.exec(token.value)?.[2]?.trim() ?? null
    if (desc === null) {
      const start = DESC_DIRECTIVE.exec(token.value)
      if (start) {
        const body = token.value.slice(start.index + start[0].length)
        const next = /\n[ \t]*@(?:name|desc|types)\b/.exec(body)
        const text = (next ? body.slice(0, next.index) : body)
          .split('\n')
          .map((line) => line.trim())
          .join('\n')
          .trim()
        desc = text.length > 0 ? text : null
      }
    }
    if (name !== null && desc !== null) break
  }

  return { name, desc, types: types?.raw ?? null }
}
