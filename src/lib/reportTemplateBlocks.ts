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

export function buildItemsBlockXml(items: Item[]): string {
  if (items.length === 0) {
    return `${LEADING_SPACER}<w:p>${ITEM_PPR}<w:r>${ITEM_RPR}<w:t>No items were noted during this visit.</w:t></w:r></w:p>`
  }

  const parts = [LEADING_SPACER]
  for (const item of items) {
    const body = escapeXml(applyTwoSpaceRule(item.bodyText.trim()))
    const label = escapeXml(itemTypeMeta(item.itemType).label.toUpperCase())
    parts.push(
      `<w:p>${ITEM_PPR}` +
        `<w:r>${ITEM_RPR}<w:t xml:space="preserve">${item.sequenceNumber}.) </w:t></w:r>` +
        `<w:r>${ITEM_LABEL_RPR}<w:t xml:space="preserve">${label}: </w:t></w:r>` +
        `<w:r>${ITEM_RPR}<w:t xml:space="preserve">${body}</w:t></w:r>` +
        `</w:p>`,
    )
    parts.push(ITEM_SPACER)
  }
  return parts.join('')
}
