export type PropControl =
  | { kind: 'select'; options: string[] }
  | { kind: 'toggle' }
  | { kind: 'text' }

export interface PlaygroundSchema {
  controls: Record<string, PropControl>
  defaultProps: Record<string, unknown>
  defaultSlot: string
  previewSlug: string
  minHeight?: number
}
