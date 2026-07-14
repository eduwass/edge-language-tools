import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startLanguageServer } from '@volar/test-utils'
import { afterAll, expect, test } from 'bun:test'
import { URI } from 'vscode-uri'

const here = dirname(fileURLToPath(import.meta.url))
const serverModule = resolve(here, '../src/index.ts')
const tsdk = resolve(here, '../../../node_modules/typescript/lib')
const fixtureDir = resolve(here, '../../core/fixtures/types-import-ok')
const probePath = resolve(fixtureDir, 'probe.edge')

const server = startLanguageServer(serverModule)

afterAll(async () => {
  await server.shutdown()
  server.process.kill()
})

// The @types body is verbatim-mapped TS, so tsserver completions work inside it.
test('completes exported type names inside a @types import expression', async () => {
  await server.initialize(URI.file(fixtureDir).toString(), { typescript: { tsdk } })

  const text = "{{-- @types import('./props.ts'). --}}\n<p>static</p>\n"
  const character = text.indexOf(').') + 2
  const document = await server.openInMemoryDocument(probePath, 'edge', text)
  const completions = await server.sendCompletionRequest(document.uri, { line: 0, character })

  const labels = (Array.isArray(completions) ? completions : (completions?.items ?? [])).map(
    (item: { label: string }) => item.label,
  )
  expect(labels).toContain('Props')
})
