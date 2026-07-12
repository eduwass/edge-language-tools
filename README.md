# edge-language-tools

Type safety and editor tooling for [EdgeJS](https://edgejs.dev) templates.
Works with bare `edge.js` — no AdonisJS required (an Adonis preset comes later).

Declare a template's interface once, in a comment:

```edge
{{--
@types {
  user: import('#models/user').User
  items: string[]
}
--}}

<h1>{{ user.name }}</h1>   {{-- typo in `name`? red squiggle. --}}
@each(item in items)
  <li>{{ item }}</li>      {{-- item: string — inferred, not declared --}}
@end
```

Everything below the block is inferred by TypeScript: `@let` locals,
`@each` item types, narrowing in `@if`. Templates without a block stay
unchecked — adoption is gradual and can never break rendering.

## How it works

The core generates a virtual TypeScript module per template (expressions
copied verbatim, `@each` emitted as a real `for..of`, Edge's implicit
variables and globals pre-typed) with exact offset mappings back to the
`.edge` source. TypeScript does the checking; [Volar.js](https://volarjs.dev)
serves it to editors; a generated `templates.d.ts` types `edge.render()`
call sites.

## Packages

- `@edge-language-tools/core` — Edge → virtual TS generation + checking
- `@edge-language-tools/check` — `edge-check` CLI: recursively checks `.edge` files, human or `--format json` output
- (planned) LSP server, VS Code extension, Zed extension

## Development

```sh
bun install
bun test            # fixture corpus: template in → virtual TS + diagnostics out
bun run precommit   # lint + typecheck + tests
```
