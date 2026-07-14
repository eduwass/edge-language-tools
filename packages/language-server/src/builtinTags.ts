/**
 * edge.js 6.5.1 built-ins, `Object.entries(Edge.create().tags)` plus `@end`.
 * seekable = takes `(...args)`. One-line docs follow https://edgejs.dev/docs.
 */
export const BUILTIN_TAGS: { name: string; seekable: boolean; doc: string }[] = [
  { name: 'assign', seekable: true, doc: 'Reassign a variable declared with `@let`: `@assign(count = count + 1)`.' },
  { name: 'component', seekable: true, doc: "Render a component template with props: `@component('components/card', { title })`. Body content goes to its slots." },
  { name: 'debugger', seekable: false, doc: 'Drop a `debugger` statement into the compiled template — pauses rendering in an attached debugger.' },
  { name: 'each', seekable: true, doc: 'Loop over arrays or objects: `@each(item in items)` or `@each((item, index) in items)`.' },
  { name: 'else', seekable: false, doc: 'Fallback branch of `@if` / `@unless` / `@each`.' },
  { name: 'elseif', seekable: true, doc: 'Additional conditional branch inside `@if`.' },
  { name: 'eval', seekable: true, doc: 'Evaluate a JS expression without printing anything: `@eval(cart.add(item))`.' },
  { name: 'if', seekable: true, doc: 'Conditional block: `@if(user.isAdmin)` ... `@elseif` / `@else` ... `@end`.' },
  { name: 'include', seekable: true, doc: "Render a partial with the caller's full state: `@include('partials/nav')`." },
  { name: 'includeIf', seekable: true, doc: "Include a partial only when a condition holds: `@includeIf(user, 'partials/profile')`." },
  { name: 'inject', seekable: true, doc: "Share values with the component's slots (usable inside a component): `@inject({ tabs })`." },
  { name: 'let', seekable: true, doc: 'Declare a local variable: `@let(total = items.length * 2)`.' },
  { name: 'newError', seekable: true, doc: "Raise a template-located error: `@newError('message', $filename, $lineNumber)`." },
  { name: 'pushOnceTo', seekable: true, doc: "Push content to a named stack, deduplicated — renders once even if pushed repeatedly: `@pushOnceTo('scripts')`." },
  { name: 'pushTo', seekable: true, doc: "Push content to a named stack: `@pushTo('scripts')`." },
  { name: 'slot', seekable: true, doc: "Named slot content inside a `@component` call: `@slot('header')`." },
  { name: 'stack', seekable: true, doc: "Placeholder where pushed content renders: `@stack('scripts')`." },
  { name: 'unless', seekable: true, doc: 'Inverted conditional block — renders when the expression is falsy.' },
  { name: 'end', seekable: false, doc: 'Closes the nearest open block tag.' },
  { name: 'types', seekable: true, doc: "edge-language-tools: declares the template's props interface (tag form of the `@types` block). Needs `registerTypesTag` from `@edge-language-tools/edge-plugin` at runtime." },
]
