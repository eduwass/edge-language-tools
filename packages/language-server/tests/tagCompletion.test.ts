import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startLanguageServer } from '@volar/test-utils'
import { afterAll, expect, test } from 'bun:test'
import { URI } from 'vscode-uri'
import { superchargedTagName } from '../src/tagCompletion.ts'

const here = dirname(fileURLToPath(import.meta.url))
const serverModule = resolve(here, '../src/index.ts')
const tsdk = resolve(here, '../../../node_modules/typescript/lib')
const fixtureDir = resolve(here, '../../core/fixtures/supercharged-snake-case')
const probePath = resolve(fixtureDir, 'probe.edge')

const server = startLanguageServer(serverModule)

afterAll(async () => {
  await server.shutdown()
  server.process.kill()
})

// The four filename→tagName examples from https://edgejs.dev/docs/components/introduction
test('forward supercharged mapping matches edge.js docs', () => {
  expect(superchargedTagName('components/form/input')).toBe('form.input')
  expect(superchargedTagName('components/tool_tip')).toBe('toolTip')
  expect(superchargedTagName('components/checkout_form/input')).toBe('checkoutForm.input')
  expect(superchargedTagName('components/modal/index')).toBe('modal')
  expect(superchargedTagName('pages/home')).toBeNull()
})

test('typing @ offers built-in tags and supercharged component tags', async () => {
  await server.initialize(URI.file(fixtureDir).toString(), { typescript: { tsdk } })

  const text = '<p>hi</p>\n@too'
  const document = await server.openInMemoryDocument(probePath, 'edge', text)
  const list = await server.sendCompletionRequest(document.uri, { line: 1, character: 4 })

  expect(list).not.toBeNull()
  const items = Array.isArray(list) ? list : (list?.items ?? [])
  const byLabel = new Map(items.map((item: { label: string }) => [item.label, item]))
  expect(byLabel.has('toolTip')).toBe(true)
  expect(byLabel.has('if')).toBe(true)
  expect(byLabel.has('include')).toBe(true)
})

test('@ mid-prose does not offer tag completions', async () => {
  const text = 'email me at foo@bar\n'
  const document = await server.openInMemoryDocument(probePath, 'edge', text)
  const list = await server.sendCompletionRequest(document.uri, { line: 0, character: 16 })
  const items = Array.isArray(list) ? list : (list?.items ?? [])
  const labels = items.map((item: { label: string }) => item.label)
  expect(labels).not.toContain('toolTip')
})
