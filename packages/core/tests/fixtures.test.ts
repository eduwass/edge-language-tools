import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { generateVirtualTs, checkTemplate } from '../src/index.ts'

const fixturesDir = join(import.meta.dir, '..', 'fixtures')
const fixtures = readdirSync(fixturesDir).filter((d) =>
  existsSync(join(fixturesDir, d, 'input.edge')),
)

interface ExpectedDiagnostic {
  messageIncludes: string
  /** exact source substring the diagnostic must span (first occurrence) */
  atText: string
}

for (const name of fixtures) {
  const dir = join(fixturesDir, name)
  const source = readFileSync(join(dir, 'input.edge'), 'utf8')
  const expected: ExpectedDiagnostic[] = JSON.parse(
    readFileSync(join(dir, 'diagnostics.json'), 'utf8'),
  )

  describe(name, () => {
    test('virtual TS snapshot', () => {
      const vf = generateVirtualTs(source, `${name}.edge`)
      expect(vf.code).toMatchSnapshot()
    })

    test('segments round-trip: generated text equals source text', () => {
      const vf = generateVirtualTs(source, `${name}.edge`)
      for (const seg of vf.segments) {
        const src = source.slice(seg.sourceOffset, seg.sourceOffset + seg.length)
        const gen = vf.code.slice(seg.generatedOffset, seg.generatedOffset + seg.length)
        expect(gen).toBe(src)
      }
    })

    test('diagnostics match expectations', () => {
      const diags = checkTemplate(source, `${name}.edge`)
      expect(diags.length).toBe(expected.length)
      for (const exp of expected) {
        const match = diags.find((d) => d.message.includes(exp.messageIncludes))
        expect(match).toBeDefined()
        const wantStart = source.indexOf(exp.atText)
        expect(match!.start).toBe(wantStart)
        expect(match!.length).toBe(exp.atText.length)
      }
    })
  })
}
