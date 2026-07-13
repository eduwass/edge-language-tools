# @edge-language-tools/zed

Zed extension: `.edge` syntax highlighting (via
[tree-sitter-edge](https://github.com/Brayan-724/tree-sitter-edge)) and LSP
wiring to `edge-language-server` (`packages/language-server`).

## What it does

- Registers the `Edge` language for `*.edge` files with a pinned tree-sitter
  grammar.
- Spawns `edge-language-server` as the language server for that language,
  passing `initializationOptions.typescript.tsdk` resolved from the worktree's
  own `node_modules/typescript/lib` (same as the VS Code extension does via
  `@volar/vscode`'s `getTsdk`).

No keymaps, no themes, no other extras.

## Server resolution

There's no npm package to auto-install (`@edge-language-tools/language-server`
is an unpublished monorepo package), so the extension does not attempt
download/install like the Vue/Astro Zed extensions do. Instead, in order:

1. `lsp.edge-language-server.binary.path` (+ optional `.arguments`) in Zed's
   `settings.json`, if set — explicit override, always wins.
2. Whatever `edge-language-server` resolves to on the worktree's `$PATH`,
   which Zed's `Worktree::which` includes `node_modules/.bin` in. This is the
   common case: run `bun install` (or `npm i`) in a project that depends on
   `@edge-language-tools/language-server`, and it just works.
3. Otherwise: falls back unconditionally to the conventional
   `<worktree>/node_modules/.bin/edge-language-server` path with no existence
   probe (Zed excludes `node_modules` from the worktree index, so it can't be
   checked ahead of time) — if that's also absent, Zed's own spawn failure is
   what surfaces, not a purpose-built error message.

## Building

```sh
rustup target add wasm32-wasip2   # once
cd packages/zed
cargo build --target wasm32-wasip2
```

`zed_extension_api = "0.7.0"` targets `wasm32-wasip2` (the wasip1 target is
outdated as of extension API 0.5+).

## Installing locally (manual — no headless path exists)

Zed only loads extensions through its own extension host, so there is no CLI
verification beyond `cargo build` succeeding. To try it in the real editor:

1. Open Zed → Extensions (`cmd-shift-x`) → **Install Dev Extension** → pick
   `packages/zed` in this repo.
2. Zed compiles the extension itself (it manages its own toolchain state; you
   don't need to have already run `cargo build` for this step, though it's a
   useful pre-check).
3. Open a project containing `.edge` files with
   `@edge-language-tools/language-server` reachable per the resolution order
   above, and open one.

## Remote projects (this repo's actual setup)

This repo and the language server live on the devbox; the user's Zed runs on
the Mac. Two different things are meant by "remote" here and only one is
solved by this extension:

- **Zed Remote Development** (`zed --remote` / "Connect via SSH"): Zed's
  extension host, and therefore the language server process, run **on the
  remote host**. In that mode this extension resolves and spawns
  `edge-language-server` on devbox, exactly as documented above — no
  extra work needed, this is the intended path for this repo.
- **A purely local Zed opening a path that happens to be synced/mounted from
  devbox** (not an actual SSH remote project): the language server would try
  to run *locally* on the Mac. That only works if `edge-language-server` is
  also installed for `node` locally there — not the same guarantee as the
  devbox project. Don't assume this "just works" without checking `node
  -v` and the dependency locally.

The dev-extension install itself is also a per-Zed-instance action: installing
it in a remote SSH window and installing it for local-only windows are
separate installs, not shared, so this step has to be repeated on whichever
Zed session (local vs. remote-attached) will open `.edge` files.

## Not done / known ceilings

- No auto-install, no version pinning against `@edge-language-tools/core` —
  ponytail: the workspace only has one moving server version right now, so
  drift isn't possible yet. If the server ever ships outside this monorepo,
  revisit server resolution to add a real install step like Vue/Astro.
- Grammar is pinned to a single upstream commit
  (`Brayan-724/tree-sitter-edge`); highlighting is coarse (the grammar itself
  only distinguishes raw HTML from `{{ }}` expressions and `@directive`s, no
  finer-grained token types are exposed yet).
