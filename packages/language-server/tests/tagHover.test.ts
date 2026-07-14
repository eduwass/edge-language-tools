import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startLanguageServer } from '@volar/test-utils'
import { afterAll, expect, test } from 'bun:test'
import { URI } from 'vscode-uri'

const here = dirname(fileURLToPath(import.meta.url))
const serverModule = resolve(here, '../src/index.ts')
const tsdk = resolve(here, '../../../node_modules/typescript/lib')
const fixtureDir = resolve(here, 'fixture-docs')
const probePath = resolve(fixtureDir, 'probe.edge')

const server = startLanguageServer(serverModule)

afterAll(async () => {
  await server.shutdown()
  server.process.kill()
}, 20000)

const text = [
  "@include('partials/nav')",
  '@userCard({ user: { name: "edu" } })',
  '@end',
  "@component('components/user_card', { user: { name: \"edu\" } })",
  '@end',
  '',
].join('\n')

function markdown(hover: unknown): string {
  const contents = (hover as { contents?: { value?: string } } | null)?.contents
  return contents?.value ?? ''
}

test('hovering a builtin tag shows its doc', async () => {
  await server.initialize(URI.file(fixtureDir).toString(), { typescript: { tsdk } })
  const document = await server.openInMemoryDocument(probePath, 'edge', text)
  const hover = await server.sendHoverRequest(document.uri, { line: 0, character: 3 })
  expect(markdown(hover)).toContain('partial')
}, 20000)

test('hovering a supercharged tag shows the component doc header', async () => {
  const document = await server.openInMemoryDocument(probePath, 'edge', text)
  const hover = await server.sendHoverRequest(document.uri, { line: 1, character: 4 })
  const value = markdown(hover)
  expect(value).toContain('User Card')
  expect(value).toContain('Displays a user card')
  expect(value).toContain('user: { name: string }')
}, 20000)

test('hovering a template path string shows the target doc header', async () => {
  const document = await server.openInMemoryDocument(probePath, 'edge', text)
  const character = text.split('\n')[3]!.indexOf('user_card')
  const hover = await server.sendHoverRequest(document.uri, { line: 3, character })
  expect(markdown(hover)).toContain('User Card')
}, 20000)

test('go-to-definition on a supercharged tag jumps to the component file', async () => {
  const document = await server.openInMemoryDocument(probePath, 'edge', text)
  const definition = await server.sendDefinitionRequest(document.uri, { line: 1, character: 4 })
  const links = Array.isArray(definition) ? definition : [definition]
  const uris = links.map((l) => (l as { targetUri?: string; uri?: string }).targetUri ?? (l as { uri?: string }).uri)
  expect(uris.some((u) => u?.endsWith('components/user_card.edge'))).toBe(true)
}, 20000)

// Regression: an unparseable template (routine mid-typing state) used to throw
// out of createVirtualCode and kill the whole language server.
test('unparseable template does not kill the server', async () => {
  const broken = resolve(fixtureDir, 'broken.edge')
  await server.openInMemoryDocument(broken, 'edge', '@component(\n')
  const document = await server.openInMemoryDocument(probePath, 'edge', text)
  const hover = await server.sendHoverRequest(document.uri, { line: 0, character: 3 })
  expect(markdown(hover)).toContain('partial')
}, 20000)
