export type ItemType =
  | 'deficiency' // correct it
  | 'acceptable' // acceptable as-is, possibly with condition
  | 'requires-rfi'
  | 'requires-ccd'
  | 'info-requested' // asks another party to confirm or provide
  | 'not-observable' // couldn't be seen at time of visit
  | 'progress-note'

export interface DetailRef {
  raw: string // "5/S4.1"
  detailNumber: string // "5"
  sheetNumber: string // "S4.1"
  documentSet?: string // "CCD 002"
  validated: boolean // matched against Project.sheets — never auto-corrected
}

export interface Measurement {
  label: string
  value: string
  unit: string
}

export interface Item {
  id: string
  visitId: string
  sequenceNumber: number // display order, reorderable — drives report numbering
  gridRef: string // "4-A", "grids 4-1 and 4-A", "grid 6"
  elementRef: string // "SE corner of mechanical well"
  levelRef: string // "high roof", "slab on grade"
  itemType: ItemType
  bodyText: string // the item as it will appear in the report
  detailRefs: DetailRef[]
  measurements: Measurement[]
  photoIds: string[]
  audioId?: string
  transcript?: string // populated only once transcription (§7) is built
  createdAt: number
  updatedAt: number
}
