import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import type { PlaygroundSchema, PropControl } from './playground-types.ts'

export type { PlaygroundSchema, PropControl } from './playground-types.ts'

const PREVIEW_TEMPLATE_PATH = join(import.meta.dir, '../templates/preview.edge')
const previewTemplate = readFileSync(PREVIEW_TEMPLATE_PATH, 'utf8')
const BODY_PLACEHOLDER = '{{{ body }}}'
const bodyPlaceholderIndex = previewTemplate.indexOf(BODY_PLACEHOLDER)
if (bodyPlaceholderIndex === -1) {
  throw new Error('preview.edge must contain {{{ body }}}')
}
const previewBefore = previewTemplate.slice(0, bodyPlaceholderIndex)
const previewAfter = previewTemplate.slice(bodyPlaceholderIndex + BODY_PLACEHOLDER.length)

export interface PreviewRenderer {
  renderRaw(template: string, state: Record<string, unknown>, filename: string): Promise<string>
}

export function stemToTag(stem: string): string {
  return stem.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
}

export async function previewHtml(
  edge: PreviewRenderer,
  exampleSource: string,
  options?: { includeShellScripts?: boolean },
): Promise<string> {
  const tail = options?.includeShellScripts === false ? '\n</body>\n</html>\n' : previewAfter
  const template = previewBefore + exampleSource.trim() + tail
  return edge.renderRaw(template.trim(), {}, PREVIEW_TEMPLATE_PATH)
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
  const selfMarker = `@!${tag}`
  const blockMarker = `@${tag}`
  let selfClosing = false
  let start = source.indexOf(selfMarker)
  if (start !== -1) {
    selfClosing = true
  } else {
    start = source.indexOf(blockMarker)
  }
  if (start === -1) return { props: {}, slot: '' }

  const marker = selfClosing ? selfMarker : blockMarker
  let cursor = start + marker.length
  let props: Record<string, unknown> = {}

  if (source[cursor] === '(') {
    const close = matchDelimiter(source, cursor, '(', ')')
    if (close === -1) return { props: {}, slot: '' }
    props = evalObjectLiteral(source.slice(cursor + 1, close))
    cursor = close + 1
  }

  if (selfClosing) return { props, slot: '' }

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

function serializeKey(key: string): string {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)
    ? key
    : `'${key.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

export function serializeProps(props: Record<string, unknown>): string {
  const entries = Object.entries(props).filter(([, value]) => value !== undefined)
  if (entries.length === 0) return ''
  return `{ ${entries.map(([key, value]) => `${serializeKey(key)}: ${serializeValue(value)}`).join(', ')} }`
}

export function buildEdgeSource(
  tag: string,
  props: Record<string, unknown>,
  slot?: string,
): string {
  const propsLiteral = serializeProps(props)
  const trimmedSlot = slot?.trim()
  if (!trimmedSlot) {
    return propsLiteral ? `@!${tag}(${propsLiteral})` : `@!${tag}()`
  }
  const open = propsLiteral ? `@${tag}(${propsLiteral})` : `@${tag}()`
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
  const trimmedSlot = slot?.trim()
  if (!trimmedSlot) {
    return propsLiteral
      ? `@!component('components/${component}', ${propsLiteral})`
      : `@!component('components/${component}')`
  }
  const open = propsLiteral
    ? `@component('components/${component}', ${propsLiteral})`
    : `@component('components/${component}')`
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
