/**
 * House style: two spaces after every period in generated/report body text.
 * Only matches a period followed by space/tab (never a newline, so
 * paragraph breaks survive) — a decimal like "0.020" has no space after
 * its period, so it's never touched.
 */
export function applyTwoSpaceRule(text: string): string {
  return text.replace(/\.[ \t]+/g, '.  ')
}
