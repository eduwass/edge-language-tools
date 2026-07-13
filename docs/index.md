---
title: edge-language-tools
description: Type safety and editor tooling for EdgeJS templates.
---

Type safety and editor tooling for [EdgeJS](https://edgejs.dev) — red squiggles in your editor, a CI checker, and typed `edge.render()` calls. Works with bare `edge.js`; no AdonisJS required.

Declare a template's interface once, in a comment today's Edge already ignores:

```edge
{{--
@types {
  user: import('#models/user').User
  items: string[]
}
--}}

<h1>{{ user.name }}</h1>
@each(item in items)
  <li>{{ item }}</li>
@end
```

Everything below the block is inferred by TypeScript: `@let` locals, `@each` item types, narrowing in `@if`. A typo like `user.nmae` gets a diagnostic on the exact characters — in the editor and in CI.

:::note
Templates without a `@types` block stay unchecked. Adoption is gradual and can never break rendering — the block is tooling-only metadata.
:::

## What you get

- **Language server** — diagnostics, hover, prop completions, and template-path completions in VS Code, Cursor, and Zed (local or SSH remote)
- **`edge-check`** — CLI with caret-underlined diagnostics, `--format json`, and CI exit codes
- **`edge-codegen`** — a generated `templates.d.ts` that makes `edge.render('profile', props)` a compile-time-checked call
- **Cross-file checking** — `@component` props, `@include` state compatibility, and Edge's supercharged shorthand tags (`@form.input(...)`)
- **Strict mode** — opt-in `requireTypes` globs so chosen folders must declare their types
