import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** Recursively find `*.edge` files under `dir`, skipping `node_modules`. */
export function findEdgeFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') continue
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      out.push(...findEdgeFiles(full))
    } else if (entry.endsWith('.edge')) {
      out.push(full)
    }
  }
  return out
}
