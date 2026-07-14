import type { LanguageServicePlugin } from '@volar/language-service'
import { URI } from 'vscode-uri'
import { BUILTIN_TAGS } from './builtinTags.ts'
import { superchargedTagName } from './tagCompletion.ts'
import { templateDocMarkdown } from './templateDocs.ts'
import { findAncestors, nameTemplates } from './templatePathCompletion.ts'

/** A tag opening a line: leading whitespace, `@` or `@!`, dotted name. */
const TAG_AT_LINE_START = /^(\s*@!?)([\w.]+)/

/** A template-path string argument: `@include('partials/nav'` etc. */
const PATH_ARG = /@!?(?:include|includeIf|component)\(\s*(?:[^)]*,\s*)?(['"])([^'"]*)\1/g

interface Target {
  /** Range of the hovered token in the document, as offsets. */
  start: number
  end: number
  /** Builtin doc markdown, or null when this is a template reference. */
  builtinDoc: string | null
  /** Resolved template file, when the target names one. */
  templatePath: string | null
}

/**
 * What tag-ish thing sits under the cursor: a tag name at the start of the
 * line (builtin or supercharged component), or a template-path string inside
 * an `@include`/`@component` argument.
 */
function targetAt(text: string, offset: number, documentPath: string): Target | null {
  const lineStart = text.lastIndexOf('\n', offset - 1) + 1
  const lineEnd = text.indexOf('\n', offset)
  const line = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd)
  const column = offset - lineStart

  const templates = () => nameTemplates(findAncestors(documentPath))

  const tag = TAG_AT_LINE_START.exec(line)
  if (tag) {
    const nameStart = tag[1]!.length
    const nameEnd = nameStart + tag[2]!.length
    if (column >= nameStart - 1 && column <= nameEnd) {
      const name = tag[2]!
      const target: Target = { start: lineStart + nameStart, end: lineStart + nameEnd, builtinDoc: null, templatePath: null }
      const builtin = BUILTIN_TAGS.find((t) => t.name === name)
      if (builtin) return { ...target, builtinDoc: builtin.doc }
      for (const [templateName, fullPath] of templates()) {
        if (superchargedTagName(templateName) === name) return { ...target, templatePath: fullPath }
      }
      return null
    }
  }

  for (const match of line.matchAll(PATH_ARG)) {
    const pathStart = match.index + match[0].length - match[2]!.length - 1
    const pathEnd = pathStart + match[2]!.length
    if (column < pathStart || column > pathEnd) continue
    // Edge accepts dots as separators in template names.
    const wanted = match[2]!.replace(/\./g, '/')
    for (const [templateName, fullPath] of templates()) {
      if (templateName === wanted || templateName === `${wanted}/index`) {
        return { start: lineStart + pathStart, end: lineStart + pathEnd, builtinDoc: null, templatePath: fullPath }
      }
    }
    return null
  }

  return null
}

export function createTagHoverPlugin(): LanguageServicePlugin {
  return {
    name: 'edge-tag-hover',
    capabilities: {
      hoverProvider: true,
      definitionProvider: true,
    },
    create(context) {
      const resolve = (document: { languageId: string; uri: string; getText(): string; offsetAt(p: { line: number; character: number }): number }, position: { line: number; character: number }) => {
        if (document.languageId !== 'edge') return null
        const decoded = context.decodeEmbeddedDocumentUri(URI.parse(document.uri))
        const sourceUri = decoded ? decoded[0] : URI.parse(document.uri)
        return targetAt(document.getText(), document.offsetAt(position), sourceUri.fsPath)
      }

      return {
        provideHover(document, position) {
          const target = resolve(document, position)
          if (!target) return undefined

          const value = target.builtinDoc ?? (target.templatePath ? (templateDocMarkdown(target.templatePath, { includeReference: true }) ?? `\`${target.templatePath}\``) : null)
          if (!value) return undefined
          return {
            contents: { kind: 'markdown' as const, value },
            range: { start: document.positionAt(target.start), end: document.positionAt(target.end) },
          }
        },

        provideDefinition(document, position) {
          const target = resolve(document, position)
          if (!target?.templatePath) return undefined
          const zero = { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }
          return [
            {
              targetUri: URI.file(target.templatePath).toString(),
              targetRange: zero,
              targetSelectionRange: zero,
              originSelectionRange: { start: document.positionAt(target.start), end: document.positionAt(target.end) },
            },
          ]
        },
      }
    },
  }
}
