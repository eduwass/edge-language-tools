import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, basename } from 'node:path'
import { Edge } from 'edge.js'
import { edgeIconify, addCollection } from 'edge-iconify'
import { icons as lucideIcons } from '@iconify-json/lucide'
import ts from 'typescript'
import { templateDocs, type TemplateExample } from '@edge-language-tools/core'
import {
  classifyPropType,
  parsePreviewExample,
  previewHtml,
  stemToTag,
} from '../src/playground.ts'
import type { PlaygroundProp, PlaygroundSchema } from '../src/playground-types.ts'

const root = join(import.meta.dir, '..')
const componentsDir = join(root, 'templates/components')
const docsDir = join(root, 'docs/components')
const previewsDir = join(root, 'public/previews')

mkdirSync(docsDir, { recursive: true })
mkdirSync(previewsDir, { recursive: true })

addCollection(lucideIcons)
const edge = Edge.create()
edge.use(edgeIconify)
edge.mount(new URL('../templates/', import.meta.url))

interface ParsedProperty {
  name: string
  type: string
  required: boolean
  description?: string
  default?: string
}

interface ParsedTypes {
  properties: ParsedProperty[]
  hasIndexSignature: boolean
}

function tagName(file: string): string {
  const stem = basename(file, '.edge')
  return stem.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
}

interface TemplateDocs {
  name: string | null
  desc: string | null
  types: string | null
  url: string | null
  examples: TemplateExample[]
}

const NAME_DIRECTIVE = /(?:^|\n)[ \t]*@name[ \t]+([^\n]+)/
const DESC_DIRECTIVE = /(?:^|\n)[ \t]*@desc\b[ \t]*/
const TYPES_DIRECTIVE = /(?:^|\n)[ \t]*@types\b/
const URL_DIRECTIVE = /(?:^|\n)[ \t]*@url[ \t]+([^\n]+)/
const EXAMPLE_DIRECTIVE = /(?:^|\n)[ \t]*@example\b([^\n]*)/g
const NEXT_DIRECTIVE = /\n[ \t]*@(?:name|desc|types|example|url)\b/

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

/** Fallback when edge-lexer cannot tokenize a template (e.g. complex @if nesting). */
function dedentExample(text: string): string {
  const lines = text.replace(/^\n/, '').split('\n')
  let min = Infinity
  for (const line of lines) {
    if (line.trim().length === 0) continue
    const indent = line.length - line.trimStart().length
    if (indent < min) min = indent
  }
  if (!Number.isFinite(min) || min === 0) return text.trim()
  return lines.map((line) => line.slice(min)).join('\n').trim()
}

function parseDocCommentFallback(source: string): TemplateDocs {
  const match = /\{\{--([\s\S]*?)--\}\}/.exec(source)
  if (!match) return { name: null, desc: null, types: null, url: null, examples: [] }

  const comment = match[1]
  const name = NAME_DIRECTIVE.exec(comment)?.[1]?.trim() ?? null
  const url = URL_DIRECTIVE.exec(comment)?.[1]?.trim() ?? null

  let desc: string | null = null
  const descStart = DESC_DIRECTIVE.exec(comment)
  if (descStart) {
    const body = comment.slice(descStart.index + descStart[0].length)
    const next = NEXT_DIRECTIVE.exec(body)
    const text = (next ? body.slice(0, next.index) : body)
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
      .trim()
    desc = text.length > 0 ? text : null
  }

  let types: string | null = null
  const typesStart = TYPES_DIRECTIVE.exec(comment)
  if (typesStart) {
    const body = comment.slice(typesStart.index + typesStart[0].length)
    const exprStart = body.match(/^\s*/)?.[0].length ?? 0
    const expr = body.slice(exprStart)
    if (expr.startsWith('{')) {
      const end = matchBrace(expr, 0)
      if (end !== -1) types = expr.slice(0, end + 1)
    } else {
      const next = NEXT_DIRECTIVE.exec(expr)
      const raw = (next ? expr.slice(0, next.index) : expr).trimEnd()
      types = raw.length > 0 ? raw : null
    }
  }

  const examples: TemplateExample[] = []
  for (const exampleMatch of comment.matchAll(EXAMPLE_DIRECTIVE)) {
    const headerRest = exampleMatch[1] ?? ''
    const bodyStart = (exampleMatch.index ?? 0) + exampleMatch[0].length
    const next = NEXT_DIRECTIVE.exec(comment.slice(bodyStart))
    const bodyEnd = next ? bodyStart + next.index : comment.length
    const raw = dedentExample(comment.slice(bodyStart, bodyEnd))
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

  return { name, desc, types, url, examples }
}

function getTemplateDocs(source: string, file: string): TemplateDocs {
  const docs = templateDocs(source, file)
  if (docs.name && docs.types && docs.examples.length > 0) return docs
  const fallback = parseDocCommentFallback(source)
  return {
    name: docs.name ?? fallback.name,
    desc: docs.desc ?? fallback.desc,
    types: docs.types ?? fallback.types,
    url: docs.url ?? fallback.url,
    examples: docs.examples.length > 0 ? docs.examples : fallback.examples,
  }
}

function commentText(fullText: string, range: ts.CommentRange): string {
  const raw = fullText.slice(range.pos, range.end)
  if (raw.startsWith('//')) return raw.slice(2).trim()
  if (raw.startsWith('/*')) return raw.slice(2, -2).trim()
  return raw.trim()
}

function parsePropDoc(
  member: ts.PropertySignature,
  source: ts.SourceFile,
): { description?: string; default?: string } {
  const fullText = source.getFullText()
  const parts: string[] = []

  for (const range of ts.getLeadingCommentRanges(fullText, member.getFullStart()) ?? []) {
    parts.push(commentText(fullText, range))
  }
  for (const tag of ts.getJSDocTags(member)) {
    if (ts.isJSDocParameterTag(tag) || ts.isJSDocPropertyTag(tag)) continue
    if (tag.tagName.text === 'default' && tag.comment) {
      parts.push(`@default ${typeof tag.comment === 'string' ? tag.comment : tag.comment.map((c) => c.text).join('')}`)
    }
  }

  const combined = parts.join(' ').trim()
  if (!combined) return {}

  const defaultMatch = combined.match(/@default\s+(.+?)(?:\s*$|(?=\s+@))/s)
  const defaultValue = defaultMatch?.[1]?.trim()
  const description = (defaultMatch ? combined.slice(0, defaultMatch.index) : combined)
    .replace(/\s+@default\s*$/s, '')
    .trim()

  return {
    ...(description ? { description } : {}),
    ...(defaultValue ? { default: defaultValue } : {}),
  }
}

function parseTypesBlock(objectLiteral: string): ParsedTypes | null {
  const trimmed = objectLiteral.trim()
  if (!trimmed.startsWith('{')) return null

  const wrapper = `type __T = ${trimmed}`
  const source = ts.createSourceFile('__types.ts', wrapper, ts.ScriptTarget.Latest, true)
  let result: ParsedTypes | null = null

  const visit = (node: ts.Node) => {
    if (ts.isTypeAliasDeclaration(node) && ts.isTypeLiteralNode(node.type)) {
      const properties: ParsedProperty[] = []
      let hasIndexSignature = false
      for (const member of node.type.members) {
        if (ts.isIndexSignatureDeclaration(member)) {
          hasIndexSignature = true
          continue
        }
        if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name)) {
          const doc = parsePropDoc(member, source)
          properties.push({
            name: member.name.text,
            type: member.type ? member.type.getText(source) : 'unknown',
            required: member.questionToken === undefined,
            ...doc,
          })
        }
      }
      result = { properties, hasIndexSignature }
    }
  }
  source.forEachChild(visit)
  return result
}

async function renderPreview(source: string, stem: string): Promise<string> {
  return previewHtml(edge, source, {
    includeShellScripts: stem !== 'basecoat_scripts',
  })
}

// Components whose interactivity is provided by the core all.min.js runtime.
const RUNTIME_JS_COMPONENTS = new Set([
  'accordion',
  'combobox',
  'command',
  'dialog',
  'dropdown_menu',
  'popover',
  'select',
  'sidebar',
  'tabs',
  'toast',
])

const ASSET_COMPONENTS = new Set(['basecoat_styles', 'basecoat_scripts'])

function needsJs(stem: string, source: string): boolean {
  if (ASSET_COMPONENTS.has(stem)) return false
  if (RUNTIME_JS_COMPONENTS.has(stem)) return true
  return /pushOnceTo\s*\(\s*['"]basecoat:scripts['"]\s*\)/.test(source)
}

function acceptsBodyContent(templateSource: string): boolean {
  return /\$slots\.main\b/.test(templateSource)
}

function buildPlaygroundSchema(
  stem: string,
  typesBlock: string,
  example: TemplateExample,
  templateSource: string,
): PlaygroundSchema {
  const tag = stemToTag(stem)
  const { props: defaultProps, slot } = parsePreviewExample(example.raw, tag)
  const parsed = parseTypesBlock(typesBlock)
  const props: Record<string, PlaygroundProp> = {}

  if (parsed) {
    for (const prop of parsed.properties) {
      const control = classifyPropType(prop.type) ?? undefined
      props[prop.name] = {
        type: prop.type,
        required: prop.required,
        ...(prop.description ? { description: prop.description } : {}),
        ...(prop.default ? { default: prop.default } : {}),
        ...(control ? { control } : {}),
      }
    }
  }

  return {
    props,
    defaultProps,
    defaultSlot: slot,
    previewSlug: stem,
    ...(slot.length > 0 || acceptsBodyContent(templateSource) ? { hasSlot: true } : {}),
    ...(parsed?.hasIndexSignature ? { hasIndexSignature: true } : {}),
    ...(example.height !== null && example.height !== undefined ? { minHeight: example.height } : {}),
  }
}

function emitPlaygroundSection(stem: string, schema: PlaygroundSchema): string {
  const schemaJson = JSON.stringify(schema)
  const minHeight = schema.minHeight ?? 160
  return `## Preview

<Playground component="${stem}" schema={${schemaJson}} minHeight={${minHeight}} />
`
}

const files = readdirSync(componentsDir).filter((f) => f.endsWith('.edge')).sort()

for (const file of files) {
  const stem = basename(file, '.edge')
  const source = readFileSync(join(componentsDir, file), 'utf8')
  const docs = getTemplateDocs(source, file)
  const name = docs.name ?? tagName(file)
  const descFirst = docs.desc?.split('\n')[0] ?? name
  // The first @desc line is the frontmatter description (rendered under the
  // title by blume) — only remaining lines belong in the body, else it doubles.
  const descBody = docs.desc?.split('\n').slice(1).join('\n').trim() ?? ''
  const typesBlock = docs.types ?? '{}'

  const examples = docs.examples
  if (!examples.length) {
    throw new Error(`Missing @example directives for component: ${stem}`)
  }

  for (let i = 0; i < examples.length; i++) {
    const slug = i === 0 ? stem : `${stem}-${i}`
    const html = await renderPreview(examples[i].raw, stem)
    writeFileSync(join(previewsDir, `${slug}.html`), html)
  }

  const primaryExample = examples[0]
  const schema = buildPlaygroundSchema(stem, typesBlock, primaryExample, source)

  const referenceLine = docs.url
    ? `\nReference: <a href="${docs.url}" target="_blank" rel="noopener noreferrer">${docs.url}</a>${needsJs(stem, source) ? ' — Needs JS' : ''}\n`
    : needsJs(stem, source)
      ? '\nNeeds JS\n'
      : ''

  const mdx = `---
title: ${name}
description: ${descFirst.replace(/"/g, '\\"')}
---

${descBody}${referenceLine}

${emitPlaygroundSection(stem, schema)}
`

  writeFileSync(join(docsDir, `${stem}.mdx`), mdx)
}

writeFileSync(
  join(docsDir, 'meta.ts'),
  `import { defineMeta } from 'blume'

export default defineMeta({
  title: 'Components',
  pages: ${JSON.stringify(files.map((f) => basename(f, '.edge')))},
})
`,
)

console.log(`Generated ${files.length} component docs and ${files.length} preview sets`)
