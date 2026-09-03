import { parse as parseExif } from 'exifr'

// Report-quality print rarely needs more than this on the long edge.
const FULL_MAX_DIMENSION = 2000
const THUMB_MAX_DIMENSION = 300
const FULL_JPEG_QUALITY = 0.85
const THUMB_JPEG_QUALITY = 0.8

export interface ProcessedPhoto {
  blob: Blob
  thumbBlob: Blob
  exifTimestamp?: number
  orientationCorrected: boolean
}

async function readExifTimestamp(file: File): Promise<number | undefined> {
  try {
    const exif = await parseExif(file, ['DateTimeOriginal'])
    const dateTaken = exif?.DateTimeOriginal
    return dateTaken instanceof Date ? dateTaken.getTime() : undefined
  } catch {
    // Not a JPEG, no EXIF block, corrupt data — a missing timestamp is fine.
    return undefined
  }
}

function drawToJpegBlob(bitmap: ImageBitmap, maxDimension: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  ctx.drawImage(bitmap, 0, 0, width, height)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('canvas.toBlob returned null'))),
      'image/jpeg',
      quality,
    )
  })
}

/**
 * Downscales a captured/imported photo to a report-ready full size and a
 * thumbnail, both re-encoded as JPEG. EXIF orientation is corrected by
 * `imageOrientation: 'from-image'` on decode — the pixels are physically
 * rotated into place here, so nothing downstream (Word included) needs to
 * interpret an orientation tag to render right-side up.
 */
export async function processPhotoFile(file: File): Promise<ProcessedPhoto> {
  const [exifTimestamp, bitmap] = await Promise.all([
    readExifTimestamp(file),
    createImageBitmap(file, { imageOrientation: 'from-image' }),
  ])
  try {
    const [blob, thumbBlob] = await Promise.all([
      drawToJpegBlob(bitmap, FULL_MAX_DIMENSION, FULL_JPEG_QUALITY),
      drawToJpegBlob(bitmap, THUMB_MAX_DIMENSION, THUMB_JPEG_QUALITY),
    ])
    return { blob, thumbBlob, exifTimestamp, orientationCorrected: true }
  } finally {
    bitmap.close()
  }
}
