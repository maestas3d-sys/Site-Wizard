export interface Photo {
  id: string
  visitId: string
  itemId?: string
  blob: Blob // full image, downscaled to 2000px long edge
  thumbBlob: Blob // 300px thumbnail
  label: string // "Photo #1" — assigned at report generation
  caption: string
  exifTimestamp?: number
  orientationCorrected: boolean
  includeInReport: boolean
  orderIndex: number
}
