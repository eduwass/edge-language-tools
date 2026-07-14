import ts from 'typescript'
import type { PlaygroundSchema, PropControl } from './playground-types.ts'

export type { PlaygroundSchema, PropControl } from './playground-types.ts'

export const BASECOAT_CSS =
  'https://cdn.jsdelivr.net/npm/basecoat-css@1.0.2/dist/basecoat.cdn.min.css'
export const BASECOAT_JS =
  'https://cdn.jsdelivr.net/npm/basecoat-css@1.0.2/dist/js/all.min.js'

export function stemToTag(stem: string): string {
  return stem.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
}

export function previewHtml(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Preview</title>
  <link rel="stylesheet" href="${BASECOAT_CSS}" />
  <script src="${BASECOAT_JS}" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/basecoat-css@1.0.2/dist/js/chart.min.js" defer></script>
  <style>
    :root { color-scheme: light dark; }
    body {
      font-family: system-ui, sans-serif;
      margin: 0;
      padding: 24px;
      background: var(--background, Canvas);
      color: var(--foreground, CanvasText);
      box-sizing: border-box;
    }
    .preview-root { width: 100%; max-width: 48rem; margin: 0 auto; }
  </style>
  <script>
    // Follow the docs site's theme: blume stamps data-theme on its root, and
    // previews are same-origin, so the parent document is readable. Falls
    // back to the OS preference when embedded elsewhere. Basecoat's dark
    // palette activates via the .dark class.
    ;(function () {
      function apply() {
        var dark
        try {
          var t = parent.document.documentElement.dataset.theme
          dark = t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
        } catch (e) {
          dark = matchMedia('(prefers-color-scheme: dark)').matches
        }
        document.documentElement.classList.toggle('dark', dark)
      }
      apply()
      setInterval(apply, 500)
    })()
  </script>
</head>
<body>
  <div class="preview-root">
${body}
  </div>
</body>
</html>
`
}

export function classifyPropType(type: string): PropControl | null {
  const trimmed = type.trim()
  if (trimmed === 'boolean') return { kind: 'toggle' }
  if (trimmed === 'string') return { kind: 'text' }

  const parts = trimmed.split('|').map((part) => part.trim())
  if (parts.length > 1 && parts.every((part) => /^'[^']*'$/.test(part))) {
    return { kind: 'select', options: parts.map((part) => part.slice(1, -1)) }
  }
  return null
}

function matchDelimiter(text: string, openIndex: number, open: string, close: string): number {
  let depth = 0
  let inSingle = false
  let inDouble = false
  let escaped = false

  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i]
    if (escaped) {
      escaped = false
      continue
    }
    if (ch === '\\') {
      escaped = true
      continue
    }
    if (!inDouble && ch === "'") {
      inSingle = !inSingle
      continue
    }
    if (!inSingle && ch === '"') {
      inDouble = !inDouble
      continue
    }
    if (inSingle || inDouble) continue
    if (ch === open) depth++
    else if (ch === close) {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

function evalObjectLiteral(literal: string): Record<string, unknown> {
  const trimmed = literal.trim()
  if (!trimmed) return {}
  try {
    return new Function(`return (${trimmed})`)() as Record<string, unknown>
  } catch {
    return {}
  }
}

/** Parse the first supercharged tag call from a preview Edge snippet. */
export function parsePreviewExample(
  source: string,
  tag: string,
): { props: Record<string, unknown>; slot: string } {
  const marker = `@${tag}`
  const start = source.indexOf(marker)
  if (start === -1) return { props: {}, slot: '' }

  let cursor = start + marker.length
  let props: Record<string, unknown> = {}

  if (source[cursor] === '(') {
    const close = matchDelimiter(source, cursor, '(', ')')
    if (close === -1) return { props: {}, slot: '' }
    props = evalObjectLiteral(source.slice(cursor + 1, close))
    cursor = close + 1
  }

  const bodyStart = source.indexOf('\n', cursor)
  if (bodyStart === -1) return { props, slot: '' }

  const slotEnd = findMatchingEnd(source, bodyStart + 1)
  if (slotEnd === -1) return { props, slot: '' }

  const slot = source.slice(bodyStart + 1, slotEnd).replace(/\n$/, '')
  return { props, slot }
}

const BLOCK_OPEN = /^\s*@(?!end\b|svg\b|!)([\w.]+)/
const BLOCK_CLOSE = /^\s*@end\b/

function findMatchingEnd(source: string, bodyStart: number): number {
  const lines = source.slice(bodyStart).split('\n')
  let offset = bodyStart
  let depth = 1

  for (const line of lines) {
    if (BLOCK_CLOSE.test(line)) {
      depth--
      if (depth === 0) return offset
    } else if (BLOCK_OPEN.test(line)) {
      depth++
    }
    offset += line.length + 1
  }

  return -1
}

export function serializeValue(value: unknown): string {
  if (typeof value === 'string') {
    return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return String(value)
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  return JSON.stringify(value)
}

export function serializeProps(props: Record<string, unknown>): string {
  const entries = Object.entries(props).filter(([, value]) => value !== undefined)
  if (entries.length === 0) return ''
  return `{ ${entries.map(([key, value]) => `${key}: ${serializeValue(value)}`).join(', ')} }`
}

export function buildEdgeSource(
  tag: string,
  props: Record<string, unknown>,
  slot?: string,
): string {
  const propsLiteral = serializeProps(props)
  const open = propsLiteral ? `@${tag}(${propsLiteral})` : `@${tag}()`
  const trimmedSlot = slot?.trim()
  if (!trimmedSlot) return `${open}\n@end`
  const indented = trimmedSlot
    .split('\n')
    .map((line) => (line.length > 0 ? `  ${line}` : ''))
    .join('\n')
  return `${open}\n${indented}\n@end`
}

export function buildRenderTemplate(
  component: string,
  props: Record<string, unknown>,
  slot?: string,
): string {
  const propsLiteral = serializeProps(props)
  const open = propsLiteral
    ? `@component('components/${component}', ${propsLiteral})`
    : `@component('components/${component}')`
  const trimmedSlot = slot?.trim()
  if (!trimmedSlot) return `${open}\n@end`
  return `${open}\n${trimmedSlot}\n@end`
}

interface ParsedProperty {
  name: string
  type: string
}

export function buildPlaygroundControls(properties: ParsedProperty[]): Record<string, PropControl> {
  const controls: Record<string, PropControl> = {}
  for (const prop of properties) {
    const control = classifyPropType(prop.type)
    if (control) controls[prop.name] = control
  }
  return controls
}

export function parseTypeProperties(objectLiteral: string): ParsedProperty[] {
  const trimmed = objectLiteral.trim()
  if (!trimmed.startsWith('{')) return []

  const wrapper = `type __T = ${trimmed}`
  const source = ts.createSourceFile('__types.ts', wrapper, ts.ScriptTarget.Latest, true)
  const properties: ParsedProperty[] = []

  const visit = (node: ts.Node) => {
    if (ts.isTypeAliasDeclaration(node) && ts.isTypeLiteralNode(node.type)) {
      for (const member of node.type.members) {
        if (ts.isIndexSignatureDeclaration(member)) continue
        if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name)) {
          properties.push({
            name: member.name.text,
            type: member.type ? member.type.getText(source) : 'unknown',
          })
        }
      }
    }
  }
  source.forEachChild(visit)
  return properties
}
