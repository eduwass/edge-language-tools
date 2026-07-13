/**
 * Opt-in strict-types config, declared per-package under `"edge": { "check": ... }`
 * in the nearest ancestor `package.json`. Discovery stops at the nearest
 * `package.json` regardless of whether it declares the key — packages without
 * the key simply have the feature off, they don't inherit from a parent package.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

export interface CheckConfig {
  requireTypes: string[]
  exclude: string[]
  severity: 'error' | 'warn'
  baseDir: string
}

interface RawCheckConfig {
  requireTypes?: string | string[]
  exclude?: string | string[]
  severity?: 'error' | 'warn'
}

const cache = new Map<string, CheckConfig | null>()

/** Walk up from `fromDir` to the nearest `package.json`; load its `edge.check` config, if any. */
export function loadCheckConfig(fromDir: string): CheckConfig | null {
  const cached = cache.get(fromDir)
  if (cached !== undefined) return cached

  const pkgPath = findNearestPackageJson(fromDir)
  const config = pkgPath ? parsePackageJson(pkgPath) : null
  cache.set(fromDir, config)
  return config
}

function findNearestPackageJson(fromDir: string): string | null {
  let dir = fromDir
  for (let depth = 0; depth < 50; depth++) {
    const candidate = join(dir, 'package.json')
    if (existsSync(candidate)) return candidate
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
  return null
}

function parsePackageJson(pkgPath: string): CheckConfig | null {
  let pkg: { edge?: { check?: RawCheckConfig } }
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  } catch {
    return null
  }
  const raw = pkg.edge?.check
  if (!raw) return null

  return {
    requireTypes: toArray(raw.requireTypes),
    exclude: toArray(raw.exclude),
    severity: raw.severity === 'warn' ? 'warn' : 'error',
    baseDir: dirname(pkgPath),
  }
}

function toArray(value: string | string[] | undefined): string[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

/** Whether `absoluteFilePath` is required to declare a `@types` block by `config`. */
export function isTypesRequired(config: CheckConfig, absoluteFilePath: string): boolean {
  const rel = relative(config.baseDir, absoluteFilePath).split('\\').join('/')
  if (config.exclude.some((pattern) => globMatch(pattern, rel))) return false
  return config.requireTypes.some((pattern) => globMatch(pattern, rel))
}

/**
 * Minimal glob matcher: `**` matches any number of path segments (incl. none),
 * `*` matches within a single segment, everything else is literal. No `?`,
 * brace expansion, or character classes.
 */
function globMatch(pattern: string, path: string): boolean {
  const regexSource = pattern
    .split('/')
    .map((segment) => {
      if (segment === '**') return '(?:[^/]+(?:/[^/]+)*)?'
      return segment.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')
    })
    .join('/')
  return new RegExp(`^${regexSource}$`).test(path)
}
