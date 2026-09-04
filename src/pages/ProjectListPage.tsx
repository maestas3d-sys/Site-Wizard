import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../db/db'

function projectCountLabel(count: number | undefined): string {
  if (count === undefined) return 'Loading…'
  if (count === 0) return 'No projects yet'
  return count === 1 ? '1 project' : `${count} projects`
}

export function ProjectListPage() {
  const projects = useLiveQuery(() => db.projects.orderBy('createdAt').reverse().toArray(), [])

  return (
    <div className="pb-24">
      <header className="bg-gradient-to-br from-[#0e6d7f] to-[#073e48] px-4 pb-5 pt-5 text-white shadow-md">
        <div className="mx-auto flex max-w-2xl items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm">
            <img
              src={`${import.meta.env.BASE_URL}icons/icon-192.png`}
              alt="Wiseman+Rohy"
              className="h-12 w-12 object-contain"
            />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold leading-tight">Site Wizard</h1>
            <p className="text-sm text-teal-100">{projectCountLabel(projects?.length)}</p>
          </div>
        </div>
        <div className="mx-auto mt-4 flex max-w-2xl justify-end">
          <Link
            to="/projects/new"
            className="min-h-12 rounded-lg border border-white/40 bg-white/15 px-4 py-3 text-base font-semibold text-white shadow-sm active:bg-white/25"
          >
            + New Project
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-2xl p-4">
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
    </div>
  )
}
