import { existsSync, readdirSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import type { LanguageServicePlugin } from '@volar/language-service'
import { CompletionItemKind } from 'vscode-languageserver-protocol'
import { URI } from 'vscode-uri'

const TAG_STRING_CONTEXT = /@!?(?:include|includeIf|component)\(\s*(?:[^)]*,\s*)?['"][^'"]*$/
const ROOT_MARKERS = ['package.json', '.git']

/**
 * Ancestor directories nearest-to-farthest, stopping at (and including) the first
 * project boundary. Mirrors makeResolver's nearest-ancestor-first probing in
 * languagePlugin.ts, bounded so template discovery doesn't scan the whole disk.
 */
function findAncestors(fromFile: string): string[] {
  const ancestors: string[] = []
  let dir = dirname(fromFile)
  for (let depth = 0; depth < 20; depth++) {
    ancestors.push(dir)
    if (ROOT_MARKERS.some((marker) => existsSync(join(dir, marker)))) break
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return ancestors
}

function collectEdgeFiles(root: string, maxDepth = 12): string[] {
  const files: string[] = []

  function walk(dir: string, depth: number) {
    if (depth > maxDepth) return
    let entries: import('node:fs').Dirent[]
    try {
      entries = readdirSync(dir, { withFileTypes: true, encoding: 'utf8' })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full, depth + 1)
      else if (entry.isFile() && entry.name.endsWith('.edge')) files.push(full)
    }
  }

  walk(root, 0)
  return files
}

/** Name each template relative to the nearest ancestor (from `ancestors`) that contains it. */
function nameTemplates(ancestors: string[]): Map<string, string> {
  const templates = new Map<string, string>()
  const root = ancestors[ancestors.length - 1]
  if (!root) return templates

  for (const full of collectEdgeFiles(root)) {
    const owner = ancestors.find((ancestor) => (full + sep).startsWith(ancestor + sep))
    if (!owner) continue
    const name = relative(owner, full).replace(/\.edge$/, '').split(/[\\/]/).join('/')
    if (!templates.has(name)) templates.set(name, full)
  }

  return templates
}

export function createTemplatePathCompletionPlugin(): LanguageServicePlugin {
  return {
    name: 'edge-template-path-completion',
    capabilities: {
      completionProvider: {
        triggerCharacters: ["'", '"', '/'],
      },
    },
    create(context) {
      return {
        provideCompletionItems(document, position) {
          if (document.languageId !== 'edge') return undefined

          const text = document.getText()
          const offset = document.offsetAt(position)
          const lineStart = text.lastIndexOf('\n', offset - 1) + 1
          const before = text.slice(lineStart, offset)
          if (!TAG_STRING_CONTEXT.test(before)) return undefined

          const decoded = context.decodeEmbeddedDocumentUri(URI.parse(document.uri))
          const sourceUri = decoded ? decoded[0] : URI.parse(document.uri)
          const filePath = sourceUri.fsPath
          const ancestors = findAncestors(filePath)
          const templates = nameTemplates(ancestors)

          return {
            isIncomplete: false,
            items: Array.from(templates, ([name, fullPath]) => ({
              label: name,
              kind: CompletionItemKind.File,
              detail: fullPath,
            })),
          }
        },
      }
    },
  }
}
