import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import ts from 'typescript'
import { buildClient } from '../src/build.ts'
import { renderExportName } from '../src/names.ts'

const fixturesDir = join(import.meta.dir, 'fixtures', 'mini', 'templates')
const cliPath = join(import.meta.dir, '..', 'src', 'cli.ts')

const tempDirs: string[] = []
function tempOut(): string {
  const dir = mkdtempSync(join(tmpdir(), 'edge-client-test-'))
  tempDirs.push(dir)
  return dir
}

function writeFixture(root: string, rel: string, content: string): void {
  const file = join(root, rel)
  mkdirSync(join(file, '..'), { recursive: true })
  writeFileSync(file, content)
}

afterEach(() => {
  while (tempDirs.length > 0) rmSync(tempDirs.pop()!, { recursive: true, force: true })
})

describe('edge-client build', () => {
  test('selects @client templates and their @client dependency closure', () => {
    const out = tempOut()
    const result = buildClient({ templatesDir: fixturesDir, outDir: out, format: 'ts' })
    expect(result.templates).toEqual(['components/button', 'components/card'])
  })

  test('non-client dependency fails with chain', () => {
    const root = tempOut()
    writeFixture(
      root,
      'components/badge.edge',
      readFileSync(join(fixturesDir, 'components/badge.edge'), 'utf8'),
    )
    writeFixture(
      root,
      'components/uses_badge.edge',
      `{{--
@client
@types { title: string }
--}}
@component('components/badge', { text: title })
@end
`,
    )
    const out = tempOut()
    expect(() => buildClient({ templatesDir: root, outDir: out, format: 'ts' })).toThrow(
      /non-client dependency: components\/badge/,
    )
  })

  test('unknown identifier fails with file location', () => {
    const root = tempOut()
    writeFixture(
      root,
      'components/bad_ident.edge',
      `{{--
@client
@types {
  ok: string
}
--}}
<p>{{ mystery }}</p>
`,
    )
    const out = tempOut()
    expect(() => buildClient({ templatesDir: root, outDir: out, format: 'ts' })).toThrow(
      /components\/bad_ident:7:7: unknown identifier 'mystery'/,
    )
  })

  test('emitted module renders HTML with escaping and composition', async () => {
    const out = tempOut()
    buildClient({ templatesDir: fixturesDir, outDir: out, format: 'ts' })

    const mod = await import(join(out, 'templates.ts'))
    const html = await mod.renderButton(
      { label: 'Save', variant: 'outline', raw: '<x>' },
      { main: async () => 'Save' },
    )
    expect(html).toContain('data-variant="outline"')
    expect(html).toContain('&lt;x&gt;')
    expect(html).toContain('Save')

    const cardHtml = await mod.renderCard({ title: 'Hello' })
    expect(cardHtml).toContain('<h2>Hello</h2>')
    expect(cardHtml).toContain('data-variant="outline"')
    expect(cardHtml).toContain('Hello')
  })

  test('typed exports reject wrong props (tsc)', () => {
    const out = tempOut()
    buildClient({ templatesDir: fixturesDir, outDir: out, format: 'ts' })

    const snippetPath = join(out, 'typecheck-snippet.ts')
    const templatesPath = join(out, 'templates.ts')
    const source = `import { renderButton } from '${templatesPath}'
renderButton({ label: 123 })
`
    Bun.write(snippetPath, source)

    const options: ts.CompilerOptions = {
      strict: true,
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      noEmit: true,
    }
    const host = ts.createCompilerHost(options)
    const program = ts.createProgram([snippetPath, templatesPath, join(out, 'runtime.ts')], options, host)
    const diags = ts.getPreEmitDiagnostics(program).filter((d) => d.category === ts.DiagnosticCategory.Error)
    expect(diags.length).toBeGreaterThan(0)
  })

  test('cli exits 1 on build errors', () => {
    const root = tempOut()
    writeFixture(
      root,
      'components/bad_ident.edge',
      `{{--
@client
@types {
  ok: string
}
--}}
<p>{{ mystery }}</p>
`,
    )
    const out = tempOut()
    const result = Bun.spawnSync(['bun', cliPath, 'build', root, '--out', out], { timeout: 30_000 })
    expect(result.exitCode).toBe(1)
  })

  test('export names follow path convention', () => {
    expect(renderExportName('components/button')).toBe('renderButton')
    expect(renderExportName('components/user_card')).toBe('renderUserCard')
  })
})

// Regression: --format js once emitted TypeScript syntax that bun's test
// runner strips transparently, so it passed here and broke in every real
// browser ("Unexpected identifier 'CompiledTemplate'"). Validate the emitted
// module with actual Node, which does not strip types from ESM input.
test('emitted js is genuine JavaScript (node parses it)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'edge-client-js-'))
  buildClient({ templatesDir: fixturesDir, outDir: dir, format: "js" })
  for (const file of ['templates.js', 'runtime.js']) {
    const result = Bun.spawnSync(['node', '--input-type=module', '--check'], {
      stdin: Buffer.from(readFileSync(join(dir, file))),
    })
    expect(result.exitCode).toBe(0)
  }
})
