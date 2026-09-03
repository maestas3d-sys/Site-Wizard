/** One detail callout on a sheet, e.g. {number: "5", title: "Strap at Blocking"}. */
export interface SheetDetail {
  number: string
  title?: string
}

/** A drawing sheet, entered once per project to power detail-reference autocomplete. */
export interface Sheet {
  sheetNumber: string // "S4.1"
  title?: string // "Framing Details"
  documentSet: string // "Permit Set" | "CCD 002" | "As-Built"
  details: SheetDetail[]
}

export interface Project {
  id: string
  jobNumber: string // "24-087"
  name: string // "MHHS Athletic Improvements"
  location: string // "San Marcos, CA"
  clientFirm: string // "tBP/Architecture"
  clientCity: string // "Solana Beach, CA"
  clientAttn: string // "Chuck Forte"
  gridLetters: string[] // ["A","B","C","D"]
  gridNumbers: string[] // ["1","2","3","4","5","6"]
  sheets: Sheet[]
  elementPresets: string[] // learned autocomplete: "mechanical well", "SE tower"
  createdAt: number
}
