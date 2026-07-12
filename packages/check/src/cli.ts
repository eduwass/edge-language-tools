#!/usr/bin/env bun
import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { checkTemplate, generateVirtualTs } from '@edge-language-tools/core'
import { excerpt, offsetToLineCol, withColor } from './format.ts'
import { findEdgeFiles } from './walk.ts'

interface JsonDiagnostic {
  file: string
  line: number
  col: number
  start: number
  length: number
  code: number
  message: string
}

function main(): number {
  const args = process.argv.slice(2)
  const format = args.includes('--format') ? args[args.indexOf('--format') + 1] : 'text'
  const dir = args.find((a) => !a.startsWith('--') && a !== format) ?? '.'

  const files = findEdgeFiles(dir)
  const c = withColor(process.stdout.isTTY === true)

  let errorCount = 0
  let uncheckedCount = 0
  const jsonDiagnostics: JsonDiagnostic[] = []

  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    const rel = relative(process.cwd(), file)
    const vf = generateVirtualTs(source, rel)
    if (!vf.typesBlock) {
      uncheckedCount++
      continue
    }

    const diagnostics = checkTemplate(source, rel)
    for (const d of diagnostics) {
      errorCount++
      if (d.start === null || d.length === null) {
        if (format === 'json') {
          jsonDiagnostics.push({
            file: rel,
            line: 0,
            col: 0,
            start: -1,
            length: 0,
            code: d.code,
            message: d.message,
          })
        } else {
          console.log(`${c.bold(rel)}: ${c.red(d.message)}`)
        }
        continue
      }

      const { line, col } = offsetToLineCol(source, d.start)
      if (format === 'json') {
        jsonDiagnostics.push({
          file: rel,
          line,
          col,
          start: d.start,
          length: d.length,
          code: d.code,
          message: d.message,
        })
      } else {
        console.log(`${c.bold(`${rel}:${line}:${col}`)} - ${c.red(`error TS${d.code}`)}: ${d.message}`)
        console.log(c.dim(excerpt(source, d.start, d.length)))
        console.log()
      }
    }
  }

  if (format === 'json') {
    console.log(JSON.stringify(jsonDiagnostics))
  } else {
    const checkedCount = files.length - uncheckedCount
    if (errorCount === 0) {
      console.log(
        c.bold(
          `all clean (${checkedCount} checked, ${uncheckedCount} unchecked, ${files.length} total)`,
        ),
      )
    } else {
      console.log(
        c.bold(
          `${errorCount} error${errorCount === 1 ? '' : 's'} across ${checkedCount} checked template${checkedCount === 1 ? '' : 's'} (${uncheckedCount} unchecked, ${files.length} total)`,
        ),
      )
    }
  }

  return errorCount > 0 ? 1 : 0
}

process.exit(main())
