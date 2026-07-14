export type PropControl =
  | { kind: 'select'; options: string[] }
  | { kind: 'toggle' }
  | { kind: 'text' }

export interface PlaygroundProp {
  type: string
  required: boolean
  description?: string
  default?: string
  control?: PropControl
}

export interface PlaygroundSchema {
  props: Record<string, PlaygroundProp>
  defaultProps: Record<string, unknown>
  defaultSlot: string
  previewSlug: string
  minHeight?: number
  hasIndexSignature?: boolean
  hasSlot?: boolean
}
