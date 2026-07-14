# @edge-language-tools/client — typed client-side render functions (experimental)

Build-time extraction of `@client`-marked Edge templates into a tiny browser module of typed render functions. No Edge compiler shipped to the browser, no `eval`, CSP-clean.

## Three moves

1. **Mark** — add `@client` to a template's doc comment (alongside `@types`).
2. **Build** — `edge-client build templates/ --out client/` emits `runtime.ts` + `templates.ts`.
3. **Render** — import `renderButton(props, slots?)` in the browser; same `.edge` source as the server.

## CLI

```sh
edge-client build <templates-dir> --out <dir> [--format ts|js]
```

- Walks `*.edge` files; selects templates whose docs include `@client`.
- Resolves the dependency closure (every `@component` / supercharged tag / `@include` target must also be `@client`).
- Rejects unknown identifiers not covered by `@types`, Edge implicit vars, or the client-safe globals (`html.attrs`, `escape`, `truncate`).
- Compiles with edge.js at build time; emits one module with typed `render*` exports and a default `templates` map.

## CSP

Compiled output is plain functions plus a micro-runtime (~hundreds of lines). No `eval`, no dynamic `Function`, no edge.js in the browser bundle.

## Size

The runtime is intentionally minimal: HTML escaping, `html.attrs`, `$props`/`$slots` plumbing, and `template.compileComponent` glue only. Templates you mark `@client` add their compiled bodies on top.
