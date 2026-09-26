import type { Item } from '../types/item'
import type { ClosingVariant, Visit } from '../types/visit'
import { applyTwoSpaceRule } from './houseStyle'
import { itemTypeMeta } from './itemTypes'
import { formatVisitDateLong } from './reportDates'

/**
 * Shared, framework-agnostic report content — the actual words that go
 * into the report, independent of how they're eventually rendered (raw
 * OOXML for the .docx in reportTemplateBlocks.ts, plain HTML for the
 * in-app Report Preview page). Kept here specifically so the two can never
 * drift apart: the preview exists to let an engineer check content before
 * downloading, which only means something if it's built from the exact
 * same strings the .docx actually gets.
 */

export const CLOSING_STATEMENTS: Record<ClosingVariant, string> = {
  conforms:
    'Generally, the work observed appeared to conform to the construction documents, except as noted above.',
  'work-in-progress':
    'Generally, the work observed appeared to conform to the construction documents, although it was still a work-in-progress.',
}

export function buildOpeningStatement(visit: Visit): string {
  const purpose = visit.purpose.trim().replace(/\.+$/, '')
  const sentence = `On ${formatVisitDateLong(visit.visitDate)}, the undersigned visited the site to ${purpose}.`
  return applyTwoSpaceRule(sentence)
}

/** "  (See Photo #1.)" / "  (See Photos #1–#3.)" — appended after an item's
 * body text for whichever of its photos made it into the report appendix.
 * `numbers` are that item's 1-indexed appendix positions, in appendix order
 * — always contiguous, since the appendix groups photos by item. */
export function formatPhotoReference(numbers: number[] | undefined): string {
  if (!numbers || numbers.length === 0) return ''
  const first = numbers[0]
  const last = numbers[numbers.length - 1]
  const ref = first === last ? `Photo #${first}` : `Photos #${first}–#${last}`
  return `  (See ${ref}.)`
}

export interface ReportItemLine {
  n: number
  /** The bold qualifier prefix, including its trailing ": " — empty string
   * for item type "none", which gets no prefix at all. */
  label: string
  body: string
  photoRef: string
}

/** One line per item, in report order — "N.) LABEL: body (See Photo #n.)" —
 * as plain data, not markup. `photoNumbersByItem` is reportGeneration.ts's
 * `buildPhotoNumbersByItem` output. */
export function buildReportItemLines(items: Item[], photoNumbersByItem: Map<string, number[]>): ReportItemLine[] {
  return items.map((item, index) => ({
    n: index + 1,
    label: item.itemType === 'none' ? '' : `${itemTypeMeta(item.itemType).label.toUpperCase()}: `,
    body: applyTwoSpaceRule(item.bodyText.trim()),
    photoRef: formatPhotoReference(photoNumbersByItem.get(item.id)),
  }))
}
