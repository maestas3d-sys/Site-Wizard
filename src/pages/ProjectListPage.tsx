import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { LogoBar } from '../components/ui/LogoBar'
import { db } from '../db/db'
import { formatDateShort } from '../lib/reportDates'
import type { Visit } from '../types/visit'

function visitsMeta(visits: Visit[]): string {
  if (visits.length === 0) return 'No visits yet'
  const latest = visits.reduce((a, b) => (b.reportNumber > a.reportNumber ? b : a))
  const count = visits.length === 1 ? '1 field report' : `${visits.length} field reports`
  return `${count} · last visit ${formatDateShort(latest.visitDate)}`
}

export function ProjectListPage() {
  const projects = useLiveQuery(() => db.projects.orderBy('createdAt').reverse().toArray(), [])
  const allVisits = useLiveQuery(() => db.visits.toArray(), [])

  const visitsByProject = new Map<string, Visit[]>()
  allVisits?.forEach((v) => {
    const list = visitsByProject.get(v.projectId)
    if (list) list.push(v)
    else visitsByProject.set(v.projectId, [v])
  })

  return (
    <div className="pb-4">
      <LogoBar />
      <div className="flex items-center justify-between gap-3 bg-wr-blue-800 px-4 pb-5 pt-[18px]">
        <span className="font-heading text-2xl font-semibold text-white">Projects</span>
        <Link
          to="/projects/new"
          className="flex min-h-12 items-center rounded bg-wr-brown-700 px-4 font-body text-[15px] font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,.08)]"
        >
          + New project
        </Link>
      </div>

      <div className="flex flex-col gap-2 p-4">
        {projects === undefined && <p className="text-wr-ink-500">Loading…</p>}

        {projects?.length === 0 && (
          <p className="rounded border border-dashed border-wr-taupe-500 bg-white p-6 text-center text-wr-ink-500">
            No projects yet. Create one to get started.
          </p>
        )}

        {projects?.map((p) => (
          <Link
            key={p.id}
            to={`/projects/${p.id}`}
            className="flex flex-col gap-1 rounded border border-wr-taupe-200 bg-white p-3.5"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-body text-base font-bold text-wr-blue-900">{p.name || 'Untitled project'}</span>
              <span className="shrink-0 text-[13px] text-wr-ink-500">{p.jobNumber}</span>
            </div>
            <div className="text-sm text-wr-ink-700">{p.location || 'No location set'}</div>
            <div className="text-xs text-wr-ink-500">{visitsMeta(visitsByProject.get(p.id) ?? [])}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
