#!/usr/bin/env node
import { watch } from 'node:fs'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { generateTemplatesDts } from './generate.ts'

function main(): void {
  const args = process.argv.slice(2)
  const outFlag = args.indexOf('--out')
  const out = outFlag !== -1 ? args[outFlag + 1] : 'edge-templates.d.ts'
  const watchMode = args.includes('--watch')
  const dir = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--out') ?? '.'

  const dirPath = resolve(dir)
  const outPath = resolve(out!)

  const run = () => {
    writeFileSync(outPath, generateTemplatesDts(dirPath))
    console.log(`wrote ${out}`)
  }

  run()
  if (!watchMode) return

  let timer: ReturnType<typeof setTimeout> | null = null
  watch(dirPath, { recursive: true }, (_event, filename) => {
    if (!filename?.endsWith('.edge')) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(run, 100)
  })
  console.log(`watching ${dir} for .edge changes`)
}

main()
