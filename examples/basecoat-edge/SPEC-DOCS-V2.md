# basecoat-edge docs v2 — live previews + TypeTables

Upgrade the generated docs in `examples/basecoat-edge/docs/`. Everything stays inside
`examples/basecoat-edge/`. Current state: `scripts/gen-docs.ts` emits one mdx per component
with the raw `@types` block in a ts code fence. All 37 components pass `bun run check`.

## 1. Props as Blume TypeTable (replace the code fence)

Blume ships `<TypeTable type={{ prop: { type, required, description, default } }} />`
(https://useblume.dev/docs/content/components, "Type tables" section). In `gen-docs.ts`:

- Parse each component's `@types` body with the TypeScript compiler API (the repo already
  depends on `typescript`; see `packages/core/src/types-block.ts` `propertyNames()` for the
  wrap-in-`type __T = ...`-and-visit pattern). For each `PropertySignature` collect:
  name, `type.getText(sourceFile)`, `required: !questionToken`.
- Emit `<TypeTable type={{ ... }} />` with those entries. Escape/format so MDX parses —
  type strings go in single quotes, JSON-escape as needed.
- An index signature (`[attr: string]: unknown`) is NOT a TypeTable row: render the line
  "Plus any additional HTML attributes, forwarded to the root element." under the table.
- If the `@types` body is not an object literal (none currently are), fall back to the
  existing code fence.

## 2. Live component previews (iframe, not islands)

The components are server-rendered Edge templates, so previews must be REAL renders:

- New `scripts/previews.ts`: a map of component name -> one or more example Edge snippets:
  `{ button: [{ title: 'Variants', source: `@button({ variant: 'outline' })Outline@end ...` }], ... }`
  Write meaningful examples for ALL 37 components (reuse/adapt `templates/demo.edge` content;
  check https://basecoatui.com/components/<name>/ when unsure what a good example shows).
- `gen-docs.ts` renders each example through edge.js (mount `templates/`, same setup as
  `src/server.ts`) and writes a self-contained HTML file to `docs/public/previews/<name>[-i].html`:
  basecoat CDN css + all.min.js (same URLs as the demo server layout), a centered container
  with ~24px padding, light color-scheme default.
- Each component mdx embeds its preview(s) above the TypeTable:
  `<iframe src="/previews/<name>.html" title="<Name> preview" loading="lazy" style={{ width: '100%', minHeight: '160px', border: '1px solid var(--color-border-tertiary)', borderRadius: '8px' }} />`
  Per-example `minHeight` may come from the previews map (e.g. dialogs/sidebars need more).
  Below the iframe, show the example's Edge source in an `edge` code fence (collapsible via
  `<Expandable title="Source">` is a nice touch).
- Verify Blume copies `docs/public/` into the build (the root site does this with `public/`;
  if the docs public dir is not picked up, place previews where the build does pick them up
  and adjust paths — verify with `bunx blume build --isolated` and inspect `.blume-verify/dist`).

## 3. Gates

1. `bun run gen-docs` — regenerates all pages + previews deterministically, no errors.
2. `bunx blume build --isolated` (in examples/basecoat-edge) — clean build; spot-check in
   `.blume-verify/dist`: a component page contains a TypeTable and an iframe; the preview
   html exists and contains the component's rendered markup.
3. `bun run check` still all clean (you should not need to touch templates/, but if an
   example exposes a real component bug, fix the component and keep check green).
4. No emojis, no AI attribution, no commits (reviewer commits).
