/** One arrow or circle drawn on a photo in the markup overlay, in the
 * photo's own natural pixel coordinates (not the on-screen display size) —
 * so it scales correctly however small or large the photo is shown, and
 * rasterizes correctly onto the full 2000px image at report-generation
 * time regardless of what size it was drawn at. */
export interface PhotoAnnotation {
  kind: 'arrow' | 'circle'
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
}

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
  // Markup — arrows/circles drawn over the photo. The original blob is
  // never touched; annotations are burned onto a copy at report-generation
  // time (see reportImages.ts) and drawn as an SVG overlay for on-screen
  // thumbnails. Optional so photos saved before this feature existed
  // (annotations undefined) still load fine — treat as "no markup".
  annotations?: PhotoAnnotation[]
}
