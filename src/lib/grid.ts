/** Parses a comma-separated grid-line entry ("A, B, C") into trimmed, non-empty labels. */
export function parseGridLine(input: string): string[] {
  return input
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/** Inverse of parseGridLine, for re-populating the editor's text input. */
export function formatGridLine(values: string[]): string {
  return values.join(', ')
}
