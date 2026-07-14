import type { CommentToken } from 'edge-lexer/types'
import { collectStateIdents, findTypesBlock, LineIndex, propertyNames, tokenize } from '@edge-language-tools/core'

const CLIENT_SAFE_GLOBALS = new Set(['html', 'truncate'])
const EDGE_IMPLICIT = new Set(['$filename', '$context', '$slots', '$caller', '$props'])

export interface IdentError {
  file: string
  line: number
  col: number
  name: string
}

function safeTokenize(source: string, filename: string) {
  try {
    return tokenize(source, filename)
  } catch {
    return tokenize(source, filename, { claimUnknownTags: false })
  }
}

/** Rejects identifiers that are not props, Edge implicit, or client-safe globals. */
export function validateClientIdentifiers(source: string, filename: string): IdentError[] {
  const lines = new LineIndex(source)
  const tokens = safeTokenize(source, filename)
  const comments = tokens.filter((t): t is CommentToken => t.type === 'comment')
  const typesBlock = findTypesBlock(comments, lines)
  const declaredProps = typesBlock?.literal ? new Set(propertyNames(typesBlock.raw)) : null
  const used = collectStateIdents(tokens, lines)
  const errors: IdentError[] = []

  for (const [name, offset] of used) {
    if (EDGE_IMPLICIT.has(name)) continue
    if (CLIENT_SAFE_GLOBALS.has(name)) continue
    if (declaredProps && declaredProps.has(name)) continue
    if (!declaredProps && typesBlock) continue
    const { line, col } = lines.toLineCol(offset)
    errors.push({ file: filename, line, col, name })
  }

  return errors
}
