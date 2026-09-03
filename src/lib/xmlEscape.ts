/**
 * Escapes text destined for raw-XML insertion (docxtemplater's `{@tag}`
 * inserts its value verbatim, unescaped) — anything user-typed that lands
 * in one of our hand-built XML blocks (attendee names, item body text,
 * photo captions) must go through this first.
 */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
