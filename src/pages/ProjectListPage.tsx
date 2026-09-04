import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../db/db'

export function ProjectListPage() {
  const projects = useLiveQuery(() => db.projects.orderBy('createdAt').reverse().toArray(), [])

  return (
    <div className="pb-24">
      <header className="bg-gradient-to-br from-[#10727f] via-[#0a5b6b] to-[#073e48] px-4 pb-5 pt-5 text-white shadow-md">
        <div className="mx-auto max-w-2xl">
          <div className="inline-flex rounded-xl bg-white px-3.5 py-2.5 shadow-sm">
            <img
              src={`${import.meta.env.BASE_URL}logo/wr-full-logo.png`}
              alt="Wiseman+Rohy Structural Engineers"
              className="h-7 w-auto"
            />
          </div>
          <p className="mt-2.5 text-xs font-semibold tracking-[0.18em] text-teal-100">FIELD REPORTS</p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <h1 className="text-2xl font-bold leading-tight">Projects</h1>
            <Link
              to="/projects/new"
              className="min-h-12 rounded-lg bg-white px-4 py-3 text-base font-semibold text-[#0a5b6b] shadow-sm active:bg-teal-50"
            >
              + New Project
            </Link>
          </div>
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
