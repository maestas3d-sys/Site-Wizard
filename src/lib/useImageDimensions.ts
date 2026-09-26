import { useEffect, useState } from 'react'

interface Dimensions {
  width: number
  height: number
}

/** Decodes a photo blob just to read its natural pixel size — annotation
 * coordinates are always in this space (the full 2000px image, not
 * whatever size it's displayed at), so both the markup overlay and any
 * thumbnail showing annotations need it for their SVG viewBox. `null`
 * while decoding, and permanently for a missing/corrupt blob (a record
 * from an older schema version, an interrupted write); a blob change
 * re-decodes. */
export function useImageDimensions(blob: unknown): Dimensions | null {
  const [dimensions, setDimensions] = useState<Dimensions | null>(null)

  useEffect(() => {
    if (!(blob instanceof Blob)) {
      console.error('useImageDimensions: not a Blob', blob)
      return
    }
    let cancelled = false
    // No synchronous reset to null here on purpose: a given photo's blob is
    // immutable once created (see photoProcessing.ts), so in practice this
    // effect only ever runs once per component instance — resetting first
    // would just be an extra render for a transition that doesn't happen.
    //
    // createImageBitmap throws synchronously (not a rejected promise) on
    // anything that isn't decodable image data, which an uncaught error
    // during an effect still takes to the nearest error boundary — so this
    // whole call is wrapped, not just its rejection handler.
    try {
      createImageBitmap(blob).then(
        (bitmap) => {
          if (!cancelled) setDimensions({ width: bitmap.width, height: bitmap.height })
          bitmap.close()
        },
        (err: unknown) => {
          console.error('Failed to decode photo dimensions:', err)
        },
      )
    } catch (err) {
      console.error('Failed to decode photo dimensions:', err)
    }
    return () => {
      cancelled = true
    }
  }, [blob])

  return dimensions
}
