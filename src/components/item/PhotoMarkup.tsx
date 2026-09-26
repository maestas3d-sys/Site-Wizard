import { useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { PendingPhoto } from '../../db/photos'
import { MARKUP_COLORS, MARKUP_DEFAULT_COLOR, MARKUP_MIN_DRAG_PX } from '../../lib/photoMarkup'
import { useImageDimensions } from '../../lib/useImageDimensions'
import type { PhotoAnnotation } from '../../types/photo'
import { PhotoAnnotationsOverlay } from './PhotoAnnotationsOverlay'

type Tool = PhotoAnnotation['kind']

interface PhotoMarkupProps {
  photo: PendingPhoto
  onCancel: () => void
  onDone: (annotations: PhotoAnnotation[]) => void
}

/**
 * Full-screen markup overlay (design handoff, screen 7) — draws arrows and
 * circles over a copy of the photo. The original blob is never touched;
 * `onDone` hands back the annotation list for the caller to store on the
 * (pending, not-yet-saved) photo. Coordinates are tracked in the photo's
 * own natural pixel space throughout, mapped from client space via the
 * displayed image's bounding rect, so this works the same at any screen
 * size and produces annotations that rasterize correctly at full report
 * resolution later (see reportImages.ts).
 */
export function PhotoMarkup({ photo, onCancel, onDone }: PhotoMarkupProps) {
  const dimensions = useImageDimensions(photo.blob)
  const imageUrl = useMemo(() => URL.createObjectURL(photo.blob), [photo.blob])
  useEffect(() => () => URL.revokeObjectURL(imageUrl), [imageUrl])
  const [tool, setTool] = useState<Tool>('arrow')
  const [color, setColor] = useState(MARKUP_DEFAULT_COLOR)
  const [shapes, setShapes] = useState<PhotoAnnotation[]>(photo.annotations)
  const [draft, setDraft] = useState<PhotoAnnotation | null>(null)

  function toImageSpace(e: ReactPointerEvent<SVGSVGElement>): { x: number; y: number } {
    if (!dimensions) return { x: 0, y: 0 }
    const rect = e.currentTarget.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * dimensions.width,
      y: ((e.clientY - rect.top) / rect.height) * dimensions.height,
    }
  }

  function handlePointerDown(e: ReactPointerEvent<SVGSVGElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = toImageSpace(e)
    setDraft({ kind: tool, x1: p.x, y1: p.y, x2: p.x, y2: p.y, color })
  }

  function handlePointerMove(e: ReactPointerEvent<SVGSVGElement>) {
    if (!draft) return
    const p = toImageSpace(e)
    setDraft({ ...draft, x2: p.x, y2: p.y })
  }

  function handlePointerUp() {
    if (!draft) return
    const longEnough = Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1) > MARKUP_MIN_DRAG_PX
    if (longEnough) setShapes((s) => [...s, draft])
    setDraft(null)
  }

  const displayShapes = draft ? [...shapes, draft] : shapes

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-wr-blue-900">
      <div className="flex items-center justify-between p-3.5 px-4 text-white">
        <button type="button" onClick={onCancel} className="min-h-11 font-body text-[15px] font-medium text-wr-taupe-200">
          Cancel
        </button>
        <span className="font-heading text-[17px] font-semibold">Mark up photo</span>
        <button
          type="button"
          onClick={() => onDone(shapes)}
          className="min-h-10 rounded bg-white px-4 font-body text-[15px] font-semibold text-wr-blue-800"
        >
          Done
        </button>
      </div>

      <div className="relative mx-4 mt-6 overflow-hidden rounded-sm bg-wr-taupe-500" style={{ aspectRatio: '358 / 268' }}>
        <img src={imageUrl} alt="Site photo" className="absolute inset-0 h-full w-full object-cover" />
        {dimensions && (
          <PhotoAnnotationsOverlay
            naturalWidth={dimensions.width}
            naturalHeight={dimensions.height}
            annotations={displayShapes}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />
        )}
      </div>

      <p className="mx-4 mt-3.5 text-center text-[13px] text-wr-taupe-200">
        Drag on the photo to draw. Markup is saved as a copy; the original stays untouched.
      </p>

      <div className="mt-auto flex flex-col gap-3 bg-wr-blue-800 p-4 pb-6">
        <div className="flex gap-2">
          {(['arrow', 'circle'] as const).map((t) => {
            const selected = tool === t
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTool(t)}
                className="min-h-[52px] flex-1 rounded border border-wr-taupe-500 font-body text-[15px] font-semibold"
                style={selected ? { background: '#fff', color: '#003D4C' } : { background: 'transparent', color: '#fff' }}
              >
                {t === 'arrow' ? 'Arrow' : 'Circle'}
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-2.5">
          {MARKUP_COLORS.map((c) => (
            <button
              key={c.hex}
              type="button"
              onClick={() => setColor(c.hex)}
              aria-label={c.name}
              className="h-10 w-10 rounded-full"
              style={{ background: c.hex, border: `3px solid ${color === c.hex ? '#fff' : 'transparent'}` }}
            />
          ))}
          <button
            type="button"
            onClick={() => setShapes((s) => s.slice(0, -1))}
            disabled={shapes.length === 0}
            className="ml-auto min-h-11 rounded border border-wr-taupe-500 px-3.5 font-body text-sm font-medium text-white disabled:opacity-40"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={() => setShapes([])}
            disabled={shapes.length === 0}
            className="min-h-11 rounded border border-wr-taupe-500 px-3.5 font-body text-sm font-medium text-white disabled:opacity-40"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  )
}
