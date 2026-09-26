import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useParams } from 'react-router-dom'
import { LogoBar } from '../components/ui/LogoBar'
import { db } from '../db/db'
import { itemTypeMeta } from '../lib/itemTypes'
import { formatDateShort } from '../lib/reportDates'
import type { Item, ItemType } from '../types/item'
import type { Visit } from '../types/visit'

const TALLY_TYPES: ItemType[] = ['deficiency', 'requires-rfi', 'requires-ccd', 'info-requested']

function capitalizeFirst(text: string): string {
  return text.length > 0 ? text.charAt(0).toUpperCase() + text.slice(1) : text
}

function tallyItems(items: Item[]): { type: ItemType; count: number }[] {
  const counts = new Map<ItemType, number>()
  for (const item of items) counts.set(item.itemType, (counts.get(item.itemType) ?? 0) + 1)
  return TALLY_TYPES.filter((t) => counts.get(t)).map((t) => ({ type: t, count: counts.get(t)! }))
}

function VisitCard({ visit, items }: { visit: Visit; items: Item[] }) {
  const sent = visit.status === 'complete'
  const photoCount = items.reduce((sum, i) => sum + i.photoIds.length, 0)
  const tally = sent ? [] : tallyItems(items)

  return (
    <Link
      to={`/visits/${visit.id}`}
      className="flex flex-col gap-1.5 rounded border border-wr-taupe-200 bg-white p-3 px-3.5"
    >
      <div className="flex items-center gap-2">
        <span className="font-body text-base font-bold text-wr-blue-900">Field Report #{visit.reportNumber}</span>
        <span
          className="rounded-sm px-2 py-0.5 text-xs font-semibold"
          style={sent ? { background: '#E3EDF0', color: '#0A5468' } : { background: '#F5ECD9', color: '#8A5F16' }}
        >
          {sent ? 'Report sent' : 'In progress'}
        </span>
        <span className="ml-auto shrink-0 text-[13px] text-wr-ink-500">{formatDateShort(visit.visitDate)}</span>
      </div>
      <div className="text-sm text-wr-ink-700">{capitalizeFirst(visit.purpose)}</div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-wr-ink-500">
          {items.length} item{items.length === 1 ? '' : 's'} · {photoCount} photo{photoCount === 1 ? '' : 's'}
        </span>
        {tally.map(({ type, count }) => {
          const meta = itemTypeMeta(type)
          return (
            <span
              key={type}
              className="rounded-sm px-1.5 py-0.5 text-xs font-semibold"
              style={{ background: meta.bg, color: meta.text }}
            >
              {count} {meta.label}
            </span>
          )
        })}
      </div>
    </Link>
  )
}

export function ProjectPage() {
  const { id } = useParams()
  const project = useLiveQuery(() => (id ? db.projects.get(id) : undefined), [id])
  const visits = useLiveQuery(
    async () => (id ? db.visits.where('projectId').equals(id).reverse().sortBy('reportNumber') : undefined),
    [id],
  )
  const items = useLiveQuery(async () => {
    if (!visits) return undefined
    if (visits.length === 0) return []
    const visitIds = visits.map((v) => v.id)
    return db.items.where('visitId').anyOf(visitIds).toArray()
  }, [visits])

  if (!project || visits === undefined || items === undefined) {
    return (
      <div className="p-4">
        <p className="text-wr-ink-500">Loading…</p>
      </div>
    )
  }

  const itemsByVisit = new Map<string, Item[]>()
  items.forEach((item) => {
    const list = itemsByVisit.get(item.visitId)
    if (list) list.push(item)
    else itemsByVisit.set(item.visitId, [item])
  })
  const nextReportNumber = visits.reduce((max, v) => Math.max(max, v.reportNumber), 0) + 1
  const todayLabel = `Today, ${formatDateShort(new Date().toISOString().slice(0, 10))}`

  return (
    <div className="pb-4">
      <LogoBar />
      <div className="bg-wr-blue-800 px-4 pb-5 pt-1.5 text-white">
        <Link to="/" className="inline-flex min-h-10 items-center font-body text-[13px] text-wr-taupe-200">
          ← All projects
        </Link>
        <div className="mt-1 font-eyebrow text-sm font-semibold tracking-[0.14em] text-wr-taupe-200 uppercase">
          Job {project.jobNumber}
        </div>
        <div className="mt-0.5 font-heading text-2xl font-semibold leading-[1.2]">{project.name}</div>
        <div className="mt-1 text-sm text-wr-blue-100">{project.location}</div>
        <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-white/[.18] pt-3">
          <div className="text-[13px] leading-snug text-wr-blue-100">
            {project.clientFirm}
            <br />
            Attn: {project.clientAttn}
          </div>
          <Link
            to={`/projects/${project.id}/details`}
            className="flex min-h-10 items-center rounded border border-white/50 px-3.5 font-body text-sm font-semibold text-white"
          >
            Edit details
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-4">
        <Link
          to={`/projects/${project.id}/visits/new`}
          className="flex flex-col gap-1 rounded bg-wr-brown-700 p-4 text-white shadow-[0_1px_2px_rgba(0,0,0,.08)]"
        >
          <span className="font-body text-lg font-bold">+ Start new visit</span>
          <span className="text-sm text-wr-brown-100">
            Field Report #{nextReportNumber} · {todayLabel}
          </span>
        </Link>

        <div className="flex items-baseline justify-between">
          <span className="font-heading text-xl font-semibold text-wr-blue-900">Visits</span>
          <span className="text-[13px] text-wr-ink-500">
            {visits.length === 1 ? '1 report' : `${visits.length} reports`}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {visits.length === 0 && (
            <p className="rounded border border-dashed border-wr-taupe-500 bg-white p-5 text-center text-sm text-wr-ink-500">
              No visits yet. Start the first one when you are on site.
            </p>
          )}
          {visits.map((visit) => (
            <VisitCard key={visit.id} visit={visit} items={itemsByVisit.get(visit.id) ?? []} />
          ))}
        </div>
      </div>
    </div>
  )
}
