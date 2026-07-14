import { Edge } from 'edge.js'

export type CompiledTemplateFn = (
  template: unknown,
  state: Record<string, unknown>,
  $context: Record<string, unknown>,
) => Promise<string>

export function extractFunctionBody(fn: Function): string {
  const src = fn.toString()
  const open = src.indexOf('{')
  const close = src.lastIndexOf('}')
  if (open === -1 || close === -1) throw new Error('Could not extract compiled template body')
  return src.slice(open + 1, close).trim()
}

/** Compiles client templates from disk via edge.js (supercharged tags require createRenderer). */
export function compileTemplates(templatesDir: string, keys: string[]): Map<string, string> {
  const edge = Edge.create()
  edge.mount(templatesDir)
  edge.createRenderer()

  const bodies = new Map<string, string>()
  for (const key of [...keys].sort()) {
    const fn = edge.asyncCompiler.compile(key) as CompiledTemplateFn
    bodies.set(key, extractFunctionBody(fn))
  }
  return bodies
}
