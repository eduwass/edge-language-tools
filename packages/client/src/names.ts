/** `components/user_card` -> `renderUserCard`. */
export function renderExportName(templateKey: string): string {
  const base = templateKey.split('/').pop() ?? templateKey
  const camel = base
    .split('_')
    .map((part, index) => (index === 0 ? part : part[0]!.toUpperCase() + part.slice(1)))
    .join('')
  return `render${camel[0]!.toUpperCase()}${camel.slice(1)}`
}

export function propsTypeName(templateKey: string): string {
  const base = renderExportName(templateKey).replace(/^render/, '')
  return `${base}Props`
}

export function slotsTypeName(templateKey: string): string {
  const base = renderExportName(templateKey).replace(/^render/, '')
  return `${base}Slots`
}
