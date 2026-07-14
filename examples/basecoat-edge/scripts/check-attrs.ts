import { readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { Edge } from 'edge.js'
import { edgeIconify, addCollection } from 'edge-iconify'
import { icons as lucideIcons } from '@iconify-json/lucide'
import { templateDocs, matchBrace, type TemplateExample } from '@edge-language-tools/core'
import { buildRenderTemplate, parsePreviewExample, stemToTag } from '../src/playground.ts'

const root = join(import.meta.dir, '..')
const componentsDir = join(root, 'templates/components')

addCollection(lucideIcons)
const edge = Edge.create()
edge.use(edgeIconify)
edge.mount(new URL('../templates/', import.meta.url))

const EXAMPLE_DIRECTIVE = /(?:^|\n)[ \t]*@example\b([^\n]*)/g
const NEXT_DIRECTIVE = /\n[ \t]*@(?:name|desc|types|example|url)\b/
const TYPES_DIRECTIVE = /(?:^|\n)[ \t]*@types\b/

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

function parseDocCommentFallback(source: string): {
  types: string | null
  examples: TemplateExample[]
} {
  const match = /\{\{--([\s\S]*?)--\}\}/.exec(source)
  if (!match) return { types: null, examples: [] }

  const comment = match[1]
  let types: string | null = null
  const typesStart = TYPES_DIRECTIVE.exec(comment)
  if (typesStart) {
    const body = comment.slice(typesStart.index + typesStart[0].length)
    const exprStart = body.match(/^\s*/)?.[0].length ?? 0
    const expr = body.slice(exprStart)
    if (expr.startsWith('{')) {
      const end = matchBrace(expr, 0)
      if (end !== -1) types = expr.slice(0, end + 1)
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

  return { types, examples }
}

function getTemplateDocs(source: string, file: string) {
  const docs = templateDocs(source, file)
  const fallback = parseDocCommentFallback(source)
  return {
    types: docs.types ?? fallback.types,
    examples: docs.examples.length > 0 ? docs.examples : fallback.examples,
  }
}

function hasPassthroughAttrs(source: string): boolean {
  return /\[attr:\s*`data-\$\{string\}`\]/.test(source)
}

function openTagWithProbe(html: string, probe: string): string | null {
  const idx = html.indexOf(probe)
  if (idx === -1) return null
  const tagStart = html.lastIndexOf('<', idx)
  const tagEnd = html.indexOf('>', idx)
  if (tagStart === -1 || tagEnd === -1) return null
  return html.slice(tagStart, tagEnd + 1)
}

const DATA_PROBE = 'data-attr-probe="v9"'
const CLASS_PROBE = 'attr-class-probe'
const failures: string[] = []

const files = readdirSync(componentsDir)
  .filter((file) => file.endsWith('.edge'))
  .sort()

for (const file of files) {
  const stem = basename(file, '.edge')
  const source = readFileSync(join(componentsDir, file), 'utf8')
  const docs = getTemplateDocs(source, file)

  if (!hasPassthroughAttrs(source)) continue

  const example = docs.examples[0]
  if (!example) {
    failures.push(`${stem}: missing @example`)
    continue
  }

  const tag = stemToTag(stem)
  const { props, slot } = parsePreviewExample(example.raw, tag)
  const probeProps = { ...props, 'data-attr-probe': 'v9', class: CLASS_PROBE }
  const template = buildRenderTemplate(stem, probeProps, slot)
  const html = await edge.renderRaw(template, {}, join(componentsDir, file))

  const dataCount = html.split(DATA_PROBE).length - 1
  if (dataCount !== 1) {
    failures.push(`${stem}: data-attr-probe not forwarded exactly once (got ${dataCount})`)
    continue
  }

  const openTag = openTagWithProbe(html, DATA_PROBE)
  if (!openTag) {
    failures.push(`${stem}: could not locate root tag with data-attr-probe`)
    continue
  }

  const classAttrs = openTag.match(/\bclass="[^"]*"/g) ?? []
  if (classAttrs.length !== 1) {
    failures.push(`${stem}: expected one class attribute on root, got ${classAttrs.length}`)
    continue
  }

  const classValue = classAttrs[0]!.slice('class="'.length, -1)
  if (!classValue.split(/\s+/).includes(CLASS_PROBE)) {
    failures.push(`${stem}: probe class not merged onto root`)
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(failure)
  process.exit(1)
}

console.log(`check:attrs ok (${files.filter((file) => {
  const source = readFileSync(join(componentsDir, file), 'utf8')
  return hasPassthroughAttrs(source)
}).length} components)`)
