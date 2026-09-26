import { useState } from 'react'
import type { PendingPhoto } from '../../db/photos'
import { newId } from '../../lib/id'
import { processPhotoFile } from '../../lib/photoProcessing'
import { useImageDimensions } from '../../lib/useImageDimensions'
import { PhotoAnnotationsOverlay } from './PhotoAnnotationsOverlay'
import { PhotoThumb } from './PhotoThumb'

interface PhotoCaptureProps {
  photos: PendingPhoto[]
  onChange: (next: PendingPhoto[]) => void
  /** Opens the full-screen markup overlay for this photo — owned by the
   * parent (Item Capture) since it needs to sit above the whole form. */
  onMarkup: (photo: PendingPhoto) => void
}

function PhotoThumbCard({
  photo,
  onMarkup,
  onRemove,
}: {
  photo: PendingPhoto
  onMarkup: () => void
  onRemove: () => void
}) {
  // The overlay's viewBox must match the space annotations were drawn in —
  // the full photo, not this thumbnail — even though the visible image
  // here is the smaller thumbBlob; matching aspect ratios keep them aligned.
  const dimensions = useImageDimensions(photo.blob)
  const hasMarkup = photo.annotations.length > 0

  return (
    <div className="relative h-24 w-24 flex-none">
      <button type="button" onClick={onMarkup} className="block h-24 w-24 overflow-hidden rounded">
        <div className="relative h-full w-full">
          <PhotoThumb blob={photo.thumbBlob} />
          {hasMarkup && dimensions && (
            <PhotoAnnotationsOverlay
              naturalWidth={dimensions.width}
              naturalHeight={dimensions.height}
              annotations={photo.annotations}
            />
          )}
          {hasMarkup && (
            <span className="absolute bottom-1 left-1 rounded-sm bg-wr-blue-800 px-[5px] py-px text-[11px] font-semibold text-white">
              Marked up
            </span>
          )}
        </div>
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove photo"
        className="absolute -right-2 -top-2 flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 border-wr-paper bg-wr-ink-900 text-[13px] font-bold text-white"
      >
        ×
      </button>
    </div>
  )
}

/**
 * Camera capture and gallery import, multiple per item (§4.3). Every file
 * is downscaled, orientation-corrected, and thumbnailed on selection —
 * before this item is ever saved, so what's shown here is exactly what
 * will be stored. Tapping a photo opens it for markup (arrows/circles).
 */
export function PhotoCapture({ photos, onChange, onMarkup }: PhotoCaptureProps) {
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setProcessing(true)
    setError(null)
    const files = Array.from(fileList)
    const newPhotos: PendingPhoto[] = []
    for (const file of files) {
      try {
        const processed = await processPhotoFile(file)
        newPhotos.push({ id: newId(), ...processed, caption: '', includeInReport: true, annotations: [] })
      } catch (err) {
        console.error('Failed to process photo:', file.name, err)
      }
    }
    if (newPhotos.length > 0) onChange([...photos, ...newPhotos])
    if (newPhotos.length < files.length) {
      setError(
        files.length === 1
          ? "That photo couldn't be processed. Try again or pick a different one."
          : `${files.length - newPhotos.length} of ${files.length} photos couldn't be processed.`,
      )
    }
    setProcessing(false)
  }

  function removePhoto(id: string) {
    onChange(photos.filter((p) => p.id !== id))
  }

  return (
    <div className="space-y-2">
      <div className="scroll-y-clean flex gap-2.5 overflow-x-auto overflow-y-hidden py-0.5">
        {photos.map((photo) => (
          <PhotoThumbCard
            key={photo.id}
            photo={photo}
            onMarkup={() => onMarkup(photo)}
            onRemove={() => removePhoto(photo.id)}
          />
        ))}

        {/* focus-within:outline-none: Safari/iOS draws a focus ring on the
            label itself once its hidden file input gets focus back after
            the native camera/photo picker closes — a leftover outline on
            top of (not part of) the tile's own intentional dashed border. */}
        {/* text-center: items-center only centers each label's flex-column
            children as boxes — a short one-line span like "+" is already as
            narrow as its glyph, so that alone looks centered, but a span
            that wraps (like "Choose photos" here) stretches nearly the full
            tile width, and text-align defaults to left within it, leaving
            the wrapped words pinned to the left edge under a centered "+". */}
        <label className="flex h-24 w-24 flex-none cursor-pointer flex-col items-center justify-center gap-0.5 rounded border-[1.5px] border-dashed border-wr-blue-800 text-center font-body text-[13px] font-semibold text-wr-blue-800 focus-within:outline-none">
          <span aria-hidden="true">+</span>
          <span>Take photo</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden outline-none"
            onChange={(e) => {
              void handleFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
        <label className="flex h-24 w-24 flex-none cursor-pointer flex-col items-center justify-center gap-0.5 rounded border-[1.5px] border-dashed border-wr-blue-800 text-center font-body text-[13px] font-semibold text-wr-blue-800 focus-within:outline-none">
          <span aria-hidden="true">+</span>
          <span>Choose photos</span>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden outline-none"
            onChange={(e) => {
              void handleFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
      </div>

      {processing && <p className="text-sm text-wr-ink-500">Processing…</p>}
      {error && <p className="text-sm text-wr-danger">{error}</p>}
    </div>
  )
}
