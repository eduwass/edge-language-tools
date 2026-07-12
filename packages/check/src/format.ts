/** Convert a 0-based source offset to 1-based { line, col }. */
export function offsetToLineCol(source: string, offset: number): { line: number; col: number } {
  let line = 1
  let lastNewline = -1
  for (let i = 0; i < offset; i++) {
    if (source[i] === '\n') {
      line++
      lastNewline = i
    }
  }
  return { line, col: offset - lastNewline }
}

/** A single source line with a caret span underneath, for terminal display. */
export function excerpt(source: string, offset: number, length: number): string {
  const { line, col } = offsetToLineCol(source, offset)
  const lines = source.split('\n')
  const text = lines[line - 1] ?? ''
  const caretLen = Math.max(1, Math.min(length, text.length - col + 1))
  return `${text}\n${' '.repeat(col - 1)}${'^'.repeat(caretLen)}`
}

const colors = {
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
}

export function withColor(useColor: boolean) {
  if (!useColor) return { red: (s: string) => s, dim: (s: string) => s, bold: (s: string) => s }
  return colors
}
