import { generateVirtualTs } from '@edge-language-tools/core'
import type { ResolveTemplate, Segment } from '@edge-language-tools/core'
import type { CodeMapping, LanguagePlugin, VirtualCode } from '@volar/language-core'
import type {} from '@volar/typescript'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type * as ts from 'typescript'
import type { URI } from 'vscode-uri'

/**
 * Resolve Edge template names ('partials/nav', 'partials.nav') by probing each
 * ancestor directory of the referencing file for `<dir>/<name>.edge`. The
 * templates root isn't knowable statically, so nearest-ancestor-first mirrors
 * how projects nest templates in practice.
 */
function makeResolver(fromFile: string): ResolveTemplate {
  return (name) => {
    const rel = `${name.replace(/\./g, '/')}.edge`
    let dir = dirname(fromFile)
    for (let depth = 0; depth < 10; depth++) {
      const candidate = join(dir, rel)
      if (existsSync(candidate)) {
        return { source: readFileSync(candidate, 'utf8'), filename: candidate }
      }
      const parent = dirname(dir)
      if (parent === dir) break
      dir = parent
    }
    return null
  }
}

export const edgeLanguagePlugin: LanguagePlugin<URI> = {
  getLanguageId(uri) {
    if (uri.path.endsWith('.edge')) return 'edge'
    return undefined
  },
  createVirtualCode(uri, languageId, snapshot) {
    if (languageId !== 'edge') return undefined
    return new EdgeVirtualCode(uri.path, snapshot)
  },
  typescript: {
    extraFileExtensions: [{ extension: 'edge', isMixedContent: true, scriptKind: 7 satisfies ts.ScriptKind.Deferred }],
    getServiceScript(root) {
      for (const code of root.embeddedCodes ?? []) {
        if (code.id === 'ts') {
          return { code, extension: '.ts', scriptKind: 3 satisfies ts.ScriptKind.TS }
        }
      }
      return undefined
    },
  },
}

export class EdgeVirtualCode implements VirtualCode {
  id = 'root'
  languageId = 'edge'
  mappings: CodeMapping[]
  embeddedCodes: VirtualCode[]
  snapshot: ts.IScriptSnapshot

  constructor(filePath: string, snapshot: ts.IScriptSnapshot) {
    this.snapshot = snapshot
    const source = snapshot.getText(0, snapshot.getLength())

    this.mappings = [
      {
        sourceOffsets: [0],
        generatedOffsets: [0],
        lengths: [source.length],
        data: { completion: false, format: false, navigation: false, semantic: false, structure: true, verification: false },
      },
    ]

    // ponytail: resolver reads target templates from disk per regeneration and edits
    // to a component's @types don't invalidate open callers until they change too.
    const virtualFile = generateVirtualTs(source, filePath, {
      resolveTemplate: makeResolver(filePath),
    })
    this.embeddedCodes = [
      {
        id: 'ts',
        languageId: 'typescript',
        snapshot: {
          getText: (start, end) => virtualFile.code.substring(start, end),
          getLength: () => virtualFile.code.length,
          getChangeRange: () => undefined,
        },
        mappings: toCodeMappings(virtualFile.segments),
        embeddedCodes: [],
      },
    ]
  }
}

function toCodeMappings(segments: Segment[]): CodeMapping[] {
  return segments.map((segment) => ({
    sourceOffsets: [segment.sourceOffset],
    generatedOffsets: [segment.generatedOffset],
    lengths: [segment.length],
    data: { completion: true, format: false, navigation: true, semantic: true, structure: true, verification: true },
  }))
}
