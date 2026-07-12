import { generateVirtualTs } from '@edge-language-tools/core'
import type { Segment } from '@edge-language-tools/core'
import type { CodeMapping, LanguagePlugin, VirtualCode } from '@volar/language-core'
import type {} from '@volar/typescript'
import type * as ts from 'typescript'
import type { URI } from 'vscode-uri'

export const edgeLanguagePlugin: LanguagePlugin<URI> = {
  getLanguageId(uri) {
    if (uri.path.endsWith('.edge')) return 'edge'
    return undefined
  },
  createVirtualCode(uri, languageId, snapshot) {
    if (languageId !== 'edge') return undefined
    return new EdgeVirtualCode(uri.path.split('/').pop() ?? uri.path, snapshot)
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

  constructor(filename: string, snapshot: ts.IScriptSnapshot) {
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

    const virtualFile = generateVirtualTs(source, filename)
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
