# edge-language-tools

[![edge-language-tools teaser](public/teaser.gif)](https://eduwass.github.io/edge-language-tools/)

Full code intelligence for [EdgeJS](https://edgejs.dev) templates: a real
language server (powered by TypeScript + Volar, the machinery behind Vue and
Astro tooling) with type-aware diagnostics, autocomplete for props and
expressions, hover types and docs on every tag, go-to-definition into
components and partials, tag completion on `@` (built-ins and your components
as supercharged tags), and template-path completion for `@include` and
`@component` — plus a CI type-checker and generated types that make
`edge.render()` calls compile-time-checked. Works with bare `edge.js`;
no AdonisJS required.

Docs: https://eduwass.github.io/edge-language-tools/

Declare a template's interface once, in a comment (optionally with a doc
header — `@name` and `@desc` — that editors show on hover and in completions):

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

## Coverage notes

- `@layout` / `@section` (Edge v5 template inheritance) were removed in
  edge.js v6 — there's nothing to support and no fixture for them; templates
  using v5's compat mode stay unchecked like any other unrecognized construct.
- `@pushToTop` / `@pushOnceToTop` don't exist in edge.js 6.5.1 (only
  `@stack`, `@pushTo`, `@pushOnceTo`) — not registered, nothing to check.
- Plugin-registered tags (e.g. AdonisJS's supercharged `@modal.foo()` style)
  are claimed at runtime by the compiler, so their block/seekable shape is
  statically unknowable here. They're guessed as block tags so their bodies
  stay in the caller's scope for typo-checking; if that guess causes an
  unclosed-tag parse failure (a self-closed plugin tag with no matching
  `@end`), generation falls back to treating the whole file as if the guess
  hadn't been made, so the tag's content is dropped from checking rather than
  mis-scoped or crashing the generator.

## Strict mode

By default, templates without a `@types` block stay unchecked. To require one
for a subset of templates, declare `edge.check` in the nearest `package.json`:

```jsonc
{
  "edge": {
    "check": {
      "requireTypes": ["templates/components/**"],
      "exclude": ["templates/legacy/**"],
      "severity": "warn" // "error" (default) | "warn"
    }
  }
}
```

Globs (`**`, `*`, literal paths) resolve relative to the `package.json` that
declares them; `exclude` wins over `requireTypes`. A template missing a
`@types` block under `requireTypes` gets flagged by `edge-check` and the
editor; `severity: "error"` fails the CLI (exit 1), `"warn"` doesn't.

## Demo

`examples/demo-app` is a small bare edge.js app wired to `edge-check`,
`edge-codegen`, and `tsc` end to end — see `examples/demo-app/DEMO.md` for a
walkthrough with real command output, including what happens when a template
or a call site breaks.

## Packages

- `@edge-language-tools/core` — Edge → virtual TS generation + checking
- `@edge-language-tools/check` — `edge-check` CLI: recursively checks `.edge` files, human or `--format json` output
- `@edge-language-tools/codegen` — `edge-codegen`: generated `templates.d.ts` + `TypedEdge` for checked `edge.render()` calls
- `@edge-language-tools/language-server` — Volar-based LSP (diagnostics, completions, hover)
- `packages/vscode` — VS Code / Cursor extension
- `packages/zed` — Zed extension (works with SSH remote projects)

## Runtime compatibility

Nothing here requires Bun at runtime. The language server and both CLIs run on
plain Node.js 22.18+ (native TypeScript support); with npm that's
`npm install` + `npx edge-check templates/`. Bun is used as the development
harness for this repo (tests, scripts) — consumers and editors never touch it.

## Development

```sh
bun install
bun test            # fixture corpus: template in → virtual TS + diagnostics out
bun run precommit   # lint + typecheck + tests
```

The test runner is `bun:test`, so developing this repo itself uses Bun.
Consuming the packages does not — see Runtime compatibility above.
