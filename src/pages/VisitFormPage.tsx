import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AttendeesEditor } from '../components/visit/AttendeesEditor'
import { Button } from '../components/ui/Button'
import { TextAreaField, TextField } from '../components/ui/Field'
import { Section } from '../components/ui/Section'
import { db } from '../db/db'
import { getEngineerDefaults, saveEngineerDefaults } from '../lib/engineerDefaults'
import {
  type VisitDraft,
  createVisit,
  emptyVisitDraft,
  getNextReportNumber,
  updateVisit,
} from '../db/visits'
import type { Visit } from '../types/visit'

function toVisitDraft(visit: Visit): VisitDraft {
  const { id: _id, createdAt: _createdAt, reportNumber: _reportNumber, ...draft } = visit
  return draft
}

interface VisitFormProps {
  projectId: string
  visitId: string | undefined
  initial: VisitDraft
  reportNumberPreview?: number
}

/** Mounted only once its initial values (and, for new visits, the next report number) are known. */
function VisitForm({ projectId, visitId, initial, reportNumberPreview }: VisitFormProps) {
  const navigate = useNavigate()
  const isNew = !visitId
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
      if (isNew) {
        const visit = await createVisit({ ...draft, projectId })
        navigate(`/visits/${visit.id}`, { replace: true })
      } else {
        await updateVisit(visitId, { ...draft, projectId })
        navigate(`/visits/${visitId}`, { replace: true })
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Section title="Visit">
        {isNew && reportNumberPreview !== undefined && (
          <p className="text-sm text-slate-500">
            This will be <span className="font-semibold text-slate-700">Field Report #{reportNumberPreview}</span> for
            this project.
          </p>
        )}
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
          placeholder="review the P/T cables at the tennis courts prior to pouring concrete"
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
            placeholder="David Maestas"
          />
          <TextField
            label="Title"
            value={draft.engineerTitle}
            onChange={(e) => patch({ engineerTitle: e.target.value })}
            placeholder="Principal"
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
          placeholder="Prior to pour-strip concrete pour. Tentatively 10/20/25."
        />
      </Section>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || !draft.purpose}>
          {saving ? 'Saving…' : isNew ? 'Create visit' : 'Save changes'}
        </Button>
      </div>
    </div>
  )
}

export function VisitFormPage() {
  const { projectId: newProjectId, visitId } = useParams()
  const isNew = !visitId

  const existingVisit = useLiveQuery(() => (visitId ? db.visits.get(visitId) : undefined), [visitId])
  const projectId = isNew ? newProjectId : existingVisit?.projectId

  const project = useLiveQuery(() => (projectId ? db.projects.get(projectId) : undefined), [projectId])
  const nextReportNumber = useLiveQuery(
    () => (isNew && projectId ? getNextReportNumber(projectId) : undefined),
    [isNew, projectId],
  )

  const ready = isNew
    ? project !== undefined && nextReportNumber !== undefined
    : existingVisit !== undefined && project !== undefined

  return (
    <div className="mx-auto max-w-2xl p-4 pb-24">
      <header className="mb-6 flex items-center gap-3">
        <Link
          to={project ? `/projects/${project.id}` : '/'}
          className="text-2xl text-slate-400 hover:text-slate-600"
          aria-label="Back to project"
        >
          ←
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{isNew ? 'New Visit' : 'Edit Visit'}</h1>
          {project && <p className="text-sm text-slate-500">{project.name}</p>}
        </div>
      </header>

      {!ready && <p className="text-slate-500">Loading…</p>}

      {ready && isNew && project && (
        <VisitForm
          projectId={project.id}
          visitId={undefined}
          initial={{ ...emptyVisitDraft(), projectId: project.id, ...getEngineerDefaults() }}
          reportNumberPreview={nextReportNumber}
        />
      )}

      {ready && !isNew && existingVisit && project && (
        // Keyed so navigating between two visits' edit forms remounts fresh.
        <VisitForm
          key={existingVisit.id}
          projectId={project.id}
          visitId={existingVisit.id}
          initial={toVisitDraft(existingVisit)}
        />
      )}
    </div>
  )
}
