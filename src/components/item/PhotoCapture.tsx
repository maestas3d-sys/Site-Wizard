import { useState } from 'react'
import type { PendingPhoto } from '../../db/photos'
import { newId } from '../../lib/id'
import { processPhotoFile } from '../../lib/photoProcessing'
import { PhotoThumb } from './PhotoThumb'

interface PhotoCaptureProps {
  photos: PendingPhoto[]
  onChange: (next: PendingPhoto[]) => void
}

/**
 * Camera capture and gallery import, multiple per item (§4.3). Every file
 * is downscaled, orientation-corrected, and thumbnailed on selection —
 * before this item is ever saved, so what's shown here is exactly what
 * will be stored.
 */
export function PhotoCapture({ photos, onChange }: PhotoCaptureProps) {
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
        newPhotos.push({ id: newId(), ...processed, caption: '', includeInReport: true })
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
    <div className="space-y-3">
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {photos.map((photo) => (
            <div key={photo.id} className="relative">
              <PhotoThumb blob={photo.thumbBlob} className="h-20 w-20 rounded-lg" />
              <button
                type="button"
                onClick={() => removePhoto(photo.id)}
                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white shadow"
                aria-label="Remove photo"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <label className="flex min-h-12 min-w-32 flex-1 cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 active:bg-slate-50">
          📷 Take Photo
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              void handleFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
        <label className="flex min-h-12 min-w-32 flex-1 cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 active:bg-slate-50">
          🖼️ Choose Photos
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              void handleFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
      </div>

      {processing && <p className="text-sm text-slate-500">Processing…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
