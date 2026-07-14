#!/usr/bin/env bun
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const out = join(import.meta.dir, '../templates/components')
mkdirSync(out, { recursive: true })

const components: Record<string, string> = {
  accordion: `{{--
@name Accordion
@desc Vertically stacked disclosure items; requires basecoat accordion JS (all.min.js).
@types {
  multiple?: boolean
  [attr: string]: unknown
}
--}}
<section {{
  html.attrs({
    class: 'accordion',
    ...(multiple ? { 'data-multiple': 'true' } : {}),
  })
}}>
  {{{ await $slots.main() }}}
</section>`,

  avatar: `{{--
@name Avatar
@desc User avatar image or fallback initials.
@types {
  src?: string
  alt?: string
  fallback?: string
  [attr: string]: unknown
}
--}}
<span {{ html.attrs({ class: 'avatar' }) }}>
  @if(src)
    <img src="{{ src }}" alt="{{ alt ?? '' }}" />
  @elseif(fallback)
    <span>{{ fallback }}</span>
  @else
    {{{ await $slots.main() }}}
  @end
</span>`,

  badge: `{{--
@name Badge
@desc Small status label; variants map to basecoat data attributes.
@types {
  variant?: 'default' | 'secondary' | 'outline' | 'destructive'
  [attr: string]: unknown
}
--}}
<span {{
  html.attrs({
    class: 'badge',
    ...(variant && variant !== 'default' ? { 'data-variant': variant } : {}),
  })
}}>
  {{{ await $slots.main() }}}
</span>`,

  breadcrumb: `{{--
@name Breadcrumb
@desc Navigation breadcrumb trail.
@types {
  [attr: string]: unknown
}
--}}
<nav {{ html.attrs({ class: 'breadcrumb', 'aria-label': 'Breadcrumb' }) }}>
  <ol>
    {{{ await $slots.main() }}}
  </ol>
</nav>`,

  button_group: `{{--
@name Button Group
@desc Group related buttons with shared borders.
@types {
  orientation?: 'horizontal' | 'vertical'
  [attr: string]: unknown
}
--}}
<div
  role="group"
  {{
    html.attrs({
      class: 'button-group',
      ...(orientation === 'vertical' ? { 'data-orientation': 'vertical' } : {}),
    })
  }}
>
  {{{ await $slots.main() }}}
</div>`,

  chart: `{{--
@name Chart
@desc Chart container; requires basecoat chart JS (all.min.js).
@types {
  type?: 'bar' | 'line' | 'area' | 'pie' | 'donut'
  [attr: string]: unknown
}
--}}
<div {{
  html.attrs({
    class: 'chart',
    ...(type ? { 'data-type': type } : {}),
  })
}}>
  {{{ await $slots.main() }}}
</div>`,

  checkbox: `{{--
@name Checkbox
@desc Styled checkbox input with optional label slot.
@types {
  name?: string
  value?: string
  checked?: boolean
  disabled?: boolean
  required?: boolean
  id?: string
  label?: string
  [attr: string]: unknown
}
--}}
<label {{ html.attrs({ class: 'checkbox' }) }}>
  <input
    type="checkbox"
    @if(id)
    id="{{ id }}"
    @end
    @if(name)
    name="{{ name }}"
    @end
    @if(value)
    value="{{ value }}"
    @end
    @if(checked)
    checked
    @end
    @if(disabled)
    disabled
    @end
    @if(required)
    required
    @end
  />
  @if(await $slots.has('main'))
    {{{ await $slots.main() }}}
  @elseif(label)
    <span>{{ label }}</span>
  @end
</label>`,

  collapsible: `{{--
@name Collapsible
@desc Native details/summary disclosure; content via main slot.
@types {
  open?: boolean
  [attr: string]: unknown
}
--}}
<details
  {{ html.attrs({ class: 'collapsible' }) }}
  @if(open)
  open
  @end
>
  {{{ await $slots.main() }}}
</details>`,

  empty: `{{--
@name Empty
@desc Empty state placeholder with icon, title, and description slots.
@types {
  title?: string
  description?: string
  [attr: string]: unknown
}
--}}
<div {{ html.attrs({ class: 'empty' }) }}>
  @if(await $slots.has('icon'))
    <div class="empty-icon">{{{ await $slots.icon() }}}</div>
  @end
  @if(await $slots.has('title'))
    <div class="empty-title">{{{ await $slots.title() }}}</div>
  @elseif(title)
    <div class="empty-title"><h3>{{ title }}</h3></div>
  @end
  @if(await $slots.has('description'))
    <div class="empty-description">{{{ await $slots.description() }}}</div>
  @elseif(description)
    <div class="empty-description"><p>{{ description }}</p></div>
  @end
  @if(await $slots.has('main'))
    <div class="empty-content">{{{ await $slots.main() }}}</div>
  @end
</div>`,

  field: `{{--
@name Field
@desc Accessible form field wrapper with label and description slots.
@types {
  label?: string
  description?: string
  [attr: string]: unknown
}
--}}
<div {{ html.attrs({ class: 'field' }) }}>
  @if(await $slots.has('label'))
    {{{ await $slots.label() }}}
  @elseif(label)
    <label>{{ label }}</label>
  @end
  {{{ await $slots.main() }}}
  @if(await $slots.has('description'))
    <p>{{{ await $slots.description() }}}</p>
  @elseif(description)
    <p>{{ description }}</p>
  @end
</div>`,

  form: `{{--
@name Form
@desc Form container with field spacing.
@types {
  action?: string
  method?: 'get' | 'post'
  [attr: string]: unknown
}
--}}
<form {{
  html.attrs({
    class: 'form',
    ...(action ? { action } : {}),
    ...(method ? { method } : {}),
  })
}}>
  {{{ await $slots.main() }}}
</form>`,

  input: `{{--
@name Input
@desc Text-like input with basecoat styling.
@types {
  type?: string
  name?: string
  value?: string
  placeholder?: string
  disabled?: boolean
  required?: boolean
  id?: string
  [attr: string]: unknown
}
--}}
<input {{
  html.attrs({
    class: 'input',
    type: type ?? 'text',
    name,
    value,
    placeholder,
    disabled,
    required,
    id,
  })
}} />`,

  input_group: `{{--
@name Input Group
@desc Input with inline addons (icons, text, buttons).
@types {
  [attr: string]: unknown
}
--}}
<div {{ html.attrs({ class: 'input-group' }) }}>
  {{{ await $slots.main() }}}
</div>`,

  item: `{{--
@name Item
@desc List item row with media, title, and description slots.
@types {
  title?: string
  description?: string
  [attr: string]: unknown
}
--}}
<div {{ html.attrs({ class: 'item' }) }}>
  @if(await $slots.has('media'))
    <div class="item-media">{{{ await $slots.media() }}}</div>
  @end
  <div class="item-content">
    @if(await $slots.has('title'))
      <div class="item-title">{{{ await $slots.title() }}}</div>
    @elseif(title)
      <div class="item-title">{{ title }}</div>
    @end
    @if(await $slots.has('description'))
      <div class="item-description">{{{ await $slots.description() }}}</div>
    @elseif(description)
      <div class="item-description">{{ description }}</div>
    @end
  </div>
  @if(await $slots.has('actions'))
    <div class="item-actions">{{{ await $slots.actions() }}}</div>
  @end
</div>`,

  kbd: `{{--
@name Kbd
@desc Keyboard key indicator.
@types {
  [attr: string]: unknown
}
--}}
<kbd>
  {{{ await $slots.main() }}}
</kbd>`,

  label: `{{--
@name Label
@desc Form label element.
@types {
  for?: string
  [attr: string]: unknown
}
--}}
<label {{
  html.attrs({
    class: 'label',
    ...(for ? { for } : {}),
  })
}}>
  {{{ await $slots.main() }}}
</label>`,

  native_select: `{{--
@name Native Select
@desc Styled native select element.
@types {
  name?: string
  id?: string
  disabled?: boolean
  required?: boolean
  [attr: string]: unknown
}
--}}
<select {{ html.attrs({ class: 'native-select', name, id, disabled, required }) }}>
  {{{ await $slots.main() }}}
</select>`,

  progress: `{{--
@name Progress
@desc Progress bar indicator.
@types {
  value?: number
  max?: number
  [attr: string]: unknown
}
--}}
<progress {{
  html.attrs({
    class: 'progress',
    ...(value !== undefined ? { value } : {}),
    ...(max !== undefined ? { max } : {}),
  })
}}></progress>`,

  radio: `{{--
@name Radio
@desc Styled radio input with optional label.
@types {
  name?: string
  value?: string
  checked?: boolean
  disabled?: boolean
  required?: boolean
  id?: string
  label?: string
  [attr: string]: unknown
}
--}}
<label {{ html.attrs({ class: 'radio' }) }}>
  <input
    type="radio"
    @if(id)
    id="{{ id }}"
    @end
    @if(name)
    name="{{ name }}"
    @end
    @if(value)
    value="{{ value }}"
    @end
    @if(checked)
    checked
    @end
    @if(disabled)
    disabled
    @end
    @if(required)
    required
    @end
  />
  @if(await $slots.has('main'))
    {{{ await $slots.main() }}}
  @elseif(label)
    <span>{{ label }}</span>
  @end
</label>`,

  scrollbar: `{{--
@name Scrollbar
@desc Scrollable region with custom scrollbar styling.
@types {
  [attr: string]: unknown
}
--}}
<div {{ html.attrs({ class: 'scrollbar' }) }}>
  {{{ await $slots.main() }}}
</div>`,

  skeleton: `{{--
@name Skeleton
@desc Loading placeholder skeleton.
@types {
  [attr: string]: unknown
}
--}}
<div {{ html.attrs({ class: 'skeleton' }) }}>
  {{{ await $slots.main() }}}
</div>`,

  switch: `{{--
@name Switch
@desc Toggle switch input.
@types {
  name?: string
  checked?: boolean
  disabled?: boolean
  required?: boolean
  id?: string
  label?: string
  [attr: string]: unknown
}
--}}
<label {{ html.attrs({ class: 'switch' }) }}>
  <input
    type="checkbox"
    role="switch"
    @if(id)
    id="{{ id }}"
    @end
    @if(name)
    name="{{ name }}"
    @end
    @if(checked)
    checked
    @end
    @if(disabled)
    disabled
    @end
    @if(required)
    required
    @end
  />
  @if(await $slots.has('main'))
    {{{ await $slots.main() }}}
  @elseif(label)
    <span>{{ label }}</span>
  @end
</label>`,

  table: `{{--
@name Table
@desc Styled data table wrapper.
@types {
  [attr: string]: unknown
}
--}}
<div {{ html.attrs({ class: 'table' }) }}>
  <table>
    {{{ await $slots.main() }}}
  </table>
</div>`,

  textarea: `{{--
@name Textarea
@desc Multi-line text input.
@types {
  name?: string
  value?: string
  placeholder?: string
  rows?: number
  disabled?: boolean
  required?: boolean
  id?: string
  [attr: string]: unknown
}
--}}
<textarea {{
  html.attrs({
    class: 'textarea',
    name,
    placeholder,
    rows,
    disabled,
    required,
    id,
  })
}}>{{ value ?? '' }}</textarea>`,

  tooltip: `{{--
@name Tooltip
@desc Tooltip trigger with content; requires basecoat tooltip JS.
@types {
  id: string
  [attr: string]: unknown
}
--}}
<div id="{{ id }}" class="tooltip">
  <button type="button" id="{{ id }}-trigger" aria-describedby="{{ id }}-content">
    {{{ await $slots.trigger() }}}
  </button>
  <div id="{{ id }}-content" role="tooltip" data-tooltip aria-hidden="true">
    {{{ await $slots.main() }}}
  </div>
</div>`,
}

for (const [name, content] of Object.entries(components)) {
  writeFileSync(join(out, `${name}.edge`), content + '\n')
}

console.log(`Wrote ${Object.keys(components).length} CSS-only components`)
