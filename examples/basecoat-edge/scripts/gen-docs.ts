import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, basename } from 'node:path'
import { Edge } from 'edge.js'
import { edgeIconify, addCollection } from 'edge-iconify'
import { icons as lucideIcons } from '@iconify-json/lucide'
import ts from 'typescript'
import { templateDocs } from '@edge-language-tools/core'
import { previews } from './previews.ts'

const root = join(import.meta.dir, '..')
const componentsDir = join(root, 'templates/components')
const docsDir = join(root, 'docs/components')
const previewsDir = join(root, 'public/previews')
const templatesDir = join(root, 'templates')

mkdirSync(docsDir, { recursive: true })
mkdirSync(previewsDir, { recursive: true })

addCollection(lucideIcons)
const edge = Edge.create()
edge.use(edgeIconify)
edge.mount(new URL('../templates/', import.meta.url))

const BASECOAT_CSS = 'https://cdn.jsdelivr.net/npm/basecoat-css@0.3.11/dist/basecoat.cdn.min.css'
const BASECOAT_JS = 'https://cdn.jsdelivr.net/npm/basecoat-css@0.3.11/dist/js/all.min.js'

interface ParsedProperty {
  name: string
  type: string
  required: boolean
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
}

const NAME_DIRECTIVE = /(?:^|\n)[ \t]*@name[ \t]+([^\n]+)/
const DESC_DIRECTIVE = /(?:^|\n)[ \t]*@desc\b[ \t]*/
const TYPES_DIRECTIVE = /(?:^|\n)[ \t]*@types\b/

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
function parseDocCommentFallback(source: string): TemplateDocs {
  const match = /\{\{--([\s\S]*?)--\}\}/.exec(source)
  if (!match) return { name: null, desc: null, types: null }

  const comment = match[1]
  const name = NAME_DIRECTIVE.exec(comment)?.[1]?.trim() ?? null

  let desc: string | null = null
  const descStart = DESC_DIRECTIVE.exec(comment)
  if (descStart) {
    const body = comment.slice(descStart.index + descStart[0].length)
    const next = /\n[ \t]*@(?:name|desc|types)\b/.exec(body)
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
      const next = /\n[ \t]*@(?:name|desc)\b/.exec(expr)
      const raw = (next ? expr.slice(0, next.index) : expr).trimEnd()
      types = raw.length > 0 ? raw : null
    }
  }

  return { name, desc, types }
}

function getTemplateDocs(source: string, file: string): TemplateDocs {
  const docs = templateDocs(source, file)
  if (docs.name && docs.types) return docs
  const fallback = parseDocCommentFallback(source)
  return {
    name: docs.name ?? fallback.name,
    desc: docs.desc ?? fallback.desc,
    types: docs.types ?? fallback.types,
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
          properties.push({
            name: member.name.text,
            type: member.type ? member.type.getText(source) : 'unknown',
            required: member.questionToken === undefined,
          })
        }
      }
      result = { properties, hasIndexSignature }
    }
  }
  source.forEachChild(visit)
  return result
}

function emitPropsSection(typesBlock: string): string {
  const parsed = parseTypesBlock(typesBlock)
  if (!parsed) {
    return `## Props\n\n\`\`\`ts\n${typesBlock}\n\`\`\`\n`
  }

  const rows = parsed.properties
    .map((prop) => {
      const fields = [`type: ${JSON.stringify(prop.type)}`]
      if (prop.required) fields.push('required: true')
      return `    ${prop.name}: { ${fields.join(', ')} }`
    })
    .join(',\n')

  let section = '## Props\n\n'
  if (parsed.properties.length > 0) {
    section += `<TypeTable\n  type={{\n${rows}\n  }}\n/>\n`
  }
  if (parsed.hasIndexSignature) {
    if (parsed.properties.length > 0) section += '\n'
    section += 'Plus any additional HTML attributes, forwarded to the root element.\n'
  }
  if (parsed.properties.length === 0 && !parsed.hasIndexSignature) {
    section += `<TypeTable type={{}} />\n`
  }
  return section
}

function previewHtml(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Preview</title>
  <link rel="stylesheet" href="${BASECOAT_CSS}" />
  <script src="${BASECOAT_JS}" defer></script>
  <style>
    :root { color-scheme: light; }
    body {
      font-family: system-ui, sans-serif;
      margin: 0;
      padding: 24px;
      background: var(--background, #fff);
      color: var(--foreground, #111);
      box-sizing: border-box;
    }
    .preview-root { width: 100%; max-width: 48rem; margin: 0 auto; }
  </style>
</head>
<body>
  <div class="preview-root">
${body}
  </div>
</body>
</html>
`
}

async function renderPreview(source: string): Promise<string> {
  const body = await edge.renderRaw(source.trim(), {}, join(templatesDir, 'demo.edge'))
  return previewHtml(body)
}

function emitPreviewSection(name: string, stem: string, examples: { title?: string; source: string; minHeight?: number }[]): string {
  let section = '## Preview\n\n'
  for (let i = 0; i < examples.length; i++) {
    const example = examples[i]
    const slug = i === 0 ? stem : `${stem}-${i}`
    if (examples.length > 1 && example.title) {
      section += `### ${example.title}\n\n`
    }
    const minHeight = example.minHeight ?? 160
    section += `<iframe src="/previews/${slug}.html" title="${name} preview" loading="lazy" style={{ width: '100%', minHeight: '${minHeight}px', border: '1px solid var(--color-border-tertiary)', borderRadius: '8px' }} />\n\n`
    section += `<Expandable title="Source">\n\n\`\`\`edge\n${example.source.trim()}\n\`\`\`\n\n</Expandable>\n\n`
  }
  return section
}

const files = readdirSync(componentsDir).filter((f) => f.endsWith('.edge')).sort()

for (const file of files) {
  const stem = basename(file, '.edge')
  const source = readFileSync(join(componentsDir, file), 'utf8')
  const docs = getTemplateDocs(source, file)
  const name = docs.name ?? tagName(file)
  const descFirst = docs.desc?.split('\n')[0] ?? name
  const descBody = docs.desc ?? ''
  const typesBlock = docs.types ?? '{}'

  const examples = previews[stem]
  if (!examples?.length) {
    throw new Error(`Missing preview examples for component: ${stem}`)
  }

  for (let i = 0; i < examples.length; i++) {
    const slug = i === 0 ? stem : `${stem}-${i}`
    const html = await renderPreview(examples[i].source)
    writeFileSync(join(previewsDir, `${slug}.html`), html)
  }

  const mdx = `---
title: ${name}
description: ${descFirst.replace(/"/g, '\\"')}
---

${descBody}

${emitPreviewSection(name, stem, examples)}
${emitPropsSection(typesBlock)}
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
