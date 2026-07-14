import { readFileSync } from 'node:fs'
import { templateDocs } from '@edge-language-tools/core'

/**
 * Markdown doc card for a template file — `@name` as heading, `@desc` prose,
 * `@types` as a TS code block. Shared by tag completion (popup documentation)
 * and tag hover. Null when the file is unreadable or has no doc header at all.
 */
export function templateDocMarkdown(
  filePath: string,
  options?: { includeReference?: boolean },
): string | null {
  let source: string
  try {
    source = readFileSync(filePath, 'utf8')
  } catch {
    return null
  }
  const docs = templateDocs(source, filePath)
  if (docs.name === null && docs.desc === null && docs.types === null) return null

  const parts: string[] = []
  if (docs.name) parts.push(`**${docs.name}**`)
  if (docs.desc) parts.push(docs.desc)
  if (docs.types) parts.push('```ts\n' + docs.types + '\n```')
  if (options?.includeReference && docs.url) {
    parts.push(`[Reference](${docs.url})`)
  }
  return parts.join('\n\n')
}
