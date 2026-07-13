---
title: Getting started
description: Install the tooling and get your first squiggle.
---

## Requirements

- Node.js 22+ (the language server runs on plain node)
- Bun (for development in this monorepo)
- `edge.js` 6.x templates

## Check templates from the terminal

```sh
bun add -d @edge-language-tools/check
bunx edge-check templates/
```

```
templates/profile.edge:9:56 - error TS2551: Property 'displayNaem' does not
exist on type '{ displayName: string; bio: string; }'. Did you mean 'displayName'?

1 error across 4 checked templates (1 unchecked, 5 total)
```

Exit code is 1 when errors exist — wire it straight into CI. `--format json` emits machine-readable diagnostics.

## Typed render calls

```sh
bunx edge-codegen templates/ --out edge-templates.d.ts
```

Then cast once at setup:

```ts
import { Edge } from 'edge.js'
import type { TypedEdge } from './edge-templates.d.ts'

const edge = Edge.create() as unknown as TypedEdge
await edge.render('profile', { user })   // wrong props = compile error
```

Run with `--watch` to regenerate as templates change.

## Editors

See [Editor setup](/editors) for VS Code, Cursor, and Zed.
