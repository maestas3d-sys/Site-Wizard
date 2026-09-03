import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ItemTypeChips } from '../components/item/ItemTypeChips'
import { MeasurementsEditor } from '../components/item/MeasurementsEditor'
import { Button } from '../components/ui/Button'
import { TextAreaField, TextField } from '../components/ui/Field'
import { db } from '../db/db'
import { addElementPreset } from '../db/projects'
import {
  type ItemDraft,
  createItem,
  deleteItem,
  emptyItemDraft,
  updateItem,
} from '../db/items'
import { formatDetailRefsForInput, parseDetailRefsInput } from '../lib/detailRefs'
import type { Item } from '../types/item'

function toItemDraft(item: Item): ItemDraft {
  const { id: _id, visitId: _visitId, sequenceNumber: _sequenceNumber, createdAt: _createdAt, updatedAt: _updatedAt, ...draft } = item
  return draft
}

interface ItemFormProps {
  visitId: string
  itemId: string | undefined
  projectId: string
  initial: ItemDraft
  elementPresets: string[]
}

/**
 * The screen that matters (§4.3). Photos and voice memo aren't wired up yet
 * — those are build-order steps 3 and 6 — everything else from the typed
 * capture flow is here, including "Save & Add Another" looping straight
 * back to a blank item.
 */
function ItemForm({ visitId, itemId, projectId, initial, elementPresets }: ItemFormProps) {
  const navigate = useNavigate()
  const isNew = !itemId
  const [draft, setDraft] = useState<ItemDraft>(initial)
  const [detailRefsText, setDetailRefsText] = useState(() => formatDetailRefsForInput(initial.detailRefs))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function patch(fields: Partial<ItemDraft>) {
    setDraft((d) => ({ ...d, ...fields }))
  }

  async function persist(): Promise<void> {
    const finalDraft: ItemDraft = { ...draft, detailRefs: parseDetailRefsInput(detailRefsText) }
    await addElementPreset(projectId, draft.elementRef)
    if (isNew) {
      await createItem(visitId, finalDraft)
    } else {
      await updateItem(itemId, finalDraft)
    }
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
        hint='Comma-separated — e.g. "5/S4.1, 3/S2.0". Not yet validated against a sheet index.'
        value={detailRefsText}
        onChange={(e) => setDetailRefsText(e.target.value)}
        placeholder="5/S4.1"
      />

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

  const ready = isNew
    ? visit !== undefined && project !== undefined
    : existingItem !== undefined && visit !== undefined && project !== undefined

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

      {ready && isNew && visit && project && (
        <ItemForm
          visitId={visit.id}
          itemId={undefined}
          projectId={project.id}
          initial={emptyItemDraft()}
          elementPresets={project.elementPresets}
        />
      )}

      {ready && !isNew && existingItem && visit && project && (
        // Keyed so navigating between two items' edit forms remounts fresh.
        <ItemForm
          key={existingItem.id}
          visitId={visit.id}
          itemId={existingItem.id}
          projectId={project.id}
          initial={toItemDraft(existingItem)}
          elementPresets={project.elementPresets}
        />
      )}
    </div>
  )
}
