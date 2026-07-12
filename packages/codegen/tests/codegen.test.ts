import { describe, expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { generateTemplatesDts } from '../src/generate.ts'

const fixtureDir = join(import.meta.dir, 'fixture-app')
const outFile = join(fixtureDir, 'edge-templates.d.ts')

describe('generateTemplatesDts', () => {
  test('emits EdgeTemplates keys for templates with @types, skips untyped', () => {
    const dts = generateTemplatesDts(fixtureDir)
    expect(dts).toContain(`"templates/profile"`)
    expect(dts).toContain(`"templates/list"`)
    expect(dts).not.toContain(`"templates/untyped"`)
  })

  test('fixture app typechecks: correct props pass, wrong props are caught, untyped templates stay open', () => {
    writeFileSync(outFile, generateTemplatesDts(fixtureDir))

    const tscBin = join(import.meta.dir, '..', '..', '..', 'node_modules', '.bin', 'tsc')
    let output = ''
    let exitCode = 0
    try {
      output = execFileSync(tscBin, ['-p', join(fixtureDir, 'tsconfig.json')], {
        encoding: 'utf8',
      })
    } catch (err) {
      exitCode = (err as { status: number }).status
      output = String((err as { stdout: Buffer }).stdout)
    }

    expect(output).toBe('')
    expect(exitCode).toBe(0)
  })
})
