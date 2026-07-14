/** Maps 1-based line numbers + edge-lexer's 0-based column to absolute source offsets. */
export class LineIndex {
  private readonly starts: number[]

  constructor(source: string) {
    const starts = [0]
    for (const line of source.split('\n').slice(0, -1)) {
      starts.push(starts[starts.length - 1]! + line.length + 1)
    }
    this.starts = starts
  }

  toOffset(line: number, col: number): number {
    return this.starts[line - 1]! + col
  }

  toLineCol(offset: number): { line: number; col: number } {
    let line = 1
    for (let i = this.starts.length - 1; i >= 0; i--) {
      if (offset >= this.starts[i]!) {
        line = i + 1
        return { line, col: offset - this.starts[i]! }
      }
    }
    return { line: 1, col: offset }
  }
}
