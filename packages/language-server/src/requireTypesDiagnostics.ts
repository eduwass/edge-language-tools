import { generateVirtualTs, isTypesRequired, loadCheckConfig } from '@edge-language-tools/core'
import type { LanguageServicePlugin } from '@volar/language-service'
import { dirname } from 'node:path'
import { DiagnosticSeverity } from 'vscode-languageserver-protocol'
import { URI } from 'vscode-uri'

const REQUIRE_TYPES_MESSAGE = 'template requires a @types block (edge.check.requireTypes)'

/** Flags open `.edge` documents that need — but lack — a `@types` block per `edge.check.requireTypes` config. */
export function createRequireTypesDiagnosticsPlugin(): LanguageServicePlugin {
  return {
    name: 'edge-require-types-diagnostics',
    capabilities: {
      diagnosticProvider: { interFileDependencies: false, workspaceDiagnostics: false },
    },
    create(context) {
      return {
        provideDiagnostics(document) {
          if (document.languageId !== 'edge') return undefined

          const decoded = context.decodeEmbeddedDocumentUri(URI.parse(document.uri))
          const sourceUri = decoded ? decoded[0] : URI.parse(document.uri)
          const filePath = sourceUri.fsPath

          const config = loadCheckConfig(dirname(filePath))
          if (!config || !isTypesRequired(config, filePath)) return []

          const vf = generateVirtualTs(document.getText(), filePath)
          if (vf.typesBlock) return []

          return [
            {
              range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
              severity: config.severity === 'error' ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning,
              source: 'edge-check',
              message: REQUIRE_TYPES_MESSAGE,
            },
          ]
        },
      }
    },
  }
}
