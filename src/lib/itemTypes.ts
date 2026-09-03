import type { ItemType } from '../types/item'

interface ItemTypeMeta {
  value: ItemType
  label: string
  /** Tailwind classes for the colored chip, both selected and list-badge use. */
  colorClasses: string
}

export const ITEM_TYPES: ItemTypeMeta[] = [
  { value: 'deficiency', label: 'Deficiency', colorClasses: 'bg-red-100 text-red-700' },
  { value: 'acceptable', label: 'Acceptable', colorClasses: 'bg-green-100 text-green-700' },
  { value: 'requires-rfi', label: 'Requires RFI', colorClasses: 'bg-purple-100 text-purple-700' },
  { value: 'requires-ccd', label: 'Requires CCD', colorClasses: 'bg-orange-100 text-orange-700' },
  { value: 'info-requested', label: 'Info Requested', colorClasses: 'bg-blue-100 text-blue-700' },
  { value: 'not-observable', label: 'Not Observable', colorClasses: 'bg-slate-200 text-slate-600' },
  { value: 'progress-note', label: 'Progress Note', colorClasses: 'bg-teal-100 text-teal-700' },
]

const BY_VALUE = new Map(ITEM_TYPES.map((t) => [t.value, t]))

export function itemTypeMeta(type: ItemType): ItemTypeMeta {
  // BY_VALUE is seeded from ITEM_TYPES, which covers every ItemType — safe to assert.
  return BY_VALUE.get(type)!
}
