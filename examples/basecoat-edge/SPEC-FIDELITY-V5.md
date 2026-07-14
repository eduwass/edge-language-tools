# basecoat-edge v5 — markup fidelity sweep

Several components render visibly wrong or empty because their markup drifted from
upstream. Known offenders: breadcrumb (no separator icons at all), command (missing
icons), sidebar (preview shows nothing), tooltip (broken layout). Assume others have
similar drift — audit ALL 37.

## Method (per component, no exceptions)

1. Fetch the component's real markup from https://basecoatui.com/components/<name>/
   (the HTML usage examples are the ground truth — current version, data-attribute
   scheme). For the 9 macro-based components also re-check the Nunjucks source at
   https://raw.githubusercontent.com/hunvreus/basecoat/main/src/templates/nunjucks/<name>.njk
2. Diff our `templates/components/<name>.edge` output structure against it: element
   tags, class names, data attributes, aria wiring, and ICONS (upstream uses lucide
   svgs inline; we emit them via `@svg('lucide:<name>', {...})` from edge-iconify —
   match the icon choice and placement, e.g. breadcrumb chevron separators, command
   search icon, select/combobox chevrons and check marks).
3. Fix the component and/or its preview example in `scripts/previews.ts`. Components
   that are containers (sidebar, dialog, drawer, sheet-like things) need preview
   examples that actually show something: give the preview enough context/height
   (per-example minHeight exists in the previews map) and, for sidebar specifically,
   a wrapper layout so the sidebar is visible inline rather than off-canvas/empty.
4. Verify by rendering: `curl -s -X POST localhost:4790/render ...` (server runs on
   4790; restart it if you change server-side code) or `bun run gen-docs` + inspect
   `public/previews/<name>.html`. The rendered markup must contain the upstream
   structural elements (spot-assert with grep).

## Gates

1. `bun run check` all clean (37 checked) and `bunx tsc -p tsconfig.json` clean.
2. `bun run gen-docs` regenerates; breadcrumb preview contains chevron svgs; command
   preview contains its search icon; sidebar preview renders visible content;
   tooltip preview shows the trigger with a properly positioned tooltip.
3. `bunx blume build --isolated` clean.
4. Keep every @types doc comment intact; keep the data-attribute scheme; no emojis;
   no AI attribution; do not commit.
