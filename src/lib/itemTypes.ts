import type { ItemType } from '../types/item'

interface ItemTypeMeta {
  value: ItemType
  label: string
  /** Background/text pair (design handoff, "Item-type colors") — used as
   * the badge fill everywhere an item's type is shown, and as the
   * selected-chip fill in Item Capture. Plain hex, not Tailwind classes:
   * these are looked up at render time in a few different combinations
   * (badge, selected chip + border, solid quick-type button), so inline
   * styles are more direct here than constructing class-name strings. */
  bg: string
  text: string
}

export const ITEM_TYPES: ItemTypeMeta[] = [
  { value: 'deficiency', label: 'Deficiency', bg: '#F4E3E0', text: '#A13D33' },
  { value: 'acceptable', label: 'Acceptable', bg: '#E1EEE6', text: '#3F7D5C' },
  { value: 'requires-rfi', label: 'Requires RFI', bg: '#EEE7DB', text: '#59462A' },
  { value: 'requires-ccd', label: 'Requires CCD', bg: '#F5ECD9', text: '#8A5F16' },
  { value: 'info-requested', label: 'Info Requested', bg: '#E3EDF0', text: '#0A5468' },
  { value: 'not-observable', label: 'Not Observable', bg: '#ECE9E0', text: '#6B7477' },
  { value: 'progress-note', label: 'Progress Note', bg: '#DCE6E9', text: '#003D4C' },
  // No bold qualifier prefix in the report for this one — see buildItemsBlockXml.
  { value: 'none', label: 'None', bg: '#FFFFFF', text: '#3D4649' },
]

const BY_VALUE = new Map(ITEM_TYPES.map((t) => [t.value, t]))

export function itemTypeMeta(type: ItemType): ItemTypeMeta {
  // BY_VALUE is seeded from ITEM_TYPES, which covers every ItemType — safe to assert.
  return BY_VALUE.get(type)!
}

/** The 3 "quick type" swipe-row buttons (deficiency/acceptable/requires-rfi)
 * use the type's *text* color as a solid background with white text —
 * distinct enough from the badge/chip fill to read as an action, not a
 * label. Not every type gets a quick button — the other five stay reachable
 * through the item edit form's full type grid. */
export const QUICK_ITEM_TYPES: { value: ItemType; shortLabel: string }[] = [
  { value: 'deficiency', shortLabel: 'Defic.' },
  { value: 'acceptable', shortLabel: 'OK' },
  { value: 'requires-rfi', shortLabel: 'RFI' },
]
