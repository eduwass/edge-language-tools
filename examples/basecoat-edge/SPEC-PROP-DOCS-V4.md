# basecoat-edge v4 — per-prop descriptions and defaults

Small, mechanical pass. Everything inside `examples/basecoat-edge/`.

Problem: the docs TypeTable rows expand to show only the type again — we pass no
`description`/`default`, so the reveal is useless.

## 1. Doc comments in @types blocks (all 37 components)

Add a concise leading `//` comment to EVERY prop in every component's `@types` block,
optionally with an `@default` tag where the component has an effective default:

```edge
@types {
  // Visual style, rendered as data-variant. @default 'primary'
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'link' | 'destructive'
  // Control size, rendered as data-size.
  size?: 'xs' | 'sm' | 'lg' | 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg'
}
```

Rules: one line per prop, plain sentence, no emojis. Describe what the prop DOES in the
rendered markup (check the component source), not a restatement of its name. The comment
is verbatim TS inside the block, so `bun run check` must stay green (it will — TS allows
comments in type literals; verify anyway).

## 2. gen-docs extracts them

In `scripts/gen-docs.ts`, when parsing prop signatures with the TS compiler, read each
property's leading comment (ts.getLeadingCommentRanges on the property's full start, or
jsDoc). Split out an `@default X` tag if present. Pass `description` (and `default` when
found) into the TypeTable entry map. Props without comments keep working (no description).

## 3. Gates

1. `bun run check` all clean (37 checked).
2. `bun run gen-docs` regenerates; a spot-checked page (button) passes description +
   default into its TypeTable props.
3. `bunx blume build --isolated` clean.
4. `bunx tsc -p tsconfig.json` clean.
No commits. No emojis. No AI attribution.
