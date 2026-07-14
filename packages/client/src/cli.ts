#!/usr/bin/env node
import { resolve } from 'node:path'
import { buildClientOrExit } from './build.ts'

function main(): number {
  const args = process.argv.slice(2)
  if (args[0] !== 'build') {
    console.error('usage: edge-client build <templates-dir> --out <dir> [--format ts|js]')
    return 1
  }

  const dir = args.find((a, i) => !a.startsWith('--') && i > 0) ?? '.'
  const outFlag = args.indexOf('--out')
  if (outFlag === -1 || !args[outFlag + 1]) {
    console.error('missing required --out <dir>')
    return 1
  }

  const formatFlag = args.indexOf('--format')
  const formatRaw = formatFlag !== -1 ? args[formatFlag + 1] : 'ts'
  if (formatRaw !== 'ts' && formatRaw !== 'js') {
    console.error('--format must be ts or js')
    return 1
  }

  return buildClientOrExit({
    templatesDir: resolve(dir),
    outDir: resolve(args[outFlag + 1]!),
    format: formatRaw,
  })
}

process.exit(main())
