import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useParams } from 'react-router-dom'
import { db } from '../db/db'
import { deleteItem, listItemsByVisit, moveItem } from '../db/items'
import { itemTypeMeta } from '../lib/itemTypes'

function formatVisitDate(isoDate: string): string {
  // Append a time so the browser parses it in local time, not UTC — an
  // ISO date-only string ("2026-09-03") would otherwise read back as the
  // previous day in any zone west of UTC.
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, { dateStyle: 'medium' })
}

export function VisitDetailPage() {
  const { visitId } = useParams()
  const visit = useLiveQuery(() => (visitId ? db.visits.get(visitId) : undefined), [visitId])
  const project = useLiveQuery(() => (visit ? db.projects.get(visit.projectId) : undefined), [visit])
  const items = useLiveQuery(() => (visitId ? listItemsByVisit(visitId) : undefined), [visitId])

  const [deletingItemId, setDeletingItemId] = useState<string | null>(null)

  async function handleDeleteItem(id: string) {
    if (!window.confirm('Delete this item? This cannot be undone.')) return
    setDeletingItemId(id)
    try {
      await deleteItem(id)
    } finally {
      setDeletingItemId(null)
    }
  }

  async function handleMove(id: string, direction: 'up' | 'down') {
    if (!visitId) return
    await moveItem(visitId, id, direction)
  }

  if (!visit || !project) {
    return (
      <div className="mx-auto max-w-2xl p-4">
        <p className="text-slate-500">Loading…</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl p-4 pb-24">
      <header className="mb-4 flex items-start gap-3">
        <Link
          to={`/projects/${project.id}`}
          className="text-2xl text-slate-400 hover:text-slate-600"
          aria-label="Back to project"
        >
          ←
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">Field Report #{visit.reportNumber}</h1>
          <p className="text-sm text-slate-500">
            {project.name} — {formatVisitDate(visit.visitDate)}
          </p>
        </div>
        <Link
          to={`/visits/${visit.id}/edit`}
          className="flex min-h-12 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700"
        >
          Edit
        </Link>
      </header>

      {visit.purpose && <p className="mb-6 whitespace-pre-wrap text-sm text-slate-600">{visit.purpose}</p>}

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">Items</h2>
        <Link
          to={`/visits/${visit.id}/items/new`}
          className="flex min-h-12 items-center rounded-lg bg-blue-600 px-4 py-3 text-base font-semibold text-white shadow-sm active:bg-blue-700"
        >
          + Add Item
        </Link>
      </div>

      {items === undefined && <p className="text-slate-500">Loading…</p>}
      {items?.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
          No items yet. Add the first one from the site.
        </p>
      )}

      <ul className="space-y-2">
        {items?.map((item, index) => {
          const meta = itemTypeMeta(item.itemType)
          return (
            <li key={item.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex flex-col gap-1 pt-1">
                  <button
                    type="button"
                    onClick={() => handleMove(item.id, 'up')}
                    disabled={index === 0}
                    className="text-slate-400 hover:text-slate-600 disabled:opacity-30"
                    aria-label="Move up"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(item.id, 'down')}
                    disabled={index === (items?.length ?? 0) - 1}
                    className="text-slate-400 hover:text-slate-600 disabled:opacity-30"
                    aria-label="Move down"
                  >
                    ▼
                  </button>
                </div>

                <Link to={`/items/${item.id}/edit`} className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">#{item.sequenceNumber}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${meta.colorClasses}`}>
                      {meta.label}
                    </span>
                    {item.gridRef && <span className="text-xs text-slate-500">{item.gridRef}</span>}
                  </div>
                  <p className="mt-1 truncate text-sm text-slate-600">
                    {item.bodyText || <span className="text-slate-400">No body text yet</span>}
                  </p>
                </Link>

                <button
                  type="button"
                  onClick={() => handleDeleteItem(item.id)}
                  disabled={deletingItemId === item.id}
                  className="px-1 text-slate-400 hover:text-red-600"
                  aria-label="Delete item"
                >
                  ×
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
