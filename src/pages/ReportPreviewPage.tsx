import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useParams } from 'react-router-dom'
import { PhotoAnnotationsOverlay } from '../components/item/PhotoAnnotationsOverlay'
import { AppBar } from '../components/ui/AppBar'
import { Button } from '../components/ui/Button'
import { ScreenLayout } from '../components/ui/ScreenLayout'
import { Toast } from '../components/ui/Toast'
import { db } from '../db/db'
import { listItemsByVisit } from '../db/items'
import { patchVisit } from '../db/visits'
import { CLOSING_STATEMENTS, buildOpeningStatement, buildReportItemLines } from '../lib/reportContent'
import { formatReportDate } from '../lib/reportDates'
import {
  type ClosingVariant,
  buildPhotoNumbersByItem,
  generateReport,
  orderPhotosForReport,
} from '../lib/reportGeneration'
import { downloadBlob } from '../lib/downloadBlob'
import { useImageDimensions } from '../lib/useImageDimensions'
import { useToast } from '../lib/useToast'
import type { Attendee, Visit } from '../types/visit'
import type { Photo } from '../types/photo'
import { PhotoThumb } from '../components/item/PhotoThumb'

const CLOSING_OPTIONS: { value: ClosingVariant; label: string }[] = [
  { value: 'work-in-progress', label: 'Work in progress' },
  { value: 'conforms', label: 'Conforms' },
]

function formatAttendeeLine(a: Attendee): string {
  const name = a.name.trim()
  const firm = a.firm.trim()
  if (name && firm) return `${name}, ${firm}`
  return name || firm
}

type OptionalField = 'generalState' | 'nextObservation'

const FIELD_COPY: Record<OptionalField, { label: string; blank: string; filled: string; placeholder: string }> = {
  generalState: {
    label: 'General state',
    blank: 'General state is blank, so that paragraph will be left out.',
    filled: 'General state set.',
    placeholder: 'Construction progress at the time of the visit…',
  },
  nextObservation: {
    label: 'Next observation',
    blank: 'Next observation is blank.',
    filled: 'Next observation set.',
    placeholder: 'Prior to next phase of work. Tentatively 00/00/00.',
  },
}

function FieldNotice({
  field,
  visit,
  editing,
  onToggle,
  onChange,
  draftValue,
}: {
  field: OptionalField
  visit: Visit
  editing: boolean
  onToggle: () => void
  onChange: (value: string) => void
  draftValue: string
}) {
  const copy = FIELD_COPY[field]
  const value = visit[field] || ''
  const empty = !value.trim()

  return (
    <div
      className="flex flex-col gap-2 rounded p-2.5 px-3"
      style={empty ? { background: '#F5ECD9', border: '1px solid #E6D3A8' } : { background: '#fff', border: '1px solid #DCD8CA' }}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex-1 text-[13px] leading-snug text-wr-brown-900">
          <b>{copy.label}</b> {empty ? copy.blank : copy.filled}
        </span>
        <button
          type="button"
          onClick={onToggle}
          className="min-h-9 rounded border border-wr-brown-700 px-3 font-body text-[13px] font-semibold text-wr-brown-700"
        >
          {editing ? 'Done' : empty ? 'Add' : 'Edit'}
        </button>
      </div>
      {editing && (
        <textarea
          rows={3}
          value={draftValue}
          onChange={(e) => onChange(e.target.value)}
          placeholder={copy.placeholder}
          className="w-full resize-none rounded border border-wr-taupe-200 bg-white p-2.5 font-body text-base text-wr-ink-900 focus:border-wr-blue-800 focus:outline-none focus:ring-2 focus:ring-wr-blue-600/30"
        />
      )}
    </div>
  )
}

function DocPhoto({ photo, n }: { photo: Photo; n: number }) {
  const dimensions = useImageDimensions(photo.blob)
  return (
    <div className="flex flex-col gap-0.5">
      <div className="relative aspect-[4/3] overflow-hidden bg-wr-taupe-500">
        <PhotoThumb blob={photo.thumbBlob} />
        {dimensions && photo.annotations && photo.annotations.length > 0 && (
          <PhotoAnnotationsOverlay
            naturalWidth={dimensions.width}
            naturalHeight={dimensions.height}
            annotations={photo.annotations}
          />
        )}
      </div>
      <span className="text-[10px] text-wr-ink-900">Photo #{n}</span>
    </div>
  )
}

export function ReportPreviewPage() {
  const { visitId } = useParams()
  const visit = useLiveQuery(() => (visitId ? db.visits.get(visitId) : undefined), [visitId])
  const project = useLiveQuery(() => (visit ? db.projects.get(visit.projectId) : undefined), [visit])
  const items = useLiveQuery(() => (visitId ? listItemsByVisit(visitId) : undefined), [visitId])
  const allPhotos = useLiveQuery(
    async () => (visitId ? db.photos.where('visitId').equals(visitId).sortBy('orderIndex') : undefined),
    [visitId],
  )

  const [editingField, setEditingField] = useState<OptionalField | null>(null)
  const [draftValue, setDraftValue] = useState('')
  const [generating, setGenerating] = useState(false)
  const { toastText, showToast } = useToast()

  if (!visit || !project || items === undefined || allPhotos === undefined) {
    return (
      <ScreenLayout appBar={<AppBar backLabel="Back" backTo="/" title="Loading…" />}>
        <p className="p-4 text-wr-ink-500">Loading…</p>
      </ScreenLayout>
    )
  }

  const closing = visit.closing || 'work-in-progress'
  const photos = orderPhotosForReport(items, allPhotos)
  const photoNumbersByItem = buildPhotoNumbersByItem(photos)
  const lines = buildReportItemLines(items, photoNumbersByItem)

  function toggleField(field: OptionalField) {
    if (!visit) return
    if (editingField === field) {
      setEditingField(null)
    } else {
      setDraftValue(visit[field] || '')
      setEditingField(field)
    }
  }

  function handleFieldChange(field: OptionalField, value: string) {
    setDraftValue(value)
    void patchVisit(visit!.id, { [field]: value })
  }

  async function handleDownload() {
    setGenerating(true)
    try {
      const { blob, filename } = await generateReport({ visitId: visit!.id, closingVariant: closing })
      downloadBlob(blob, filename)
      await patchVisit(visit!.id, { status: 'complete' })
      showToast(`Downloaded "${filename}"`)
    } catch (err) {
      console.error('Report generation failed:', err)
      showToast(err instanceof Error ? err.message : 'Report generation failed.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <>
      <ScreenLayout
        appBar={<AppBar backLabel={`Field Report #${visit.reportNumber}`} backTo={`/visits/${visit.id}`} title="Report preview" />}
        footer={
          <Button onClick={handleDownload} disabled={generating} className="min-h-[52px] w-full">
            {generating ? 'Generating…' : 'Download .docx'}
          </Button>
        }
      >
        <div className="flex flex-col gap-2.5 bg-wr-taupe-100 p-3.5 pb-0">
          <div className="flex gap-[3px] rounded border border-wr-taupe-200 bg-white p-[3px]">
            {CLOSING_OPTIONS.map((opt) => {
              const selected = closing === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => void patchVisit(visit.id, { closing: opt.value })}
                  className="min-h-11 flex-1 rounded-sm font-body text-sm font-semibold"
                  style={selected ? { background: '#003D4C', color: '#fff' } : { background: 'transparent', color: '#3D4649' }}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>

          {(['generalState', 'nextObservation'] as const).map((field) => (
            <FieldNotice
              key={field}
              field={field}
              visit={visit}
              editing={editingField === field}
              onToggle={() => toggleField(field)}
              onChange={(v) => handleFieldChange(field, v)}
              draftValue={draftValue}
            />
          ))}
        </div>

        <div className="bg-wr-taupe-100 p-3.5">
          <div
            className="flex flex-col gap-2.5 bg-white p-5 px-4 font-body text-[11.5px] leading-normal text-wr-ink-900"
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,.12)' }}
          >
            <img src={`${import.meta.env.BASE_URL}logo/wr-full-logo.png`} alt="Wiseman+Rohy" className="h-5 w-auto self-start" />
            <div className="text-[13px] font-bold">FIELD REPORT #{visit.reportNumber}</div>
            <div>{formatReportDate(visit.reportDate)}</div>
            <div>
              <b>TO:</b> {[project.clientFirm, project.clientCity].filter(Boolean).join(', ')}
              <br />
              <b>ATTN:</b> {project.clientAttn}
            </div>
            <div>
              <b>PROJECT:</b> {project.name}, {project.location} · Job {project.jobNumber}
            </div>
            <div className="grid grid-cols-[64px_1fr]">
              <b>PRESENT:</b>
              <span className="flex flex-col">
                {visit.attendees.map((a, i) => (
                  <span key={i}>{formatAttendeeLine(a)}</span>
                ))}
              </span>
            </div>
            {visit.generalState.trim() && (
              <>
                <div>At the time of the observation, construction progress was as follows:</div>
                <div className="-mt-1.5">{visit.generalState}</div>
              </>
            )}
            <div>{buildOpeningStatement(visit)}</div>
            {lines.length > 0 ? (
              lines.map((line) => (
                <div key={line.n} className="grid grid-cols-[22px_1fr]">
                  <span>{line.n}.)</span>
                  <span>
                    <b>{line.label}</b>
                    {line.body}
                    {line.photoRef}
                  </span>
                </div>
              ))
            ) : (
              <div>No items were noted during this visit.</div>
            )}
            <div>{CLOSING_STATEMENTS[closing]}</div>
            <div>
              <b>NEXT OBSERVATION:</b> {visit.nextObservation || '—'}
            </div>
            <div className="mt-1.5">
              {visit.engineerName}, {visit.engineerCredential}
              <br />
              {visit.engineerTitle}
            </div>
            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-1.5 border-t border-wr-ink-100 pt-2.5">
                {photos.map((photo, i) => (
                  <DocPhoto key={photo.id} photo={photo} n={i + 1} />
                ))}
              </div>
            )}
          </div>
        </div>
      </ScreenLayout>
      <Toast text={toastText} />
    </>
  )
}
