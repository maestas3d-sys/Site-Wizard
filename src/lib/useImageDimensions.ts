import { useEffect, useState } from 'react'

interface Dimensions {
  width: number
  height: number
}

/** Decodes a photo blob just to read its natural pixel size — annotation
 * coordinates are always in this space (the full 2000px image, not
 * whatever size it's displayed at), so both the markup overlay and any
 * thumbnail showing annotations need it for their SVG viewBox. `null`
 * while decoding; a blob change re-decodes. */
export function useImageDimensions(blob: Blob): Dimensions | null {
  const [dimensions, setDimensions] = useState<Dimensions | null>(null)

  useEffect(() => {
    let cancelled = false
    // No synchronous reset to null here on purpose: a given photo's blob is
    // immutable once created (see photoProcessing.ts), so in practice this
    // effect only ever runs once per component instance — resetting first
    // would just be an extra render for a transition that doesn't happen.
    createImageBitmap(blob).then(
      (bitmap) => {
        if (!cancelled) setDimensions({ width: bitmap.width, height: bitmap.height })
        bitmap.close()
      },
      (err: unknown) => {
        console.error('Failed to decode photo dimensions:', err)
      },
    )
    return () => {
      cancelled = true
    }
  }, [blob])

  return dimensions
}
