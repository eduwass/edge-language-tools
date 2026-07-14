/**
 * Browser micro-runtime for compiled Edge client templates.
 * Emitted verbatim to runtime.ts / runtime.js by edge-client build.
 */

export class SafeValue {
  constructor(readonly value: string) {}
}

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escape(input: unknown): string {
  if (input instanceof SafeValue) return input.value
  return String(input).replace(/[&<>"']/g, (c) => ENTITIES[c]!)
}

export function htmlSafe(value: string): SafeValue {
  return new SafeValue(value)
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

export function stringifyAttrs(props: Record<string, unknown>): string {
  const parts: string[] = []
  for (const [key, raw] of Object.entries(props)) {
    if (raw === false || raw === null || raw === undefined) continue
    if (raw === true) {
      parts.push(key)
      continue
    }
    parts.push(`${key}="${escapeAttr(String(raw))}"`)
  }
  return parts.join(' ')
}

export const html = {
  escape,
  safe: htmlSafe,
  attrs(values: Record<string, unknown>): SafeValue {
    return htmlSafe(stringifyAttrs(values))
  },
}

export function truncate(
  value: string,
  chars = 20,
  options?: { completeWords?: boolean; strict?: boolean; suffix?: string },
): string {
  const suffix = options?.suffix ?? '...'
  const limit = Math.max(0, chars - suffix.length)
  if (value.length <= chars) return value
  let cut = value.slice(0, limit)
  if (options?.completeWords !== false && options?.strict !== true) {
    const lastSpace = cut.lastIndexOf(' ')
    if (lastSpace > 0) cut = cut.slice(0, lastSpace)
  }
  return cut + suffix
}

export class ComponentProps {
  constructor(private readonly values: Record<string, unknown>) {}

  get(key: string): unknown {
    return this.values[key]
  }

  has(key: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.values, key)
  }

  merge(extra: Record<string, unknown>): ComponentProps {
    if (extra.class && this.values.class) {
      const classes = new Set<string>()
      for (const value of [extra.class, this.values.class]) {
        if (Array.isArray(value)) {
          for (const item of value) classes.add(String(item))
        } else {
          for (const item of String(value).split(/\s+/)) {
            if (item) classes.add(item)
          }
        }
      }
      return new ComponentProps({
        ...extra,
        ...this.values,
        class: Array.from(classes).join(' '),
      })
    }
    return new ComponentProps({ ...extra, ...this.values })
  }

  mergeIf(condition: unknown, extra: Record<string, unknown>): ComponentProps {
    return condition ? this.merge(extra) : this
  }

  except(keys: string[]): ComponentProps {
    const next = { ...this.values }
    for (const key of keys) delete next[key]
    return new ComponentProps(next)
  }

  toAttrs(exceptKeys: string[] = []): SafeValue {
    const attrs = { ...this.values }
    for (const key of exceptKeys) delete attrs[key]
    return html.attrs(attrs)
  }
}

export type CompiledTemplate = (
  template: ClientTemplate,
  state: Record<string, unknown>,
  $context: Record<string, unknown>,
) => Promise<string>

export interface ClientTemplate {
  escape(input: unknown): string
  reThrow(error: unknown, filename: string, lineNumber: number): never
  compileComponent(templatePath: string): CompiledTemplate
  getComponentState(
    props: Record<string, unknown>,
    slots: Record<string, unknown>,
    caller: { filename: string; line: number; col: number },
  ): Record<string, unknown>
}

export function createClientTemplate(compiled: Record<string, CompiledTemplate>): ClientTemplate {
  const sharedGlobals = { html, truncate }

  const template: ClientTemplate = {
    escape,
    reThrow(error, filename, lineNumber) {
      if (error instanceof Error) {
        throw new Error(`${error.message} (at ${filename}:${lineNumber})`)
      }
      throw error
    },
    compileComponent(templatePath) {
      const fn = compiled[templatePath]
      if (!fn) throw new Error(`Unknown client template: ${templatePath}`)
      return fn
    },
    getComponentState(props, slots, caller) {
      return {
        ...sharedGlobals,
        ...props,
        $slots: slots,
        $caller: caller,
        $props: new ComponentProps(props),
      }
    },
  }

  return template
}

export function wrapSlots(
  slots: Record<string, () => Promise<string>>,
  $context: Record<string, unknown> = {},
): Record<string, unknown> {
  const wrapped: Record<string, unknown> = { $context: Object.assign({}, $context) }
  for (const [name, fn] of Object.entries(slots)) {
    wrapped[name] = async function (this: { $context: Record<string, unknown> }) {
      void this
      return fn()
    }
  }
  return wrapped
}

export async function renderCompiled(
  compiled: Record<string, CompiledTemplate>,
  templatePath: string,
  props: Record<string, unknown>,
  slots: Record<string, () => Promise<string>> = {},
): Promise<string> {
  const template = createClientTemplate(compiled)
  const fn = compiled[templatePath]
  if (!fn) throw new Error(`Unknown client template: ${templatePath}`)
  const state = template.getComponentState(props, wrapSlots(slots), {
    filename: templatePath,
    line: 1,
    col: 0,
  })
  return fn(template, state, {})
}
