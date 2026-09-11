import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ItemTypeChips } from '../components/item/ItemTypeChips'
import { PhotoCapture } from '../components/item/PhotoCapture'
import { VoiceMemoRecorder } from '../components/item/VoiceMemoRecorder'
import { Button } from '../components/ui/Button'
import { TextAreaField } from '../components/ui/Field'
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
import type { Item } from '../types/item'

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
  itemId: string | undefined
  initial: ItemDraft
  initialPhotos: PendingPhoto[]
  initialAudioNote: PendingAudioNote | null
  initialDraftSnapshot: ItemDraftRecord | null
}

/**
 * The screen that matters (§4.3) — body text, item type, photos, and the
 * optional voice memo. Grid reference, element/level, detail references,
 * and measurements were dropped per feedback: multiple typed inputs per
 * item was tedious in the field, and none of them ever made it into the
 * generated report anyway — any of that goes in the body text now, if the
 * engineer needs it there at all. Autosaves a recovery snapshot to Dexie on
 * every field change (§8): a deliberate navigation away clears it, but a
 * crash or force-quit never runs that cleanup, so the draft is still there
 * to recover next time this form opens.
 */
function ItemForm({ visitId, itemId, initial, initialPhotos, initialAudioNote, initialDraftSnapshot }: ItemFormProps) {
  const navigate = useNavigate()
  const isNew = !itemId
  const currentDraftKey = itemId ? editItemDraftKey(itemId) : newItemDraftKey(visitId)

  const [draft, setDraft] = useState<ItemDraft>(initialDraftSnapshot?.draft ?? initial)
  const [photos, setPhotos] = useState<PendingPhoto[]>(initialDraftSnapshot?.photos ?? initialPhotos)
  const [audioNote, setAudioNote] = useState<PendingAudioNote | null>(
    initialDraftSnapshot?.audioNote ?? initialAudioNote,
  )
  const [draftRecovered, setDraftRecovered] = useState(initialDraftSnapshot !== null)
  // What was actually in Dexie when this form mounted — reconcilePhotos and
  // reconcileAudioNote need this to know what the user removed. Always the
  // *real* persisted state, never the recovered draft's own photos/audio.
  const originalPhotoIds = useRef(initialPhotos.map((p) => p.id))
  const originalAudioId = useRef(initialAudioNote?.id)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

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
    <div className="space-y-4">
      {draftRecovered && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <span>Recovered an unsaved draft from earlier.</span>
          <button type="button" onClick={handleDiscardDraft} className="font-semibold underline">
            Discard
          </button>
        </div>
      )}

      <TextAreaField
        label="Body text"
        hint="The item as it will appear in the report — this is never generated or auto-edited. Include grid/element/detail references here if needed."
        rows={6}
        value={draft.bodyText}
        onChange={(e) => patch({ bodyText: e.target.value })}
        placeholder="Observed hairline cracking at..."
      />

      <div>
        <span className="mb-1 block text-sm font-semibold text-slate-700">Item type</span>
        <ItemTypeChips value={draft.itemType} onChange={(itemType) => patch({ itemType })} />
      </div>

      <div>
        <span className="mb-1 block text-sm font-semibold text-slate-700">Photos</span>
        <PhotoCapture photos={photos} onChange={setPhotos} />
      </div>

      <VoiceMemoRecorder value={audioNote} onChange={setAudioNote} />

      {/* Fixed, not sticky: with the form this short, "sticky" often never
          has anything to stick to (page content can be shorter than the
          viewport), leaving these buttons in normal flow instead of pinned
          — where they can land right under the PWA-status corner toast.
          Fixed always pins to the real viewport bottom regardless of
          content height; the page wrapper's pb-24 keeps the last field
          clear of it. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-slate-100/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl flex-wrap gap-3 p-4">
          {isNew ? (
            <>
              <Button onClick={handleSaveAndNext} disabled={saving || !canSave} className="flex-1">
                {saving ? 'Saving…' : 'Save & Add Another'}
              </Button>
              <Button
                variant="secondary"
                onClick={handleSaveAndClose}
                disabled={saving || !canSave}
                className="flex-1"
              >
                Save & Close
              </Button>
            </>
          ) : (
            <>
              <Button onClick={handleSaveAndClose} disabled={saving || !canSave} className="flex-1">
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
              <Button variant="danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function ItemFormPage() {
  const { visitId: newVisitId, itemId } = useParams()
  const isNew = !itemId

  const existingItem = useLiveQuery(() => (itemId ? db.items.get(itemId) : undefined), [itemId])
  const visitId = isNew ? newVisitId : existingItem?.visitId

  const visit = useLiveQuery(() => (visitId ? db.visits.get(visitId) : undefined), [visitId])
  const project = useLiveQuery(() => (visit ? db.projects.get(visit.projectId) : undefined), [visit])
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
    ? visit !== undefined && project !== undefined && recoverableDraft !== undefined
    : existingItem !== undefined &&
      visit !== undefined &&
      project !== undefined &&
      initialPhotos !== undefined &&
      initialAudioNote !== undefined &&
      recoverableDraft !== undefined

  return (
    <div className="mx-auto max-w-2xl p-4 pb-24">
      <header className="mb-6 flex items-center gap-3">
        <Link
          to={visit ? `/visits/${visit.id}` : '/'}
          className="text-2xl text-slate-400 hover:text-slate-600"
          aria-label="Back to visit"
        >
          ←
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {isNew ? 'New Item' : `Item #${existingItem?.sequenceNumber ?? ''}`}
          </h1>
          {project && visit && (
            <p className="text-sm text-slate-500">
              {project.name} — Field Report #{visit.reportNumber}
            </p>
          )}
        </div>
      </header>

      {!ready && <p className="text-slate-500">Loading…</p>}

      {ready && isNew && visit && project && recoverableDraft !== undefined && (
        <ItemForm
          visitId={visit.id}
          itemId={undefined}
          initial={emptyItemDraft()}
          initialPhotos={[]}
          initialAudioNote={null}
          initialDraftSnapshot={recoverableDraft}
        />
      )}

      {ready &&
        !isNew &&
        existingItem &&
        visit &&
        project &&
        initialPhotos &&
        initialAudioNote !== undefined &&
        recoverableDraft !== undefined && (
          // Keyed so navigating between two items' edit forms remounts fresh.
          <ItemForm
            key={existingItem.id}
            visitId={visit.id}
            itemId={existingItem.id}
            initial={toItemDraft(existingItem)}
            initialPhotos={initialPhotos}
            initialAudioNote={initialAudioNote}
            initialDraftSnapshot={recoverableDraft}
          />
        )}
    </div>
  )
}
