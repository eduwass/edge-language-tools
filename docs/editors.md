---
title: Editor setup
description: VS Code, Cursor, and Zed.
---

One Volar-based language server powers every editor. Your project needs `@edge-language-tools/language-server` as a devDependency (so its binary lands in `node_modules/.bin`) and `typescript` installed.

## VS Code / Cursor

Build and install the extension from `packages/vscode`:

```sh
cd packages/vscode
bun run build
bunx @vscode/vsce package --no-dependencies -o edge-language-tools.vsix
```

Then Extensions panel → Install from VSIX. Cursor loads VS Code extensions unchanged. The official AdonisJS Edge extension can stay installed — it provides highlighting; this provides the semantics.

## Zed

Install as a dev extension: Extensions (`cmd-shift-x`) → Install Dev Extension → pick `packages/zed`. Requires a Rust toolchain (`rustup` with the `wasm32-wasip2` target) for Zed's local build step.

Server resolution order:

1. `lsp.edge-language-server.binary.path` in Zed settings (project `.zed/settings.json` works)
2. `edge-language-server` on the shell PATH
3. `<worktree>/node_modules/.bin/edge-language-server`

:::note
Zed SSH remote projects run the language server on the remote host — the project there needs the devDependency installed, not your local machine.
:::

## What you get in the editor

- Diagnostics on exact template offsets, live as you type
- Prop-name completions inside `@component(...)` / shorthand-tag props objects
- Template-path completions inside `@include('` and `@component('`
- Hover types for any expression
