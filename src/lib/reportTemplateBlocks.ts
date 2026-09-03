import type { Item } from '../types/item'
import type { Attendee } from '../types/visit'
import { applyTwoSpaceRule } from './houseStyle'
import { itemTypeMeta } from './itemTypes'
import { escapeXml } from './xmlEscape'

/**
 * Raw OOXML for the PRESENT: and item-list blocks, inserted via
 * docxtemplater's `{@tag}` (unescaped raw-XML insertion) rather than a
 * `{#loop}`. A docxtemplater paragraph-loop repeats *every* paragraph in
 * its body once per item, which doesn't fit here: only the first attendee
 * shares a line with the "PRESENT:" label, and items need a numbered
 * "N.) " prefix plus a spacer paragraph between them. Building the exact
 * paragraphs ourselves — matching the source template's original
 * formatting byte-for-byte — sidesteps the mismatch entirely.
 */

const ATTENDEE_PPR =
  '<w:pPr><w:widowControl w:val="0"/><w:tabs><w:tab w:val="left" w:pos="1620"/><w:tab w:val="left" w:pos="3960"/><w:tab w:val="left" w:pos="6210"/></w:tabs><w:ind w:left="1800" w:hanging="1800"/><w:rPr><w:rFonts w:ascii="Futura Bk BT" w:hAnsi="Futura Bk BT"/><w:snapToGrid w:val="0"/><w:sz w:val="24"/></w:rPr></w:pPr>'
const ATTENDEE_LABEL_RPR =
  '<w:rPr><w:rFonts w:ascii="Futura Bk BT" w:hAnsi="Futura Bk BT"/><w:b/><w:snapToGrid w:val="0"/><w:sz w:val="24"/></w:rPr>'
const ATTENDEE_TEXT_RPR =
  '<w:rPr><w:rFonts w:ascii="Futura Bk BT" w:hAnsi="Futura Bk BT"/><w:snapToGrid w:val="0"/><w:sz w:val="24"/></w:rPr>'

function formatAttendee(attendee: Attendee): string {
  const name = escapeXml(attendee.name.trim())
  const firm = escapeXml(attendee.firm.trim())
  if (name && firm) return `${name}, ${firm}`
  return name || firm
}

export function buildPresentBlockXml(attendees: Attendee[]): string {
  const label = `<w:r>${ATTENDEE_LABEL_RPR}<w:t>PRESENT:</w:t></w:r>`

  if (attendees.length === 0) {
    return `<w:p>${ATTENDEE_PPR}${label}</w:p>`
  }

  const [first, ...rest] = attendees
  const firstLine = `<w:p>${ATTENDEE_PPR}${label}<w:r>${ATTENDEE_TEXT_RPR}<w:tab/><w:t xml:space="preserve">${formatAttendee(first)}</w:t></w:r></w:p>`
  const restLines = rest
    .map(
      (a) =>
        `<w:p>${ATTENDEE_PPR}<w:r>${ATTENDEE_TEXT_RPR}<w:tab/><w:t xml:space="preserve">${formatAttendee(a)}</w:t></w:r></w:p>`,
    )
    .join('')
  return firstLine + restLines
}

const GENERAL_STATE_PPR =
  '<w:pPr><w:widowControl w:val="0"/><w:tabs><w:tab w:val="left" w:pos="900"/><w:tab w:val="left" w:pos="3960"/><w:tab w:val="left" w:pos="5490"/></w:tabs><w:rPr><w:rFonts w:ascii="Futura Bk BT" w:hAnsi="Futura Bk BT"/><w:snapToGrid w:val="0"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr>'
const GENERAL_STATE_RPR =
  '<w:rPr><w:rFonts w:ascii="Futura Bk BT" w:hAnsi="Futura Bk BT"/><w:snapToGrid w:val="0"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>'
const GENERAL_STATE_BLANK = `<w:p>${GENERAL_STATE_PPR}</w:p>`

/** Raw XML for the optional "At the time of the observation..." lead-in +
 * general-state paragraph, plus the blank line that used to precede it
 * unconditionally in the template. This used to be a docxtemplater
 * `{#generalState}` boolean section, on the assumption that an empty value
 * would omit the whole section — it doesn't: docxtemplater only blanks the
 * runs inside, leaving empty paragraphs behind, and that leading blank line
 * was *always* there regardless — together, 2 blank lines above "During the
 * visit..." whenever generalState was empty. Building it as a raw-XML
 * anchor instead — same pattern as presentBlock/itemsBlock — sidesteps
 * that: an empty generalState renders nothing at all here, so the static
 * small spacer already before "During the visit..." is the only gap,
 * matching house style; a filled one reproduces the original leading blank
 * + intro + blank + value layout. */
export function buildGeneralStateBlockXml(generalState: string): string {
  const text = applyTwoSpaceRule(generalState.trim())
  if (!text) return ''

  const intro = `<w:p>${GENERAL_STATE_PPR}<w:r>${GENERAL_STATE_RPR}<w:t xml:space="preserve">At the time of the observation, construction progress was as follows: </w:t></w:r></w:p>`
  const value = `<w:p>${GENERAL_STATE_PPR}<w:r>${GENERAL_STATE_RPR}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`
  return GENERAL_STATE_BLANK + intro + GENERAL_STATE_BLANK + value
}

const ITEM_PPR =
  '<w:pPr><w:widowControl w:val="0"/><w:rPr><w:rFonts w:ascii="Futura Bk BT" w:hAnsi="Futura Bk BT"/><w:snapToGrid w:val="0"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr>'
const ITEM_RPR =
  '<w:rPr><w:rFonts w:ascii="Futura Bk BT" w:hAnsi="Futura Bk BT"/><w:snapToGrid w:val="0"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>'
// Same run properties as ITEM_RPR, plus bold — used for the item-type label
// ("DEFICIENCY:", "REQUIRES CCD:", …) that leads each item's body text.
const ITEM_LABEL_RPR =
  '<w:rPr><w:rFonts w:ascii="Futura Bk BT" w:hAnsi="Futura Bk BT"/><w:b/><w:bCs/><w:snapToGrid w:val="0"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>'
const LEADING_SPACER_PPR =
  '<w:pPr><w:widowControl w:val="0"/><w:rPr><w:rFonts w:ascii="Futura Bk BT" w:hAnsi="Futura Bk BT"/><w:snapToGrid w:val="0"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:pPr>'

const ITEM_SPACER = `<w:p>${ITEM_PPR}</w:p>`
const LEADING_SPACER = `<w:p>${LEADING_SPACER_PPR}</w:p>`

/** "  (See Photo #1.)" / "  (See Photos #1–#3.)" — appended after an item's
 * body text for whichever of its photos made it into the report appendix.
 * `numbers` are that item's 1-indexed appendix positions, in appendix order
 * — always contiguous, since the appendix groups photos by item. Not part
 * of the stored bodyText (which is never auto-edited): this is composed
 * only in the rendered XML, from the same numbering injectPhotos assigns. */
function formatPhotoReference(numbers: number[] | undefined): string {
  if (!numbers || numbers.length === 0) return ''
  const first = numbers[0]
  const last = numbers[numbers.length - 1]
  const ref = first === last ? `Photo #${first}` : `Photos #${first}–#${last}`
  return `  (See ${ref}.)`
}

export function buildItemsBlockXml(items: Item[], photoNumbersByItem: Map<string, number[]>): string {
  if (items.length === 0) {
    return `${LEADING_SPACER}<w:p>${ITEM_PPR}<w:r>${ITEM_RPR}<w:t>No items were noted during this visit.</w:t></w:r></w:p>`
  }

  const parts = [LEADING_SPACER]
  for (const item of items) {
    const body = escapeXml(applyTwoSpaceRule(item.bodyText.trim()))
    const label = escapeXml(itemTypeMeta(item.itemType).label.toUpperCase())
    const photoRef = escapeXml(formatPhotoReference(photoNumbersByItem.get(item.id)))
    parts.push(
      `<w:p>${ITEM_PPR}` +
        `<w:r>${ITEM_RPR}<w:t xml:space="preserve">${item.sequenceNumber}.) </w:t></w:r>` +
        `<w:r>${ITEM_LABEL_RPR}<w:t xml:space="preserve">${label}: </w:t></w:r>` +
        `<w:r>${ITEM_RPR}<w:t xml:space="preserve">${body}${photoRef}</w:t></w:r>` +
        `</w:p>`,
    )
    parts.push(ITEM_SPACER)
  }
  return parts.join('')
}
