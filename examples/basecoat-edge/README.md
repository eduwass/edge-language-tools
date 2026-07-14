# basecoat-edge

Typed EdgeJS components wrapping [basecoat UI](https://basecoatui.com), built as a showcase for [edge-language-tools](https://github.com/eduwass/edge-language-tools).

## Quick start

```bash
# from repo root
bun install
cd examples/basecoat-edge
bun run demo
```

## Scripts

| Script | Purpose |
|--------|---------|
| `bun run check` | Type-check all templates with `edge-check` |
| `bun run codegen` | Generate `edge-templates.d.ts` for typed `edge.render` |
| `bun run gen-docs` | Regenerate component docs from `@name` / `@desc` / `@types` |
| `bun run demo` | Kitchen-sink demo server on port 4790 |
| `bun run docs:dev` | Blume docs dev server |
| `bun run docs:build` | Build the docs site |

## Components

37 typed components in `templates/components/`, matching basecoat's component set. Interactive components emit markup only; the demo loads basecoat's CDN JS bundle.
