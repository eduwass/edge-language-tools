/** Hand-written types for Edge's built-in template globals. Inlined into every virtual file. */
export const GLOBALS_TS = `
declare const $filename: string
declare const $context: any
declare const $slots: Record<string, (...args: any[]) => Promise<string>>
declare const $caller: { filename: string; line: number; col: number }
interface EdgeProps {
  get(key: string): unknown
  has(key: string): boolean
  only(keys: string[]): EdgeProps
  except(keys: string[]): EdgeProps
  merge(extra: Record<string, unknown>): EdgeProps
  mergeIf(condition: unknown, extra: Record<string, unknown>): EdgeProps
  toAttrs(exceptKeys?: string[]): string
}
declare const $props: EdgeProps
declare const nl2br: (value: string) => string
declare const inspect: (...args: unknown[]) => string
declare const truncate: (
  value: string,
  chars?: number,
  options?: { completeWords?: boolean; strict?: boolean; suffix?: string },
) => string
declare const excerpt: (
  value: string,
  chars?: number,
  options?: { completeWords?: boolean; strict?: boolean; suffix?: string },
) => string
declare const html: {
  escape: (value: string) => string
  safe: (value: string) => { toString(): string }
  classNames: (...values: unknown[]) => string
  attrs: (values: Record<string, unknown>) => string
}
declare const js: {
  stringify: (value: unknown) => string
}
declare const camelCase: (value: string) => string
declare const snakeCase: (value: string) => string
declare const dashCase: (value: string) => string
declare const pascalCase: (value: string) => string
declare const capitalCase: (value: string) => string
declare const sentenceCase: (value: string) => string
declare const dotCase: (value: string) => string
declare const noCase: (value: string) => string
declare const titleCase: (value: string) => string
declare const pluralize: (value: string, count?: number) => string
declare const sentence: (values: string[]) => string
declare const prettyMs: (value: number) => string
declare const toMs: (value: string) => number
declare const prettyBytes: (value: number) => string
declare const toBytes: (value: string) => number
declare const ordinal: (value: number) => string
`
