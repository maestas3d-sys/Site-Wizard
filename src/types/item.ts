export type ItemType =
  | 'deficiency' // correct it
  | 'acceptable' // acceptable as-is, possibly with condition
  | 'requires-rfi'
  | 'requires-ccd'
  | 'info-requested' // asks another party to confirm or provide
  | 'not-observable' // couldn't be seen at time of visit
  | 'progress-note'
  | 'none' // no qualifier label in the report — body text stands on its own

export interface Item {
  id: string
  visitId: string
  sequenceNumber: number // display order, reorderable — drives report numbering
  itemType: ItemType
  bodyText: string // the item as it will appear in the report — grid/element/level/detail
  // references go here as free text if the engineer needs them; there's no
  // separate structured field for any of that (dropped per feedback: too
  // tedious to type per item for what it added).
  photoIds: string[]
  audioId?: string
  transcript?: string // populated only once transcription (§7) is built
  createdAt: number
  updatedAt: number
}
