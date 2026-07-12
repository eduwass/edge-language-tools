import { Tokenizer } from 'edge-lexer'
import type { Tags, Token } from 'edge-lexer/types'

/** Block tags whose jsArg/children shape the tokenizer needs to know about. */
const tags: Tags = {
  if: { block: true, seekable: true },
  elseif: { block: false, seekable: true },
  else: { block: false, seekable: false },
  unless: { block: true, seekable: true },
  each: { block: true, seekable: true },
  let: { block: false, seekable: true },
  component: { block: true, seekable: true },
  include: { block: false, seekable: true },
}

export function tokenize(source: string, filename: string): Token[] {
  const tokenizer = new Tokenizer(source, tags, { filename })
  tokenizer.parse()
  return tokenizer.tokens
}
