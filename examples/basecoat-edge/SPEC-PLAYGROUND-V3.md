# basecoat-edge docs v3 — live typesafe playground

Add an interactive playground to the generated component docs. Everything stays inside
`examples/basecoat-edge/`. Current state (v2, committed): `scripts/gen-docs.ts` parses each
component's `@types` with the TS compiler, emits TypeTables + static iframe previews from
`scripts/previews.ts`; demo server (`src/server.ts`, bun, :4790) renders `templates/demo.edge`.

## Design (agreed with the reviewer — follow it)

Type-driven controls, real server-side rendering, resulting code shown:

1. **Render endpoint** in `src/server.ts`: `POST /render` with JSON
   `{ component: string, props: Record<string, unknown>, slot?: string }`.
   - Validate `component` against the actual files in `templates/components/` (reject
     anything else — no path traversal). Reject non-JSON bodies. This runs locally only,
     but validate at the boundary anyway.
   - Render via edge.js: build a template string that calls the component with the given
     props (serialize props as an object literal; strings escaped) and the optional slot
     text as body content, using `@component('components/<name>', props)`.
   - Return `{ html, source }` where `source` is the supercharged-tag Edge snippet for the
     current state (e.g. `@button({ variant: 'outline', size: 'sm' })\n  Save\n@end`),
     which the UI shows verbatim.
   - Add CORS headers allowing http://localhost:4310 (the blume dev origin).

2. **Playground metadata** in gen-docs: for each component, from the parsed `@types`:
   - union-of-string-literals prop -> `{ kind: 'select', options: [...] }`
   - `boolean` -> `{ kind: 'toggle' }`
   - `string` -> `{ kind: 'text' }`
   - anything else (objects, arrays, Records, index signature) -> not editable in the
     playground (the TypeTable still documents it).
   Include per-component default props + default slot text (reuse `scripts/previews.ts`
   examples as the initial state). Emit this as JSON into the page (see below).

3. **Playground island**: a single React island `docs/islands/Playground.tsx`
   (Blume islands: https://useblume.dev/docs/content/islands — PascalCase file in
   `islands/` is auto-available in MDX; verify the exact directory expected relative to the
   docs root by testing the build).
   - Props: `component` (name) + `schema` (the metadata JSON from gen-docs).
   - Renders the controls, an output area, and the current Edge snippet in a `<pre>`
     with a copy button.
   - On mount and on every control change, POST to `http://localhost:4790/render`; inject
     the returned HTML into a sandboxed iframe via `srcdoc` (wrap with the same basecoat
     CDN css/js head as the static previews so it's styled).
   - If the fetch fails, show a friendly inline note: "Playground needs the demo server:
     run `bun run demo` in examples/basecoat-edge" — and fall back to displaying the static
     preview iframe instead. NEVER a broken/blank box.
   - Debounce text inputs (~300ms). No external npm deps beyond react (already available
     to blume islands).
   - Style with the blume theme CSS variables; flat, no emojis.

4. **Page layout** per component mdx (gen-docs emits): Preview/playground first
   (`<Playground component="button" schema={...} />`), then Usage (Edge snippet code
   fence), then Props TypeTable. Keep the static preview page generation as-is (fallback +
   no-server mode).

## Gates

1. `bun run gen-docs` — regenerates everything deterministically.
2. `bunx blume build --isolated` — clean; built button page contains the Playground island.
3. With the demo server running: `curl -s -X POST localhost:4790/render -H 'content-type: application/json' -d '{"component":"button","props":{"variant":"outline"},"slot":"Save"}'` returns html containing `data-variant="outline"` and a source snippet containing `@button(`.
4. `bun run check` still all clean; `bunx tsc -p tsconfig.json` still clean.
5. Manual sanity via curl of the blume dev server page is fine; do not install a browser.
No commits (reviewer commits). No emojis. No AI attribution.
