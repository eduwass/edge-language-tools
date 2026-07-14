# basecoat-edge — build spec

Port [basecoat UI](https://basecoatui.com) (MIT, shadcn-style vanilla HTML/CSS/JS components) to **typed EdgeJS components**, as a showcase for edge-language-tools. Everything lives in `examples/basecoat-edge/` — do not modify anything outside it except running `bun install` at the repo root (lockfile update is expected and fine).

## Non-negotiable ground rules

1. **Read the latest docs before porting anything.** Primary sources:
   - https://basecoatui.com/components/<name>/ for every component's CURRENT markup. The current version uses `class="btn"` plus **`data-variant` / `data-size` data attributes** — NOT class suffixes like `btn-outline`. Trust the live docs over any cached knowledge.
   - https://raw.githubusercontent.com/hunvreus/basecoat/main/src/templates/nunjucks/<name>.njk — the 9 JS-driven components have Nunjucks macros (combobox, command, dialog, dropdown-menu, popover, select, sidebar, tabs, toast). Port their parameter surface and DOM structure faithfully.
   - https://edgejs.dev/docs/components/introduction (+ slots, props pages) for Edge component idioms.
   - https://edgejs.dev/docs/edge-iconify for icons: use **edge-iconify** with the lucide collection (`@iconify-json/lucide`), i.e. `{{ svg('lucide:check') }}` — this is what EdgeJS officially recommends. Do NOT inline raw SVG paths by hand.
2. **Every component gets a doc header** (this is the whole point of the project):
   ```edge
   {{--
   @name Button
   @desc shadcn-style button; variants and sizes map to basecoat data attributes.
   @types {
     variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'link' | 'destructive'
     size?: 'xs' | 'sm' | 'lg' | 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg'
     type?: 'button' | 'submit' | 'reset'
     [attr: string]: unknown
   }
   --}}
   ```
   - Use string-literal unions for every enum-like prop (variants, sizes, positions, formats).
   - Optional props get `?`. Structured props (e.g. select `items`) get real object/array types.
   - Components that forward arbitrary attributes declare `[attr: string]: unknown` and use `{{ $props.except(['variant', 'size', ...]).toAttrs() }}`.
3. **Slots**: body content renders via `{{{ await $slots.main() }}}`; named slots via `{{{ await $slots.header() }}}` etc. Match basecoat's structure (e.g. card = `header`/`section`/`footer` children).
4. **No runtime invention.** The 9 interactive components rely on basecoat's official JS exactly as upstream ships it; the demo page loads `basecoat-css` CDN bundles (`basecoat.cdn.min.css` + `js/all.min.js` deferred). Edge components emit only markup.
5. Style: no emojis anywhere. No AI attribution anywhere. Do not run `git commit` or `git push` — the reviewer commits.

## Deliverables

```
examples/basecoat-edge/
  package.json          # private; deps: edge.js, edge-iconify, @iconify-json/lucide;
                        # devDeps: @edge-language-tools/check, @edge-language-tools/codegen,
                        # @edge-language-tools/core (all workspace:*), typescript
                        # scripts: check, codegen, gen-docs, demo, docs:dev, docs:build
                        # "edge": { "check": { "requireTypes": ["templates/components/**"] } }
  templates/components/ # all 39 components as .edge files, snake_case filenames
  templates/demo.edge   # kitchen-sink page using MANY components via supercharged tags (@button, @card...)
  src/server.ts         # bun server on port 4790 rendering demo.edge with typed edge.render
  scripts/gen-docs.ts   # generates docs/components/<name>.mdx from each component's doc header
                        # using `templateDocs` exported by @edge-language-tools/core:
                        # page = frontmatter(title=@name, description=first @desc line) +
                        # @desc prose + props table derived from the @types block (verbatim
                        # code block is fine) + a usage snippet showing the supercharged tag call
  docs/                 # Blume site (independent of the root one): index.mdx (what this is,
                        # install/usage, links), components/ (generated), meta.ts files
  blume.config.ts       # own site config; local build only (no deployment section needed)
  README.md             # thin: what it is, run demo, run checks, regenerate docs
```

### Component list (39)

CSS/HTML-only (thin typed wrappers over documented markup — check each component's docs page):
accordion*, alert, avatar, badge, breadcrumb, button, button-group, card, chart*, checkbox,
collapsible, empty, field, form, input, input-group, item, kbd, label, native-select,
progress, radio, scrollbar, skeleton, switch, table, textarea, tooltip

JS-driven (port from the Nunjucks macros):
combobox, command, dialog, dropdown-menu, popover, select, sidebar, tabs, toast

(* accordion and chart have JS files upstream but no nunjucks macro — port from their docs-page markup and note the JS requirement in @desc.)

Where a nunjucks macro generates random IDs, accept an optional `id` prop and derive child
ids from it (`{{ id }}-trigger` etc.); require `id` (non-optional) where aria wiring needs it.
Where a macro takes `*_attrs` dicts, accept typed optional object props of the same names.

## QA gates — all must pass before you declare done

Run from `examples/basecoat-edge/`:
1. `bun install` (repo root, once) then `bun run check` — edge-check over templates/, ZERO errors; requireTypes enforces doc headers on all 39.
2. `bun run codegen && bunx tsc -p tsconfig.json` — typed render calls compile.
3. `bun src/server.ts &` then curl the demo page — HTML renders, includes markup from at least 10 different components, no Edge runtime errors.
4. `bun run gen-docs` — regenerates all component pages deterministically.
5. `bunx blume build --isolated` inside examples/basecoat-edge — docs site builds clean.

Work in dependency order: package scaffold -> button exemplar -> verify gates on it -> batch the remaining CSS-only components -> the 9 nunjucks ports -> demo page -> gen-docs script -> blume site -> full gate run. Re-run `bun run check` frequently; it is the ground truth for whether a @types block is well-formed.
