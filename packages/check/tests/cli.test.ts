import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'

const fixturesDir = join(import.meta.dir, '..', '..', 'core', 'fixtures')
const cliPath = join(import.meta.dir, '..', 'src', 'cli.ts')

describe('edge-check cli', () => {
  test('human output: exit 1, reports typo-prop diagnostic at the right line:col', () => {
    const result = Bun.spawnSync(['bun', cliPath, fixturesDir], { timeout: 30_000 })
    const stdout = result.stdout.toString('utf8')

    expect(result.exitCode).toBe(1)
    // typo-prop/input.edge: `{{ user.nmae }}` on line 6
    expect(stdout).toMatch(/typo-prop[/\\]input\.edge:6:13/)
    expect(stdout).toContain('nmae')
  }, 30_000)

  test('--format json: parses, correct diagnostic count', () => {
    const result = Bun.spawnSync(['bun', cliPath, fixturesDir, '--format', 'json'], { timeout: 30_000 })
    const diagnostics = JSON.parse(result.stdout.toString('utf8')) as unknown[]

    // one per fixture that declares an expected diagnostic in diagnostics.json
    expect(diagnostics.length).toBe(22)
    expect(result.exitCode).toBe(1)
  }, 30_000)
})
