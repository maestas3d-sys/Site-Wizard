import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../db/db'

export function ProjectListPage() {
  const projects = useLiveQuery(() => db.projects.orderBy('createdAt').reverse().toArray(), [])

  return (
    <div className="mx-auto max-w-2xl p-4 pb-24">
      <header className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
        <Link
          to="/projects/new"
          className="min-h-12 rounded-lg bg-blue-600 px-4 py-3 text-base font-semibold text-white shadow-sm active:bg-blue-700"
        >
          + New Project
        </Link>
      </header>

      {projects === undefined && <p className="text-slate-500">Loading…</p>}

      {projects?.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
          No projects yet. Create one to get started.
        </p>
      )}

      <ul className="space-y-2">
        {projects?.map((p) => (
          <li key={p.id}>
            <Link
              to={`/projects/${p.id}`}
              className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm active:bg-slate-50"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-semibold text-slate-900">{p.name || 'Untitled project'}</span>
                <span className="shrink-0 text-sm text-slate-500">{p.jobNumber}</span>
              </div>
              <div className="text-sm text-slate-500">{p.location || 'No location set'}</div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
