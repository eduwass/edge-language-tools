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
}
