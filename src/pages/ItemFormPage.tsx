import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ItemTypeChips } from '../components/item/ItemTypeChips'
import { MeasurementsEditor } from '../components/item/MeasurementsEditor'
import { PhotoCapture } from '../components/item/PhotoCapture'
import { VoiceMemoRecorder } from '../components/item/VoiceMemoRecorder'
import { Button } from '../components/ui/Button'
import { TextAreaField, TextField } from '../components/ui/Field'
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
import { addElementPreset } from '../db/projects'
import { formatDetailRefsForInput, parseDetailRefsInput } from '../lib/detailRefs'
import type { Item } from '../types/item'

const AUTOSAVE_DEBOUNCE_MS = 400

function toItemDraft(item: Item): ItemDraft {
  const { id: _id, visitId: _visitId, sequenceNumber: _sequenceNumber, createdAt: _createdAt, updatedAt: _updatedAt, ...draft } = item
  return draft
}

/** Whether there's anything in the form worth autosaving a recovery draft for. */
function hasContent(
  draft: ItemDraft,
  detailRefsText: string,
  photos: PendingPhoto[],
  audioNote: PendingAudioNote | null,
): boolean {
  return (
    draft.bodyText.trim().length > 0 ||
    draft.gridRef.trim().length > 0 ||
    draft.elementRef.trim().length > 0 ||
    draft.levelRef.trim().length > 0 ||
    detailRefsText.trim().length > 0 ||
    draft.measurements.length > 0 ||
    photos.length > 0 ||
    audioNote !== null
  )
}

interface ItemFormProps {
  visitId: string
  itemId: string | undefined
  projectId: string
  initial: ItemDraft
  initialPhotos: PendingPhoto[]
  initialAudioNote: PendingAudioNote | null
  initialDraftSnapshot: ItemDraftRecord | null
  elementPresets: string[]
}

/**
 * The screen that matters (§4.3) — typed fields, photos, and the optional
 * voice memo, with "Save & Add Another" looping straight back to a blank
 * item. Autosaves a recovery snapshot to Dexie on every field change (§8):
 * a deliberate navigation away clears it, but a crash or force-quit never
 * runs that cleanup, so the draft is still there to recover next time this
 * form opens.
 */
function ItemForm({
  visitId,
  itemId,
  projectId,
  initial,
  initialPhotos,
  initialAudioNote,
  initialDraftSnapshot,
  elementPresets,
}: ItemFormProps) {
  const navigate = useNavigate()
  const isNew = !itemId
  const currentDraftKey = itemId ? editItemDraftKey(itemId) : newItemDraftKey(visitId)

  const [draft, setDraft] = useState<ItemDraft>(initialDraftSnapshot?.draft ?? initial)
  const [detailRefsText, setDetailRefsText] = useState(
    () => initialDraftSnapshot?.detailRefsText ?? formatDetailRefsForInput(initial.detailRefs),
  )
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
    if (!hasContent(draft, detailRefsText, photos, audioNote)) {
      void clearItemDraftSnapshot(currentDraftKey)
      return
    }
    const timer = setTimeout(() => {
      void saveItemDraftSnapshot({ key: currentDraftKey, visitId, itemId, draft, detailRefsText, photos, audioNote })
    }, AUTOSAVE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [currentDraftKey, visitId, itemId, draft, detailRefsText, photos, audioNote])

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
    setDetailRefsText(formatDetailRefsForInput(initial.detailRefs))
    setPhotos(initialPhotos)
    setAudioNote(initialAudioNote)
    setDraftRecovered(false)
  }

  async function persist(): Promise<Item> {
    const finalDraft: ItemDraft = { ...draft, detailRefs: parseDetailRefsInput(detailRefsText) }
    await addElementPreset(projectId, draft.elementRef)
    const saved = await saveItem(
      visitId,
      itemId,
      finalDraft,
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
      setDetailRefsText('')
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

      <TextField
        label="Grid reference"
        hint='e.g. "4-A" or "grids 4-1 and 4-A"'
        value={draft.gridRef}
        onChange={(e) => patch({ gridRef: e.target.value })}
        placeholder="4-A"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Element"
          list="element-presets"
          value={draft.elementRef}
          onChange={(e) => patch({ elementRef: e.target.value })}
          placeholder="SE corner of mechanical well"
        />
        <TextField
          label="Level"
          value={draft.levelRef}
          onChange={(e) => patch({ levelRef: e.target.value })}
          placeholder="high roof"
        />
      </div>
      <datalist id="element-presets">
        {elementPresets.map((preset) => (
          <option key={preset} value={preset} />
        ))}
      </datalist>

      <VoiceMemoRecorder value={audioNote} onChange={setAudioNote} />

      <div>
        <span className="mb-1 block text-sm font-semibold text-slate-700">Item type</span>
        <ItemTypeChips value={draft.itemType} onChange={(itemType) => patch({ itemType })} />
      </div>

      <TextAreaField
        label="Body text"
        hint="The item as it will appear in the report — this is never generated or auto-edited."
        value={draft.bodyText}
        onChange={(e) => patch({ bodyText: e.target.value })}
        placeholder="Observed hairline cracking at..."
      />

      <TextField
        label="Detail references"
        hint='Comma-separated — e.g. "5/S4.1, 3/S2.0".'
        value={detailRefsText}
        onChange={(e) => setDetailRefsText(e.target.value)}
        placeholder="5/S4.1"
      />

      <div>
        <span className="mb-1 block text-sm font-semibold text-slate-700">Photos</span>
        <PhotoCapture photos={photos} onChange={setPhotos} />
      </div>

      <div>
        <span className="mb-1 block text-sm font-semibold text-slate-700">Measurements (optional)</span>
        <MeasurementsEditor
          measurements={draft.measurements}
          onChange={(measurements) => patch({ measurements })}
        />
      </div>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap gap-3 border-t border-slate-200 bg-slate-100/95 p-4 backdrop-blur">
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
    <div className="mx-auto max-w-2xl p-4 pb-4">
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
          projectId={project.id}
          initial={emptyItemDraft()}
          initialPhotos={[]}
          initialAudioNote={null}
          initialDraftSnapshot={recoverableDraft}
          elementPresets={project.elementPresets}
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
            projectId={project.id}
            initial={toItemDraft(existingItem)}
            initialPhotos={initialPhotos}
            initialAudioNote={initialAudioNote}
            initialDraftSnapshot={recoverableDraft}
            elementPresets={project.elementPresets}
          />
        )}
    </div>
  )
}
