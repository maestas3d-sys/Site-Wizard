import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { AttendeesEditor } from '../components/visit/AttendeesEditor'
import { AppBar } from '../components/ui/AppBar'
import { Button } from '../components/ui/Button'
import { TextAreaField, TextField } from '../components/ui/Field'
import { ScreenLayout } from '../components/ui/ScreenLayout'
import { Section } from '../components/ui/Section'
import { db } from '../db/db'
import { getEngineerDefaults, saveEngineerDefaults } from '../lib/engineerDefaults'
import { formatDateShort } from '../lib/reportDates'
import { type VisitDraft, createVisit, getNextReportNumber, updateVisit } from '../db/visits'
import type { Attendee, Visit } from '../types/visit'
import type { Project } from '../types/project'

function toVisitDraft(visit: Visit): VisitDraft {
  const { id: _id, createdAt: _createdAt, reportNumber: _reportNumber, ...draft } = visit
  return draft
}

interface EditVisitFormProps {
  projectId: string
  visitId: string
  initial: VisitDraft
}

/** Editing stays on its own route per the design handoff — purpose,
 * attendees, engineer, general state, and next observation can all still be
 * changed here after the visit is created; only the New Visit *creation*
 * flow below got the field-UX redesign. */
function EditVisitForm({ projectId, visitId, initial }: EditVisitFormProps) {
  const navigate = useNavigate()
  const [draft, setDraft] = useState<VisitDraft>(initial)
  const [saving, setSaving] = useState(false)

  function patch(fields: Partial<VisitDraft>) {
    setDraft((d) => ({ ...d, ...fields }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      saveEngineerDefaults({
        engineerName: draft.engineerName,
        engineerTitle: draft.engineerTitle,
        engineerCredential: draft.engineerCredential,
      })
      await updateVisit(visitId, { ...draft, projectId })
      navigate(`/visits/${visitId}`, { replace: true })
    } finally {
      setSaving(false)
    }
  }

  return (
    <ScreenLayout
      appBar={<AppBar backLabel="Back" backTo={`/visits/${visitId}`} title="Edit visit" />}
      footer={
        <Button onClick={handleSave} disabled={saving} className="min-h-[52px] w-full">
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      }
    >
      <div className="flex flex-col gap-6 p-4">
        <Section title="Visit">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Visit date"
              type="date"
              value={draft.visitDate}
              onChange={(e) => patch({ visitDate: e.target.value })}
            />
            <TextField
              label="Report date"
              type="date"
              value={draft.reportDate}
              onChange={(e) => patch({ reportDate: e.target.value })}
            />
          </div>
          <TextAreaField
            label="Purpose"
            value={draft.purpose}
            onChange={(e) => patch({ purpose: e.target.value })}
            placeholder="review framing progress prior to pouring concrete"
          />
          <TextAreaField
            label="General state (optional)"
            hint="Opening context paragraph — e.g. construction progress at the time of the visit."
            value={draft.generalState}
            onChange={(e) => patch({ generalState: e.target.value })}
          />
        </Section>

        <Section title="Attendees" description="Renders as the PRESENT: block on the report.">
          <AttendeesEditor attendees={draft.attendees} onChange={(attendees) => patch({ attendees })} />
        </Section>

        <Section title="Engineer">
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField
              label="Name"
              value={draft.engineerName}
              onChange={(e) => patch({ engineerName: e.target.value })}
              placeholder="Name"
            />
            <TextField
              label="Title"
              value={draft.engineerTitle}
              onChange={(e) => patch({ engineerTitle: e.target.value })}
              placeholder="Title"
            />
            <TextField
              label="Credential"
              value={draft.engineerCredential}
              onChange={(e) => patch({ engineerCredential: e.target.value })}
              placeholder="SE"
            />
          </div>
          <TextField
            label="Next observation"
            value={draft.nextObservation}
            onChange={(e) => patch({ nextObservation: e.target.value })}
            placeholder="Prior to next phase of work. Tentatively 00/00/00."
          />
        </Section>
      </div>
    </ScreenLayout>
  )
}

interface DraftAttendee extends Attendee {
  on: boolean
}

interface NewVisitFormProps {
  project: Project
  previousVisits: Visit[] // desc by reportNumber
  nextReportNumber: number
}

function NewVisitForm({ project, previousVisits, nextReportNumber }: NewVisitFormProps) {
  const navigate = useNavigate()
  const prev = previousVisits[0] as Visit | undefined
  const engineer = getEngineerDefaults()

  const recentPurposes = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const v of previousVisits) {
      if (seen.has(v.purpose) || !v.purpose.trim()) continue
      seen.add(v.purpose)
      out.push(v.purpose)
      if (out.length === 2) break
    }
    return out
  }, [previousVisits])

  const [day, setDay] = useState<'today' | 'yesterday'>('today')
  const [purpose, setPurpose] = useState('')
  const [attendees, setAttendees] = useState<DraftAttendee[]>(
    () => prev?.attendees.map((a) => ({ ...a, on: true })) ?? [],
  )
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newFirm, setNewFirm] = useState('')
  const [starting, setStarting] = useState(false)

  function toggleAttendee(index: number) {
    setAttendees((a) => a.map((x, i) => (i === index ? { ...x, on: !x.on } : x)))
  }

  function addAttendee() {
    if (!newName.trim() && !newFirm.trim()) {
      setAdding(false)
      return
    }
    setAttendees((a) => [...a, { name: newName.trim(), firm: newFirm.trim(), on: true }])
    setNewName('')
    setNewFirm('')
    setAdding(false)
  }

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const todayIso = new Date().toISOString().slice(0, 10)
  const yesterdayIso = yesterday.toISOString().slice(0, 10)
  const visitDate = day === 'today' ? todayIso : yesterdayIso

  async function handleStart() {
    if (!purpose.trim()) return
    setStarting(true)
    try {
      const visit = await createVisit({
        projectId: project.id,
        visitDate,
        reportDate: visitDate,
        purpose: purpose.trim(),
        generalState: '',
        attendees: attendees.filter((a) => a.on).map(({ name, firm }) => ({ name, firm })),
        engineerName: engineer.engineerName,
        engineerTitle: engineer.engineerTitle,
        engineerCredential: engineer.engineerCredential,
        nextObservation: '',
        closing: 'work-in-progress',
        status: 'draft',
      })
      navigate(`/visits/${visit.id}`, {
        replace: true,
        state: { toast: `Field Report #${visit.reportNumber} started` },
      })
    } finally {
      setStarting(false)
    }
  }

  const dayOptions: { value: 'today' | 'yesterday'; label: string }[] = [
    { value: 'today', label: `Today · ${formatDateShort(todayIso)}` },
    { value: 'yesterday', label: 'Yesterday' },
  ]

  const engineerLine = [
    [engineer.engineerName, engineer.engineerCredential].filter(Boolean).join(', '),
    engineer.engineerTitle,
  ]
    .filter(Boolean)
    .join(' — ')

  return (
    <ScreenLayout
      appBar={
        <AppBar
          backLabel={project.name}
          backTo={`/projects/${project.id}`}
          title="New visit"
          subtitle={`Becomes Field Report #${nextReportNumber}`}
        />
      }
      footer={
        <Button onClick={handleStart} disabled={starting || !purpose.trim()} className="min-h-[52px] w-full">
          {starting ? 'Starting…' : 'Start visit and add items'}
        </Button>
      }
    >
      <div className="flex flex-col gap-5 p-4">
        <div>
          <span className="mb-1.5 block font-eyebrow text-sm font-semibold tracking-[0.14em] text-wr-brown-700 uppercase">
            Visit date
          </span>
          <div className="flex gap-2">
            {dayOptions.map((opt) => {
              const selected = day === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDay(opt.value)}
                  className="min-h-12 flex-1 rounded font-body text-sm font-semibold"
                  style={
                    selected
                      ? { background: '#003D4C', color: '#fff' }
                      : { background: '#fff', color: '#3D4649', border: '1px solid #DCD8CA' }
                  }
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <TextAreaField
            label="Purpose"
            rows={3}
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="review framing progress prior to pouring concrete"
          />
          {recentPurposes.length > 0 && (
            <>
              <p className="mt-2 text-xs text-wr-ink-500">From earlier visits — tap to reuse</p>
              <div className="mt-1.5 flex flex-col gap-1.5">
                {recentPurposes.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPurpose(p)}
                    className="min-h-11 rounded border border-dashed border-wr-taupe-500 bg-wr-brown-50 px-3 py-2.5 text-left font-body text-sm text-wr-brown-900"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-eyebrow text-sm font-semibold tracking-[0.14em] text-wr-brown-700 uppercase">
              Present
            </span>
            {prev && <span className="text-xs text-wr-ink-500">From Field Report #{prev.reportNumber}</span>}
          </div>
          <div className="mt-1.5 flex flex-col gap-1.5">
            {attendees.map((a, index) => (
              <button
                key={index}
                type="button"
                onClick={() => toggleAttendee(index)}
                className="flex min-h-[52px] items-center gap-2.5 rounded px-3 py-2 text-left"
                style={
                  a.on
                    ? { background: '#fff', border: '1px solid #003D4C' }
                    : { background: '#FAF8F4', border: '1px solid #DCD8CA' }
                }
              >
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-xs text-white"
                  style={a.on ? { background: '#003D4C', border: '1px solid #003D4C' } : { border: '1px solid #A4ABAD' }}
                >
                  {a.on ? '✓' : ''}
                </span>
                <span className="flex flex-col">
                  <span className="text-[15px] font-semibold text-wr-ink-900">{a.name || 'Unnamed'}</span>
                  <span className="text-[13px] text-wr-ink-500">{a.firm}</span>
                </span>
              </button>
            ))}

            {adding ? (
              <div className="flex flex-col gap-2.5 rounded border border-wr-taupe-200 bg-white p-3">
                <TextField label="Name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" />
                <TextField label="Firm" value={newFirm} onChange={(e) => setNewFirm(e.target.value)} placeholder="Firm" />
                <Button onClick={addAttendee} className="min-h-11 w-full">
                  Add to PRESENT
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="min-h-11 self-start font-body text-sm font-semibold text-wr-blue-800"
              >
                + Add someone
              </button>
            )}
          </div>
        </div>

        <div className="rounded border border-wr-taupe-200 bg-white p-3">
          <div className="text-xs text-wr-ink-500">Engineer</div>
          <div className="mt-0.5 text-[15px] font-semibold text-wr-ink-900">
            {engineerLine || 'Set on the Edit Visit screen after starting'}
          </div>
        </div>

        <div className="border-t border-wr-taupe-200 pt-4">
          <div className="font-heading text-[15px] font-semibold text-wr-blue-900">Before the report (optional)</div>
          <p className="mt-1 text-[13px] text-wr-ink-500">
            General state and next observation can be added from the report preview after the visit.
          </p>
        </div>
      </div>
    </ScreenLayout>
  )
}

export function VisitFormPage() {
  const { projectId: newProjectId, visitId } = useParams()
  const isNew = !visitId

  const existingVisit = useLiveQuery(() => (visitId ? db.visits.get(visitId) : undefined), [visitId])
  const projectId = isNew ? newProjectId : existingVisit?.projectId

  const project = useLiveQuery(() => (projectId ? db.projects.get(projectId) : undefined), [projectId])
  const previousVisits = useLiveQuery(
    async () => (isNew && projectId ? db.visits.where('projectId').equals(projectId).reverse().sortBy('reportNumber') : undefined),
    [isNew, projectId],
  )
  const nextReportNumber = useLiveQuery(
    () => (isNew && projectId ? getNextReportNumber(projectId) : undefined),
    [isNew, projectId],
  )

  const ready = isNew
    ? project !== undefined && previousVisits !== undefined && nextReportNumber !== undefined
    : existingVisit !== undefined && project !== undefined

  if (!ready) {
    return (
      <ScreenLayout appBar={<AppBar backLabel="Back" backTo="/" title="Loading…" />}>
        <p className="p-4 text-wr-ink-500">Loading…</p>
      </ScreenLayout>
    )
  }

  if (isNew && project && previousVisits && nextReportNumber !== undefined) {
    return <NewVisitForm project={project} previousVisits={previousVisits} nextReportNumber={nextReportNumber} />
  }

  if (!isNew && existingVisit && project) {
    return (
      <EditVisitForm
        key={existingVisit.id}
        projectId={project.id}
        visitId={existingVisit.id}
        initial={toVisitDraft(existingVisit)}
      />
    )
  }

  return null
}
