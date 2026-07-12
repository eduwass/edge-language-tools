import ts from 'typescript'
import { generateVirtualTs } from './generator.ts'
import type { ResolveTemplate, Segment, TemplateDiagnostic } from './index.ts'

export function checkTemplate(
  source: string,
  filename: string,
  opts?: { ambientTypes?: string; resolveTemplate?: ResolveTemplate },
): TemplateDiagnostic[] {
  const vf = generateVirtualTs(source, filename, { resolveTemplate: opts?.resolveTemplate })
  if (!vf.typesBlock) return []

  const virtualPath = `${filename}.virtual.ts`
  const code = opts?.ambientTypes ? `${opts.ambientTypes}\n${vf.code}` : vf.code
  const codeOffset = code.length - vf.code.length

  const host = ts.createCompilerHost({})
  const realGetSourceFile = host.getSourceFile.bind(host)
  const realReadFile = host.readFile.bind(host)
  const realFileExists = host.fileExists.bind(host)

  host.getSourceFile = (fileName, languageVersion, ...rest) => {
    if (fileName === virtualPath) {
      return ts.createSourceFile(fileName, code, languageVersion, true)
    }
    return realGetSourceFile(fileName, languageVersion, ...rest)
  }
  host.readFile = (fileName) => (fileName === virtualPath ? code : realReadFile(fileName))
  host.fileExists = (fileName) => fileName === virtualPath || realFileExists(fileName)

  const program = ts.createProgram({
    rootNames: [virtualPath],
    options: {
      strict: true,
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      noEmit: true,
      skipLibCheck: true,
    },
    host,
  })

  const sourceFile = program.getSourceFile(virtualPath)!
  const diagnostics = [
    ...program.getSyntacticDiagnostics(sourceFile),
    ...program.getSemanticDiagnostics(sourceFile),
  ]

  const result: TemplateDiagnostic[] = []
  for (const d of diagnostics) {
    if (d.file?.fileName !== virtualPath || d.start === undefined || d.length === undefined) continue
    const start = d.start - codeOffset
    const length = d.length
    const mapped = mapToSource(vf.segments, start, length)
    result.push({
      message: ts.flattenDiagnosticMessageText(d.messageText, ' '),
      code: d.code,
      start: mapped ? mapped.start : null,
      length: mapped ? mapped.length : null,
    })
  }
  return result
}

function mapToSource(segments: Segment[], start: number, length: number): { start: number; length: number } | null {
  for (const seg of segments) {
    if (start >= seg.generatedOffset && start + length <= seg.generatedOffset + seg.length) {
      return { start: seg.sourceOffset + (start - seg.generatedOffset), length }
    }
  }
  return null
}
