import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startLanguageServer } from '@volar/test-utils'
import { afterAll, expect, test } from 'bun:test'
import { URI } from 'vscode-uri'

const here = dirname(fileURLToPath(import.meta.url))
const serverModule = resolve(here, '../src/index.ts')
const tsdk = resolve(here, '../../../node_modules/typescript/lib')
const fixtureDir = resolve(here, 'fixture-strict-app')
const fixturePath = resolve(fixtureDir, 'templates/components/untyped.edge')

const server = startLanguageServer(serverModule)

afterAll(async () => {
  await server.shutdown()
  server.process.kill()
})

test('flags a template missing @types when edge.check.requireTypes matches it', async () => {
  await server.initialize(URI.file(fixtureDir).toString(), { typescript: { tsdk } })

  const document = await server.openTextDocument(fixturePath, 'edge')
  const report = await server.sendDocumentDiagnosticRequest(document.uri)
  expect(report.kind).toBe('full')
  if (report.kind !== 'full') throw new Error('expected full report')

  const diag = report.items.find((d) => d.message.includes('edge.check.requireTypes'))
  expect(diag).toBeDefined()
  expect(diag!.range).toEqual({ start: { line: 0, character: 0 }, end: { line: 0, character: 1 } })
})
