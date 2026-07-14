# basecoat-edge v6 — prop controls inside the props table

Merge the playground's control grid into the props table: one tidy table where each
prop row expands to its description, default, and the LIVE control that drives the
preview. Everything inside `examples/basecoat-edge/`.

## Changes

1. `scripts/gen-docs.ts`: stop emitting the `<TypeTable ... />` and the island's
   separate schema controls-grid contract. Instead pass ONE schema to the Playground
   island that includes, per prop: type text, required flag, description, default
   (already parsed from the @types doc comments), and the control kind/options for
   editable props. The generated page becomes: `## Preview` (island) then nothing else
   under Props — the island renders the props table itself under its preview + Usage.
   Keep the "Plus any additional HTML attributes..." note (render it inside the island
   below the table, from a schema flag for the index signature).
2. `islands/Playground.tsx`: replace the controls grid with a props table section
   styled to match blume's TypeTable look, using --blume-* tokens (see existing style
   constants): header row "Prop / Type", one row per prop — mono prop name (with `?`
   suffix when optional), type text in mono, chevron toggle. Expanded row area shows:
   description text, "Default: X" when present, and the live control (select/toggle/
   text input) for editable props; non-editable props expand to description only.
   Keep the slot textarea near the preview (it is content, not a prop). All existing
   behavior stays: debounced text, immediate select/toggle, /render round-trip, static
   fallback, highlighted Usage snippet.
3. Expand the first editable prop's row by default so the interactivity is
   discoverable.

## Gates

1. `bun run gen-docs` deterministic; button page contains NO TypeTable import/usage
   and the island schema carries descriptions/defaults/types.
2. `bunx tsc -p tsconfig.json` clean; `bun run check` still all clean.
3. `bunx blume build --isolated` clean.
4. No emojis, no AI attribution, do not commit.
