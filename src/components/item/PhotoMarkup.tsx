import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { PendingPhoto } from '../../db/photos'
import {
  MARKUP_COLORS,
  MARKUP_DEFAULT_COLOR,
  MARKUP_MIN_DRAG_PX,
  coverTransform,
  hitTestHandle,
  hitTestShapeBody,
  moveHandle,
  translateShape,
  type ShapeHandle,
} from '../../lib/photoMarkup'
import { useImageDimensions } from '../../lib/useImageDimensions'
import { useSafeObjectUrl } from '../../lib/useSafeObjectUrl'
import type { PhotoAnnotation } from '../../types/photo'
import { PhotoAnnotationsOverlay } from './PhotoAnnotationsOverlay'

type Tool = PhotoAnnotation['kind']

interface PhotoMarkupProps {
  photo: PendingPhoto
  onCancel: () => void
  onDone: (annotations: PhotoAnnotation[]) => void
}

/** A drag onto a handle within this many CSS px grabs it for resizing; a
 * drag onto the shape's body (but not a handle) within this many grabs it
 * for moving. Generous touch targets — precise finger placement on a small
 * arrow/circle stroke is unrealistic. Converted to image-space units at
 * gesture start via the live display-to-natural-pixel scale. */
const HANDLE_HIT_CLIENT_PX = 26
const BODY_HIT_CLIENT_PX = 20

type DragState =
  | { mode: 'handle'; index: number; handle: ShapeHandle }
  | { mode: 'move'; index: number; origin: PhotoAnnotation; start: { x: number; y: number } }

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
  const imageUrl = useSafeObjectUrl(photo.blob)
  const [tool, setTool] = useState<Tool>('arrow')
  const [color, setColor] = useState(MARKUP_DEFAULT_COLOR)
  const [shapes, setShapes] = useState<PhotoAnnotation[]>(photo.annotations)
  const [draft, setDraft] = useState<PhotoAnnotation | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const dragRef = useRef<DragState | null>(null)

  function toImageSpace(e: ReactPointerEvent<SVGSVGElement>): { x: number; y: number } {
    if (!dimensions) return { x: 0, y: 0 }
    const rect = e.currentTarget.getBoundingClientRect()
    const { scale, offsetX, offsetY } = coverTransform(rect, dimensions.width, dimensions.height)
    return {
      x: (e.clientX - rect.left - offsetX) / scale,
      y: (e.clientY - rect.top - offsetY) / scale,
    }
  }

  /** Image-space units per CSS px, via the same cover transform as
   * toImageSpace — a finger's effective precision is a constant number of
   * screen pixels, not image pixels, so every CSS-px tolerance below must
   * be converted through this at gesture start, not baked in as a fixed
   * image-space constant. */
  function displayScale(e: ReactPointerEvent<SVGSVGElement>): number {
    if (!dimensions) return 1
    const rect = e.currentTarget.getBoundingClientRect()
    return 1 / coverTransform(rect, dimensions.width, dimensions.height).scale
  }

  function handlePointerDown(e: ReactPointerEvent<SVGSVGElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = toImageSpace(e)
    const scale = displayScale(e)
    const tolerance = { handle: HANDLE_HIT_CLIENT_PX * scale, body: BODY_HIT_CLIENT_PX * scale }

    if (selectedIndex !== null) {
      const shape = shapes[selectedIndex]
      const handle = hitTestHandle(p, shape, tolerance.handle)
      if (handle) {
        dragRef.current = { mode: 'handle', index: selectedIndex, handle }
        return
      }
      if (hitTestShapeBody(p, shape, tolerance.body)) {
        dragRef.current = { mode: 'move', index: selectedIndex, origin: shape, start: p }
        return
      }
    }

    for (let i = shapes.length - 1; i >= 0; i--) {
      if (hitTestShapeBody(p, shapes[i], tolerance.body)) {
        setSelectedIndex(i)
        dragRef.current = { mode: 'move', index: i, origin: shapes[i], start: p }
        return
      }
    }

    setSelectedIndex(null)
    setDraft({ kind: tool, x1: p.x, y1: p.y, x2: p.x, y2: p.y, color })
  }

  function handlePointerMove(e: ReactPointerEvent<SVGSVGElement>) {
    const p = toImageSpace(e)
    const drag = dragRef.current
    if (drag) {
      if (drag.mode === 'handle') {
        setShapes((s) => s.map((shape, i) => (i === drag.index ? moveHandle(shape, drag.handle, p) : shape)))
      } else {
        const dx = p.x - drag.start.x
        const dy = p.y - drag.start.y
        setShapes((s) => s.map((shape, i) => (i === drag.index ? translateShape(drag.origin, dx, dy) : shape)))
      }
      return
    }
    if (!draft) return
    setDraft({ ...draft, x2: p.x, y2: p.y })
  }

  function handlePointerUp(e: ReactPointerEvent<SVGSVGElement>) {
    if (dragRef.current) {
      dragRef.current = null
      return
    }
    if (!draft) return
    const minDrag = MARKUP_MIN_DRAG_PX * displayScale(e)
    const longEnough = Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1) > minDrag
    if (longEnough) {
      setShapes((s) => [...s, draft])
      // Select the shape just drawn so its handles appear immediately —
      // a rough first drag rarely lands right, and dragging a handle right
      // after drawing is much easier than undoing and redrawing from scratch.
      setSelectedIndex(shapes.length)
    }
    setDraft(null)
  }

  function handleUndo() {
    setShapes((s) => s.slice(0, -1))
    setSelectedIndex(null)
  }

  function handleClear() {
    setShapes([])
    setSelectedIndex(null)
  }

  /** Removes just the selected shape — the fix for a stray, unintended
   * arrow/circle: rather than Undo (which only removes the most recently
   * drawn one, whichever that is) or Clear (which removes everything),
   * select the specific offending shape and delete only it. */
  function handleDeleteSelected() {
    if (selectedIndex === null) return
    setShapes((s) => s.filter((_, i) => i !== selectedIndex))
    setSelectedIndex(null)
  }

  const displayShapes = draft ? [...shapes, draft] : shapes

  return (
    // z-[60]: above every other fixed layer in the app, including the
    // PwaStatus corner notification (z-50) — a full-screen modal should
    // never have its own controls blocked by an incidental toast.
    <div className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-wr-blue-900">
      <div
        className="flex items-center justify-between px-4 pb-3.5 text-white"
        style={{ paddingTop: 'max(0.875rem, env(safe-area-inset-top))' }}
      >
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
        {imageUrl ? (
          <>
            <img src={imageUrl} alt="Site photo" className="absolute inset-0 h-full w-full object-cover" />
            {dimensions && (
              <PhotoAnnotationsOverlay
                naturalWidth={dimensions.width}
                naturalHeight={dimensions.height}
                annotations={displayShapes}
                selectedIndex={selectedIndex ?? undefined}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
              />
            )}
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center p-4 text-center font-body text-sm text-wr-ink-100">
            This photo couldn't be loaded, so it can't be marked up.
          </div>
        )}
      </div>

      <p className="mx-4 mt-3.5 text-center text-[13px] text-wr-taupe-200">
        {selectedIndex !== null
          ? 'Drag a handle to resize, drag the shape to move it, or delete it below.'
          : 'Drag on the photo to draw. Tap a shape to adjust or delete it.'}
      </p>

      <div
        className="mt-auto flex flex-col gap-3 overflow-y-auto bg-wr-blue-800 p-4"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        {selectedIndex !== null ? (
          <button
            type="button"
            onClick={handleDeleteSelected}
            className="min-h-[52px] w-full rounded border border-wr-danger bg-wr-danger font-body text-[15px] font-semibold text-white"
          >
            Delete this shape
          </button>
        ) : (
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
        )}
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
            onClick={handleUndo}
            disabled={shapes.length === 0}
            className="ml-auto min-h-11 rounded border border-wr-taupe-500 px-3.5 font-body text-sm font-medium text-white disabled:opacity-40"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={handleClear}
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
