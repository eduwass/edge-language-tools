import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startLanguageServer } from '@volar/test-utils'
import { afterAll, expect, test } from 'bun:test'
import { URI } from 'vscode-uri'

const here = dirname(fileURLToPath(import.meta.url))
const serverModule = resolve(here, '../src/index.ts')
const tsdk = resolve(here, '../../../node_modules/typescript/lib')
const fixtureDir = resolve(here, '../../core/fixtures/component-props-ok')
const fixturePath = resolve(fixtureDir, 'input.edge')

const server = startLanguageServer(serverModule)

afterAll(async () => {
  await server.shutdown()
  server.process.kill()
})

test('completes template names inside @component string', async () => {
  await server.initialize(URI.file(fixtureDir).toString(), { typescript: { tsdk } })

  const document = await server.openTextDocument(fixturePath, 'edge')
  // line 5 (0-indexed) is `@component('card', { title: user.name, count: 3 })`
  const position = { line: 5, character: "@component('".length }
  const list = await server.sendCompletionRequest(document.uri, position)

  expect(list).not.toBeNull()
  const labels = list!.items.map((item) => item.label)
  expect(labels).toContain('card')
})
