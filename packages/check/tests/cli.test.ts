import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'

const fixturesDir = join(import.meta.dir, '..', '..', 'core', 'fixtures')
const cliPath = join(import.meta.dir, '..', 'src', 'cli.ts')

describe('edge-check cli', () => {
  test('human output: exit 1, reports typo-prop diagnostic at the right line:col', () => {
    const result = Bun.spawnSync(['bun', cliPath, fixturesDir])
    const stdout = result.stdout.toString('utf8')

    expect(result.exitCode).toBe(1)
    // typo-prop/input.edge: `{{ user.nmae }}` on line 6
    expect(stdout).toMatch(/typo-prop[/\\]input\.edge:6:13/)
    expect(stdout).toContain('nmae')
  })

  test('--format json: parses, correct diagnostic count', () => {
    const result = Bun.spawnSync(['bun', cliPath, fixturesDir, '--format', 'json'])
    const diagnostics = JSON.parse(result.stdout.toString('utf8')) as unknown[]

    // typo-prop, each-loop, unknown-var, each-index-typo each contribute 1
    expect(diagnostics.length).toBe(4)
    expect(result.exitCode).toBe(1)
  })
})
