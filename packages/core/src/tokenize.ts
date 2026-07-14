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
  slot: { block: true, seekable: true },
  include: { block: false, seekable: true },
  assign: { block: false, seekable: true },
  eval: { block: false, seekable: true },
  debugger: { block: false, seekable: false },
  newError: { block: false, seekable: true },
  includeIf: { block: false, seekable: true },
  inject: { block: false, seekable: true },
  stack: { block: false, seekable: true },
  pushTo: { block: true, seekable: true },
  pushOnceTo: { block: true, seekable: true },
  // seekable:true is required even for the bare block form (`@types()...@end`)
  // — edge-lexer throws "Missing token (" for a block:true tag with
  // seekable:false when the source omits parens, but seekable:true requires
  // parens to always be present, so the block form carries empty `()`. The
  // same {block:true, seekable:true} shape also parses the inline expression
  // form `@types(expr)` followed immediately by `@end` (empty body) —
  // verified directly against edge-lexer's Tokenizer, see types-block.ts.
  types: { block: true, seekable: true },
}

/**
 * Claims any tag name edge-language-tools doesn't recognize (e.g. a
 * plugin-registered tag like `@modal.foo`) as a block tag, so its body stays
 * grouped as children instead of being dropped mid-parse. This is a guess —
 * plugin tags can be self-closed or block depending on runtime registration
 * edge-language-tools has no visibility into. `generateVirtualTs` retries
 * without this claim if it causes an unclosed-tag parse failure.
 */
function claimUnknownTag() {
  return { block: true, seekable: true }
}

export function tokenize(source: string, filename: string, opts?: { claimUnknownTags?: boolean }): Token[] {
  const tokenizer = new Tokenizer(source, tags, {
    filename,
    claimTag: opts?.claimUnknownTags === false ? undefined : claimUnknownTag,
  })
  tokenizer.parse()
  return tokenizer.tokens
}
