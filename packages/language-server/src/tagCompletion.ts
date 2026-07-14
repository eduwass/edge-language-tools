import type { LanguageServicePlugin } from '@volar/language-service'
import { type CompletionItem, CompletionItemKind } from 'vscode-languageserver-protocol'
import { URI } from 'vscode-uri'
import { BUILTIN_TAGS } from './builtinTags.ts'
import { templateDocMarkdown } from './templateDocs.ts'
import { findAncestors, nameTemplates } from './templatePathCompletion.ts'

/**
 * Edge tags start a line (optionally indented, optionally self-closed with
 * `@!`), so completion only fires when everything before the cursor on the
 * line is a tag-in-progress. This keeps `@` in prose/emails from popping.
 */
const TAG_POSITION = /^(\s*@!?)([\w.]*)$/

/**
 * Forward filename→tagName mapping for "components as tags" (edge.js
 * `src/plugins/supercharged.ts`): only templates under a `components/` root,
 * `/index` elided, snake_case segments camelCased, dirs joined with dots.
 * `components/checkout_form/input` -> `checkoutForm.input`.
 */
export function superchargedTagName(templateName: string): string | null {
  if (!templateName.startsWith('components/')) return null
  let path = templateName.slice('components/'.length)
  if (path === 'index') return null
  path = path.replace(/\/index$/, '')
  return path
    .split('/')
    .map((segment) => segment.replace(/_(\w)/g, (_, c: string) => c.toUpperCase()))
    .join('.')
}

export function createTagCompletionPlugin(): LanguageServicePlugin {
  return {
    name: 'edge-tag-completion',
    capabilities: {
      completionProvider: {
        triggerCharacters: ['@'],
      },
    },
    create(context) {
      return {
        provideCompletionItems(document, position) {
          if (document.languageId !== 'edge') return undefined

          const text = document.getText()
          const offset = document.offsetAt(position)
          const lineStart = text.lastIndexOf('\n', offset - 1) + 1
          const match = TAG_POSITION.exec(text.slice(lineStart, offset))
          if (!match) return undefined

          // Replace exactly the typed partial name (dots break client word
          // boundaries, so an explicit edit range is required for `@form.inp`).
          const range = {
            start: document.positionAt(lineStart + match[1]!.length),
            end: position,
          }

          const items: CompletionItem[] = BUILTIN_TAGS.map(({ name, seekable, doc }) => ({
            label: name,
            kind: CompletionItemKind.Keyword,
            documentation: { kind: 'markdown' as const, value: doc },
            textEdit: { range, newText: seekable ? `${name}()` : name },
          }))

          const decoded = context.decodeEmbeddedDocumentUri(URI.parse(document.uri))
          const sourceUri = decoded ? decoded[0] : URI.parse(document.uri)
          const templates = nameTemplates(findAncestors(sourceUri.fsPath))
          const seen = new Set<string>()
          for (const [name, fullPath] of templates) {
            const tagName = superchargedTagName(name)
            // `modal.edge` and `modal/index.edge` collide on `@modal`; first wins,
            // matching edge.js loader precedence.
            if (tagName === null || seen.has(tagName)) continue
            seen.add(tagName)
            const docs = templateDocMarkdown(fullPath)
            items.push({
              label: tagName,
              kind: CompletionItemKind.Class,
              detail: fullPath,
              textEdit: { range, newText: `${tagName}()` },
              ...(docs ? { documentation: { kind: 'markdown' as const, value: docs } } : {}),
            })
          }

          return { isIncomplete: false, items }
        },
      }
    },
  }
}
