import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { ItemTypeChips } from '../components/item/ItemTypeChips'
import { PhotoCapture } from '../components/item/PhotoCapture'
import { PhotoMarkup } from '../components/item/PhotoMarkup'
import { VoiceMemoMicControl, VoiceMemoPlaybackRow } from '../components/item/VoiceMemoRecorder'
import { AppBar } from '../components/ui/AppBar'
import { Button } from '../components/ui/Button'
import { ScreenLayout } from '../components/ui/ScreenLayout'
import { Toast } from '../components/ui/Toast'
import { type PendingAudioNote, loadPendingAudioNote } from '../db/audioNotes'
import { db } from '../db/db'
import {
  clearItemDraftSnapshot,
  editItemDraftKey,
  type ItemDraftRecord,
  loadItemDraftSnapshot,
  newItemDraftKey,
  saveItemDraftSnapshot,
} from '../db/itemDrafts'
import { type ItemDraft, deleteItem, emptyItemDraft, saveItem } from '../db/items'
import { type PendingPhoto, loadPendingPhotos } from '../db/photos'
import { useToast } from '../lib/useToast'
import { useVoiceMemo } from '../lib/useVoiceMemo'
import type { Item } from '../types/item'
import type { PhotoAnnotation } from '../types/photo'

const AUTOSAVE_DEBOUNCE_MS = 400

function toItemDraft(item: Item): ItemDraft {
  const { id: _id, visitId: _visitId, sequenceNumber: _sequenceNumber, createdAt: _createdAt, updatedAt: _updatedAt, ...draft } = item
  return draft
}

/** Whether there's anything in the form worth autosaving a recovery draft for. */
function hasContent(draft: ItemDraft, photos: PendingPhoto[], audioNote: PendingAudioNote | null): boolean {
  return draft.bodyText.trim().length > 0 || photos.length > 0 || audioNote !== null
}

interface ItemFormProps {
  visitId: string
  visitNumber: number
  itemId: string | undefined
  seq: number
  initial: ItemDraft
  initialPhotos: PendingPhoto[]
  initialAudioNote: PendingAudioNote | null
  initialDraftSnapshot: ItemDraftRecord | null
}

/**
 * The screen that matters (§4.3) — photos first, then the observation
 * (with hold-to-dictate built into the field itself), then item type.
 * Grid reference, element/level, detail references, and measurements were
 * dropped per feedback: multiple typed inputs per item was tedious in the
 * field, and none of them ever made it into the generated report anyway —
 * any of that goes in the body text now, if the engineer needs it there at
 * all. Autosaves a recovery snapshot to Dexie on every field change (§8,
 * now covering photo markup too since it lives on the same PendingPhoto
 * objects): a deliberate navigation away clears it, but a crash or
 * force-quit never runs that cleanup, so the draft is still there to
 * recover next time this form opens.
 */
function ItemForm({
  visitId,
  visitNumber,
  itemId,
  seq,
  initial,
  initialPhotos,
  initialAudioNote,
  initialDraftSnapshot,
}: ItemFormProps) {
  const navigate = useNavigate()
  const isNew = !itemId
  const currentDraftKey = itemId ? editItemDraftKey(itemId) : newItemDraftKey(visitId)
  const { toastText, showToast } = useToast()

  const [draft, setDraft] = useState<ItemDraft>(initialDraftSnapshot?.draft ?? initial)
  const [photos, setPhotos] = useState<PendingPhoto[]>(initialDraftSnapshot?.photos ?? initialPhotos)
  const [audioNote, setAudioNote] = useState<PendingAudioNote | null>(
    initialDraftSnapshot?.audioNote ?? initialAudioNote,
  )
  const [draftRecovered, setDraftRecovered] = useState(initialDraftSnapshot !== null)
  const [markupPhoto, setMarkupPhoto] = useState<PendingPhoto | null>(null)
  // What was actually in Dexie when this form mounted — reconcilePhotos and
  // reconcileAudioNote need this to know what the user removed. Always the
  // *real* persisted state, never the recovered draft's own photos/audio.
  const originalPhotoIds = useRef(initialPhotos.map((p) => p.id))
  const originalAudioId = useRef(initialAudioNote?.id)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const voice = useVoiceMemo(audioNote, setAudioNote)

  // Debounced autosave of a recovery snapshot. Skips (and clears any
  // earlier snapshot) once the form is back to empty — typed something,
  // deleted it all, nothing left worth recovering.
  useEffect(() => {
    if (!hasContent(draft, photos, audioNote)) {
      void clearItemDraftSnapshot(currentDraftKey)
      return
    }
    const timer = setTimeout(() => {
      void saveItemDraftSnapshot({ key: currentDraftKey, visitId, itemId, draft, photos, audioNote })
    }, AUTOSAVE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [currentDraftKey, visitId, itemId, draft, photos, audioNote])

  // Deliberate navigation away (a route change unmounts this) clears the
  // draft — only a crash or force-quit skips this cleanup, which is
  // exactly when the draft should still be there on relaunch.
  useEffect(() => {
    return () => {
      void clearItemDraftSnapshot(currentDraftKey)
    }
  }, [currentDraftKey])

  function patch(fields: Partial<ItemDraft>) {
    setDraft((d) => ({ ...d, ...fields }))
  }

  async function handleDiscardDraft() {
    await clearItemDraftSnapshot(currentDraftKey)
    setDraft(initial)
    setPhotos(initialPhotos)
    setAudioNote(initialAudioNote)
    setDraftRecovered(false)
  }

  function handleMarkupDone(annotations: PhotoAnnotation[]) {
    if (!markupPhoto) return
    setPhotos((current) => current.map((p) => (p.id === markupPhoto.id ? { ...p, annotations } : p)))
    setMarkupPhoto(null)
  }

  async function persist(): Promise<Item> {
    const saved = await saveItem(
      visitId,
      itemId,
      draft,
      photos,
      originalPhotoIds.current,
      audioNote,
      originalAudioId.current,
    )
    await clearItemDraftSnapshot(currentDraftKey)
    return saved
  }

  async function handleSaveAndClose() {
    setSaving(true)
    try {
      await persist()
      navigate(`/visits/${visitId}`, { replace: true })
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveAndNext() {
    setSaving(true)
    try {
      await persist()
      showToast(`Item #${seq} saved. Ready for the next one.`)
      setDraft(emptyItemDraft())
      setPhotos([])
      originalPhotoIds.current = []
      setAudioNote(null)
      originalAudioId.current = undefined
      setDraftRecovered(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!itemId) return
    if (!window.confirm('Delete this item? This cannot be undone.')) return
    setDeleting(true)
    try {
      await deleteItem(itemId)
      navigate(`/visits/${visitId}`, { replace: true })
    } finally {
      setDeleting(false)
    }
  }

  const canSave = draft.bodyText.trim().length > 0

  return (
    <>
      <ScreenLayout
        appBar={<AppBar backLabel={`Field Report #${visitNumber}`} backTo={`/visits/${visitId}`} title={`Item #${seq}`} />}
        footer={
          isNew ? (
            <>
              <Button onClick={handleSaveAndNext} disabled={saving || !canSave} className="min-h-[52px] flex-1">
                {saving ? 'Saving…' : 'Save and add another'}
              </Button>
              <Button
                variant="secondary"
                onClick={handleSaveAndClose}
                disabled={saving || !canSave}
                className="min-h-[52px] flex-1"
              >
                Save and close
              </Button>
            </>
          ) : (
            <>
              <Button onClick={handleSaveAndClose} disabled={saving || !canSave} className="min-h-[52px] flex-[2]">
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
              <Button variant="danger" onClick={handleDelete} disabled={deleting} className="min-h-[52px] flex-1">
                {deleting ? 'Deleting…' : 'Delete'}
              </Button>
            </>
          )
        }
      >
        <div className="flex flex-col gap-5 p-4">
          {draftRecovered && (
            <div className="flex items-center justify-between gap-3 rounded border border-wr-warning-border bg-wr-warning-bg p-3 text-sm text-wr-brown-900">
              <span>Recovered an unsaved draft from earlier.</span>
              <button type="button" onClick={handleDiscardDraft} className="font-semibold underline">
                Discard
              </button>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <span className="font-eyebrow text-sm font-semibold tracking-[0.14em] text-wr-brown-700 uppercase">
                Photos
              </span>
              <span className="text-xs text-wr-ink-500">
                {photos.length > 0 ? 'Tap a photo to mark up' : 'Photos are optional'}
              </span>
            </div>
            <PhotoCapture photos={photos} onChange={setPhotos} onMarkup={setMarkupPhoto} />
          </div>

          <div className="flex flex-col gap-2">
            <span className="font-eyebrow text-sm font-semibold tracking-[0.14em] text-wr-brown-700 uppercase">
              Observation
            </span>
            <div className="relative">
              <textarea
                rows={5}
                value={draft.bodyText}
                onChange={(e) => patch({ bodyText: e.target.value })}
                placeholder="Observed hairline cracking at..."
                className="w-full resize-none rounded border border-wr-taupe-200 bg-white p-3 pb-16 font-body text-base leading-normal text-wr-ink-900 placeholder:text-wr-ink-500 focus:border-wr-blue-800 focus:outline-none focus:ring-2 focus:ring-wr-blue-600/30"
              />
              <div className="absolute bottom-2.5 left-2 right-2">
                <VoiceMemoMicControl voice={voice} hasMemo={!!audioNote} />
              </div>
            </div>
            {audioNote && !voice.recording && (
              <VoiceMemoPlaybackRow value={audioNote} onDelete={() => setAudioNote(null)} />
            )}
          </div>

          <div className="flex flex-col gap-2">
            <span className="font-eyebrow text-sm font-semibold tracking-[0.14em] text-wr-brown-700 uppercase">
              Item type
            </span>
            <ItemTypeChips value={draft.itemType} onChange={(itemType) => patch({ itemType })} />
          </div>
        </div>
      </ScreenLayout>

      {markupPhoto && (
        <PhotoMarkup photo={markupPhoto} onCancel={() => setMarkupPhoto(null)} onDone={handleMarkupDone} />
      )}
      <Toast text={toastText} />
    </>
  )
}

export function ItemFormPage() {
  const { visitId: newVisitId, itemId } = useParams()
  const isNew = !itemId

  const existingItem = useLiveQuery(() => (itemId ? db.items.get(itemId) : undefined), [itemId])
  const visitId = isNew ? newVisitId : existingItem?.visitId

  const visit = useLiveQuery(() => (visitId ? db.visits.get(visitId) : undefined), [visitId])
  const existingVisitItemCount = useLiveQuery(
    async () => (isNew && visitId ? db.items.where('visitId').equals(visitId).count() : undefined),
    [isNew, visitId],
  )
  const initialPhotos = useLiveQuery(
    () => (isNew ? [] : existingItem ? loadPendingPhotos(existingItem.photoIds) : undefined),
    [isNew, existingItem],
  )
  // null is a valid loaded state here (no audio note) — undefined means "not loaded yet".
  const initialAudioNote = useLiveQuery(
    () => (isNew ? null : existingItem ? loadPendingAudioNote(existingItem.audioId) : undefined),
    [isNew, existingItem],
  )
  const currentDraftKey = isNew
    ? newVisitId
      ? newItemDraftKey(newVisitId)
      : undefined
    : itemId
      ? editItemDraftKey(itemId)
      : undefined
  // Same null-vs-undefined convention: null = loaded, no recoverable draft.
  const recoverableDraft = useLiveQuery(async () => {
    if (!currentDraftKey) return null
    const snapshot = await loadItemDraftSnapshot(currentDraftKey)
    return snapshot ?? null
  }, [currentDraftKey])

  const ready = isNew
    ? visit !== undefined && existingVisitItemCount !== undefined && recoverableDraft !== undefined
    : existingItem !== undefined &&
      visit !== undefined &&
      initialPhotos !== undefined &&
      initialAudioNote !== undefined &&
      recoverableDraft !== undefined

  if (!ready) {
    return (
      <ScreenLayout appBar={<AppBar backLabel="Back" backTo="/" title="Loading…" />}>
        <p className="p-4 text-wr-ink-500">Loading…</p>
      </ScreenLayout>
    )
  }

  if (isNew && visit && existingVisitItemCount !== undefined && recoverableDraft !== undefined) {
    return (
      <ItemForm
        visitId={visit.id}
        visitNumber={visit.reportNumber}
        itemId={undefined}
        seq={existingVisitItemCount + 1}
        initial={emptyItemDraft()}
        initialPhotos={[]}
        initialAudioNote={null}
        initialDraftSnapshot={recoverableDraft}
      />
    )
  }

  if (
    !isNew &&
    existingItem &&
    visit &&
    initialPhotos &&
    initialAudioNote !== undefined &&
    recoverableDraft !== undefined
  ) {
    return (
      // Keyed so navigating between two items' edit forms remounts fresh.
      <ItemForm
        key={existingItem.id}
        visitId={visit.id}
        visitNumber={visit.reportNumber}
        itemId={existingItem.id}
        seq={existingItem.sequenceNumber}
        initial={toItemDraft(existingItem)}
        initialPhotos={initialPhotos}
        initialAudioNote={initialAudioNote}
        initialDraftSnapshot={recoverableDraft}
      />
    )
  }

  return null
}
