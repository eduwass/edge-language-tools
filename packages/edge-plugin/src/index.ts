import type { TagContract } from 'edge.js/types'

/**
 * Runtime no-op for the `@types`/`@!types` tag form (see
 * `@edge-language-tools/core`'s `types-block.ts` for the full syntax). The
 * tag exists purely for static analysis — at render time it must produce no
 * output. `compile` intentionally does nothing: it never writes to `buffer`
 * and never walks `token.children`, so neither the member-list body nor a
 * literal `@end` ever reach the rendered output.
 *
 * `block`/`seekable` mirror the shape `@edge-language-tools/core` registers
 * with edge-lexer directly (see core's `tokenize.ts`) — both sides must agree
 * or the same template parses differently under tooling vs. real Edge.
 */
export const typesTag: TagContract = {
  block: true,
  seekable: true,
  tagName: 'types',
  compile() {},
}

/** Registers the `@types` no-op tag on an Edge instance. One line of setup, until Edge ships this natively. */
export function registerTypesTag(edge: { registerTag: (tag: TagContract) => void }): void {
  edge.registerTag(typesTag)
}
