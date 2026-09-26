import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { AppBar } from '../components/ui/AppBar'
import { Button } from '../components/ui/Button'
import { ScreenLayout } from '../components/ui/ScreenLayout'
import { Toast } from '../components/ui/Toast'
import { db } from '../db/db'
import { deleteItem, listItemsByVisit, patchItem } from '../db/items'
import { formatDateMedium } from '../lib/reportDates'
import { itemTypeMeta, QUICK_ITEM_TYPES } from '../lib/itemTypes'
import { useToast } from '../lib/useToast'
import type { Item, ItemType } from '../types/item'

const UNDO_WINDOW_MS = 6000
/** Swiping right past this reveals the quick-type buttons and stays open;
 * left past this (negative) reveals Delete. Matches the design handoff's
 * exact snap thresholds and clamp range. */
const OPEN_RIGHT_PX = 192
const OPEN_LEFT_PX = -96
const SNAP_RIGHT_THRESHOLD = 90
const SNAP_LEFT_THRESHOLD = -48
const DRAG_START_THRESHOLD_PX = 6

interface SwipeRowProps {
  item: Item
  offset: number
  dragging: boolean
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void
  onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void
  onPointerUp: () => void
  onQuickType: (type: ItemType) => void
  onDelete: () => void
}

function SwipeRow({ item, offset, dragging, onPointerDown, onPointerMove, onPointerUp, onQuickType, onDelete }: SwipeRowProps) {
  const meta = itemTypeMeta(item.itemType)
  const metaText = [
    item.photoIds.length > 0 ? `${item.photoIds.length} photo${item.photoIds.length > 1 ? 's' : ''}` : '',
    item.audioId ? 'memo' : '',
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="relative overflow-hidden rounded bg-wr-taupe-100">
      <div className="absolute inset-0 flex">
        {QUICK_ITEM_TYPES.map((q) => (
          <button
            key={q.value}
            type="button"
            onClick={() => onQuickType(q.value)}
            style={{ background: itemTypeMeta(q.value).text }}
            className="w-16 font-body text-xs font-semibold leading-tight text-white"
          >
            {q.shortLabel}
          </button>
        ))}
        <button type="button" onClick={onDelete} className="ml-auto w-24 bg-wr-danger font-body text-sm font-semibold text-white">
          Delete
        </button>
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging ? 'none' : 'transform 180ms ease',
          touchAction: 'pan-y',
        }}
        className="relative flex select-none gap-3 rounded border border-wr-taupe-200 bg-white p-3"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-wr-blue-900">#{item.sequenceNumber}</span>
            <span
              className="rounded-sm px-2 py-0.5 text-xs font-semibold"
              style={{ background: meta.bg, color: meta.text }}
            >
              {meta.label}
            </span>
            {metaText && <span className="ml-auto shrink-0 text-xs text-wr-ink-500">{metaText}</span>}
          </div>
          <p className="mt-1.5 line-clamp-2 text-sm leading-snug text-wr-ink-700">
            {item.bodyText || <span className="text-wr-ink-300">No body text yet</span>}
          </p>
        </div>
      </div>
    </div>
  )
}

export function VisitDetailPage() {
  const { visitId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const visit = useLiveQuery(() => (visitId ? db.visits.get(visitId) : undefined), [visitId])
  const project = useLiveQuery(() => (visit ? db.projects.get(visit.projectId) : undefined), [visit])
  const items = useLiveQuery(() => (visitId ? listItemsByVisit(visitId) : undefined), [visitId])
  const { toastText, showToast } = useToast()

  // "Field Report #N started" arrives as navigation state from the New
  // Visit screen (that page unmounts before its own toast timer would
  // fire) — show it once, then clear the state so back/forward or a
  // refresh doesn't replay it.
  useEffect(() => {
    const state = location.state as { toast?: string } | null
    if (state?.toast) {
      showToast(state.toast)
      navigate(location.pathname, { replace: true, state: null })
    }
    // Runs once on mount only — re-running on every location/navigate
    // identity change would re-fire the toast after it clears its own state.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [swipeOffsets, setSwipeOffsets] = useState<Record<string, number>>({})
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const dragRef = useRef<{ id: string; startX: number; base: number; moved: boolean } | null>(null)

  const [hiddenItemId, setHiddenItemId] = useState<string | null>(null)
  const [undoText, setUndoText] = useState<string | null>(null)
  const pendingDeleteIdRef = useRef<string | null>(null)
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function commitPendingDelete() {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current)
    deleteTimerRef.current = null
    const id = pendingDeleteIdRef.current
    pendingDeleteIdRef.current = null
    if (id) void deleteItem(id)
  }

  // If the user navigates away mid-undo-window, there's no more undo UI to
  // show — commit the pending delete now rather than leaving it hidden but
  // never actually cleaned up.
  useEffect(() => commitPendingDelete, [])

  function handleQuickType(item: Item, type: ItemType) {
    void patchItem(item.id, { itemType: type })
    setSwipeOffsets((s) => ({ ...s, [item.id]: 0 }))
    showToast(`Changed to ${itemTypeMeta(type).label}`)
  }

  function handleDeleteTap(item: Item) {
    // Only one undo slot — if a previous delete is still pending, it loses
    // its window and is committed immediately.
    if (pendingDeleteIdRef.current) commitPendingDelete()
    pendingDeleteIdRef.current = item.id
    setHiddenItemId(item.id)
    setSwipeOffsets((s) => ({ ...s, [item.id]: 0 }))
    setUndoText(`Item #${item.sequenceNumber} deleted`)
    deleteTimerRef.current = setTimeout(() => {
      commitPendingDelete()
      setHiddenItemId(null)
      setUndoText(null)
    }, UNDO_WINDOW_MS)
  }

  function handleUndo() {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current)
    deleteTimerRef.current = null
    pendingDeleteIdRef.current = null
    setHiddenItemId(null)
    setUndoText(null)
  }

  function handleRowPointerDown(id: string, e: ReactPointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('button')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { id, startX: e.clientX, base: swipeOffsets[id] ?? 0, moved: false }
    setDraggingId(id)
    // Starting a drag on this row closes every other open row.
    setSwipeOffsets((s) => (s[id] ? { [id]: s[id] } : {}))
  }

  function handleRowPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.startX
    if (Math.abs(dx) > DRAG_START_THRESHOLD_PX) d.moved = true
    if (d.moved) {
      const next = Math.max(OPEN_LEFT_PX, Math.min(OPEN_RIGHT_PX, d.base + dx))
      setSwipeOffsets({ [d.id]: next })
    }
  }

  function handleRowPointerUp(itemId: string) {
    const d = dragRef.current
    if (!d) return
    dragRef.current = null
    setDraggingId(null)
    if (!d.moved) {
      const wasClosed = d.base === 0
      setSwipeOffsets({})
      if (wasClosed) navigate(`/items/${itemId}/edit`)
      return
    }
    const v = swipeOffsets[d.id] ?? 0
    setSwipeOffsets({ [d.id]: v > SNAP_RIGHT_THRESHOLD ? OPEN_RIGHT_PX : v < SNAP_LEFT_THRESHOLD ? OPEN_LEFT_PX : 0 })
  }

  if (!visit || !project || items === undefined) {
    return (
      <ScreenLayout appBar={<AppBar backLabel="Back" backTo="/" title="Loading…" />}>
        <p className="p-4 text-wr-ink-500">Loading…</p>
      </ScreenLayout>
    )
  }

  const visibleItems = items.filter((i) => i.id !== hiddenItemId)
  const photoCount = items.reduce((sum, i) => sum + i.photoIds.length, 0)

  return (
    <>
      <ScreenLayout
        appBar={
          <AppBar
            backLabel={project.name}
            backTo={`/projects/${project.id}`}
            title={`Field Report #${visit.reportNumber}`}
            subtitle={`${formatDateMedium(visit.visitDate)} · ${items.length} item${items.length === 1 ? '' : 's'} · ${photoCount} photo${photoCount === 1 ? '' : 's'}`}
          />
        }
        footer={
          <>
            <Button
              onClick={() => navigate(`/visits/${visit.id}/items/new`)}
              className="min-h-[52px] flex-1"
            >
              + Add item
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate(`/visits/${visit.id}/preview`)}
              className="min-h-[52px] flex-1"
            >
              Preview report
            </Button>
          </>
        }
      >
        {visit.purpose && <p className="px-4 pt-3 text-sm leading-snug text-wr-ink-700">To {visit.purpose}</p>}
        {visibleItems.length > 0 && (
          <p className="px-4 pt-2.5 text-[13px] text-wr-ink-500">
            Tap to edit · swipe right to change type · swipe left to delete
          </p>
        )}

        <div className="flex flex-col gap-2 p-4">
          {visibleItems.length === 0 && (
            <p className="rounded border border-dashed border-wr-taupe-500 bg-white p-6 text-center text-sm text-wr-ink-500">
              No items yet. Add the first one from the site.
            </p>
          )}
          {visibleItems.map((item) => (
            <SwipeRow
              key={item.id}
              item={item}
              offset={swipeOffsets[item.id] ?? 0}
              dragging={draggingId === item.id}
              onPointerDown={(e) => handleRowPointerDown(item.id, e)}
              onPointerMove={handleRowPointerMove}
              onPointerUp={() => handleRowPointerUp(item.id)}
              onQuickType={(type) => handleQuickType(item, type)}
              onDelete={() => handleDeleteTap(item)}
            />
          ))}
        </div>
      </ScreenLayout>

      {undoText && (
        <div className="fixed bottom-24 left-4 right-4 z-20 flex items-center rounded bg-wr-ink-900 px-3.5 py-2.5 text-sm text-white">
          {undoText}
          <button type="button" onClick={handleUndo} className="ml-auto min-h-9 font-body text-sm font-semibold text-wr-taupe-200">
            Undo
          </button>
        </div>
      )}
      <Toast text={toastText} />
    </>
  )
}
