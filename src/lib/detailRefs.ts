import type { DetailRef } from '../types/item'

/**
 * Splits a comma-separated entry ("5/S4.1, 3/S2.0") into DetailRef records,
 * best-effort splitting each token on "/" into detailNumber/sheetNumber.
 * Every ref comes back unvalidated — there's no sheet index to check
 * against yet, so nothing here is auto-corrected, only parsed.
 */
export function parseDetailRefsInput(input: string): DetailRef[] {
  return input
    .split(',')
    .map((raw) => raw.trim())
    .filter((raw) => raw.length > 0)
    .map((raw) => {
      const match = raw.match(/^(.+?)\/(.+)$/)
      return {
        raw,
        detailNumber: match ? match[1].trim() : raw,
        sheetNumber: match ? match[2].trim() : '',
        validated: false,
      }
    })
}

export function formatDetailRefsForInput(refs: DetailRef[]): string {
  return refs.map((r) => r.raw).join(', ')
}
