#!/usr/bin/env bun
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve as resolvePath } from 'node:path'
import {
  checkTemplate,
  findEdgeFiles,
  generateVirtualTs,
  isTypesRequired,
  loadCheckConfig,
} from '@edge-language-tools/core'
import type { ResolveTemplate } from '@edge-language-tools/core'
import { excerpt, offsetToLineCol, withColor } from './format.ts'

/** Resolves `@include`/`@component` names ('partials/foo' or 'partials.foo') relative to the scanned root. */
function resolveTemplate(root: string): ResolveTemplate {
  return (name) => {
    const path = join(root, `${name.replace(/\./g, '/')}.edge`)
    if (!existsSync(path)) return null
    return { source: readFileSync(path, 'utf8'), filename: relative(process.cwd(), path) }
  }
}

interface JsonDiagnostic {
  file: string
  line: number
  col: number
  start: number
  length: number
  code: number | string
  message: string
  severity?: 'error' | 'warn'
}

const REQUIRE_TYPES_MESSAGE = 'template requires a @types block (edge.check.requireTypes)'

function main(): number {
  const args = process.argv.slice(2)
  const format = args.includes('--format') ? args[args.indexOf('--format') + 1] : 'text'
  const dir = args.find((a) => !a.startsWith('--') && a !== format) ?? '.'

  const files = findEdgeFiles(dir)
  const resolve = resolveTemplate(dir)
  const c = withColor(process.stdout.isTTY === true)

  let errorCount = 0
  let warningCount = 0
  let uncheckedCount = 0
  const jsonDiagnostics: JsonDiagnostic[] = []

  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    const rel = relative(process.cwd(), file)
    const vf = generateVirtualTs(source, rel, { resolveTemplate: resolve })
    if (!vf.typesBlock) {
      uncheckedCount++

      const config = loadCheckConfig(dirname(resolvePath(file)))
      if (config && isTypesRequired(config, resolvePath(file))) {
        if (config.severity === 'error') errorCount++
        else warningCount++

        if (format === 'json') {
          jsonDiagnostics.push({
            file: rel,
            line: 1,
            col: 1,
            start: 0,
            length: 0,
            code: 'requireTypes',
            message: REQUIRE_TYPES_MESSAGE,
            severity: config.severity,
          })
        } else {
          const label = config.severity === 'error' ? c.red('error') : c.dim('warning')
          console.log(`${c.bold(`${rel}:1:1`)} - ${label} edge-check: ${REQUIRE_TYPES_MESSAGE}`)
          console.log()
        }
      }
      continue
    }

    const diagnostics = checkTemplate(source, rel, { resolveTemplate: resolve })
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
    const warningSuffix = warningCount > 0 ? `, ${warningCount} warning${warningCount === 1 ? '' : 's'}` : ''
    if (errorCount === 0) {
      console.log(
        c.bold(
          `all clean (${checkedCount} checked, ${uncheckedCount} unchecked, ${files.length} total)${warningSuffix}`,
        ),
      )
    } else {
      console.log(
        c.bold(
          `${errorCount} error${errorCount === 1 ? '' : 's'} across ${checkedCount} checked template${checkedCount === 1 ? '' : 's'} (${uncheckedCount} unchecked, ${files.length} total)${warningSuffix}`,
        ),
      )
    }
  }

  return errorCount > 0 ? 1 : 0
}

process.exit(main())
