/**
 * @edge-language-tools/core — Edge template → virtual TypeScript generation.
 *
 * The contract everything else (CLI, Volar plugin, codegen) builds on:
 * `generateVirtualTs` turns one .edge source into a TS module whose type
 * errors correspond to real template mistakes, plus offset mappings back
 * into the template. Expressions are copied VERBATIM (1:1 segments) —
 * never rewritten — so mapped positions are exact.
 */

/** One mapped segment: template offset ↔ virtual TS offset, same length. */
export interface Segment {
  sourceOffset: number
  generatedOffset: number
  length: number
}

export interface VirtualFile {
  /** Generated TypeScript source. */
  code: string
  /** Verbatim-copied expression segments, sorted by sourceOffset. */
  segments: Segment[]
  /** Parsed `{{-- @types { ... } --}}` block, if the template declares one. */
  typesBlock: { raw: string; sourceOffset: number } | null
}

/**
 * Resolves an `@include`/`@component` template name (Edge convention: slash
 * or dot separated, no extension) to its source. Returns null when the
 * template can't be found — the reference is then left unchecked.
 */
export type ResolveTemplate = (name: string) => { source: string; filename: string } | null

export interface GenerateOptions {
  resolveTemplate?: ResolveTemplate
}

/** A tsc diagnostic mapped back to template coordinates (0-based offsets). */
export interface TemplateDiagnostic {
  message: string
  code: number
  /** Offset range in the .edge source, or null if it arose in unmapped glue. */
  start: number | null
  length: number | null
}

export { generateVirtualTs } from './generator.ts'
export { findEdgeFiles } from './walk.ts'

/**
 * Type-check one template in isolation: generate the virtual TS, run tsc
 * over it (plus any ambient types the caller provides), map diagnostics
 * back through the segments. Templates with no @types block yield [].
 */
export { checkTemplate } from './checker.ts'
