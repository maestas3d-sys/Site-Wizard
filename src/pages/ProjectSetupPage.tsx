import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { TextField } from '../components/ui/Field'
import { Section } from '../components/ui/Section'
import { db } from '../db/db'
import {
  type ProjectDraft,
  createProject,
  deleteProject,
  emptyProjectDraft,
  updateProject,
} from '../db/projects'
import { listVisitsByProject } from '../db/visits'
import type { Project } from '../types/project'

function toDraft(project: Project): ProjectDraft {
  const { id: _id, createdAt: _createdAt, ...draft } = project
  return draft
}

interface ProjectFormProps {
  id: string | undefined
  initial: ProjectDraft
}

/**
 * Mounted only once its initial values are known (see ProjectSetupPage
 * below), so `initial` never changes out from under an in-progress edit —
 * no prop-resync machinery needed here or in the child editors.
 */
function ProjectForm({ id, initial }: ProjectFormProps) {
  const navigate = useNavigate()
  const isNew = !id
  const [draft, setDraft] = useState<ProjectDraft>(initial)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function patch(fields: Partial<ProjectDraft>) {
    setDraft((d) => ({ ...d, ...fields }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      if (isNew) {
        const project = await createProject(draft)
        navigate(`/projects/${project.id}`, { replace: true })
      } else {
        await updateProject(id, draft)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!id) return
    if (
      !window.confirm(
        `Delete "${draft.name || 'this project'}"? This also deletes its visits, items, photos, and audio notes. This cannot be undone.`,
      )
    )
      return
    setDeleting(true)
    try {
      await deleteProject(id)
      navigate('/', { replace: true })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Section title="Project info">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Job number"
            value={draft.jobNumber}
            onChange={(e) => patch({ jobNumber: e.target.value })}
            placeholder="24-087"
          />
          <TextField
            label="Project name"
            value={draft.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="MHHS Athletic Improvements"
          />
        </div>
        <TextField
          label="Location"
          value={draft.location}
          onChange={(e) => patch({ location: e.target.value })}
          placeholder="San Marcos, CA"
        />
      </Section>

      <Section title="Client" description="Populates the TO: / ATTN: block on generated reports.">
        <TextField
          label="Client firm"
          value={draft.clientFirm}
          onChange={(e) => patch({ clientFirm: e.target.value })}
          placeholder="tBP/Architecture"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Client city"
            value={draft.clientCity}
            onChange={(e) => patch({ clientCity: e.target.value })}
            placeholder="Solana Beach, CA"
          />
          <TextField
            label="Attn"
            value={draft.clientAttn}
            onChange={(e) => patch({ clientAttn: e.target.value })}
            placeholder="Chuck Forte"
          />
        </div>
      </Section>

      <div className="flex items-center justify-between gap-3">
        <Button onClick={handleSave} disabled={saving || !draft.jobNumber || !draft.name}>
          {saving ? 'Saving…' : isNew ? 'Create project' : 'Save changes'}
        </Button>
        {!isNew && (
          <Button variant="danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete project'}
          </Button>
        )}
      </div>

      {!isNew && <VisitsSection projectId={id} />}
    </div>
  )
}

function VisitsSection({ projectId }: { projectId: string }) {
  const visits = useLiveQuery(() => listVisitsByProject(projectId), [projectId])

  return (
    <Section title="Visits">
      <div className="-mt-2 mb-2 flex justify-end">
        <Link
          to={`/projects/${projectId}/visits/new`}
          className="flex min-h-12 items-center rounded-lg bg-blue-600 px-4 py-3 text-base font-semibold text-white shadow-sm active:bg-blue-700"
        >
          + New Visit
        </Link>
      </div>

      {visits === undefined && <p className="text-slate-500">Loading…</p>}
      {visits?.length === 0 && <p className="text-sm text-slate-500">No visits yet.</p>}

      <ul className="space-y-2">
        {visits?.map((visit) => (
          <li key={visit.id}>
            <Link
              to={`/visits/${visit.id}`}
              className="block rounded-lg border border-slate-200 bg-white p-3 active:bg-slate-50"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-semibold text-slate-900">Field Report #{visit.reportNumber}</span>
                <span className="shrink-0 text-sm text-slate-500">{visit.visitDate}</span>
              </div>
              <div className="truncate text-sm text-slate-500">{visit.purpose || 'No purpose set'}</div>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  )
}

export function ProjectSetupPage() {
  const { id } = useParams()
  const isNew = !id

  const existingProject = useLiveQuery(() => (id ? db.projects.get(id) : undefined), [id])
  const loading = !isNew && existingProject === undefined

  return (
    <div className="mx-auto max-w-2xl p-4 pb-24">
      <header className="mb-6 flex items-center gap-3">
        <Link to="/" className="text-2xl text-slate-400 hover:text-slate-600" aria-label="Back to projects">
          ←
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">
          {isNew ? 'New Project' : (existingProject?.name ?? 'Project')}
        </h1>
      </header>

      {loading && <p className="text-slate-500">Loading…</p>}

      {isNew && <ProjectForm id={undefined} initial={emptyProjectDraft()} />}

      {!isNew && existingProject && (
        // Keyed by id so navigating between two existing projects (or from
        // "new" to a freshly created one) remounts with the right initial data.
        <ProjectForm key={existingProject.id} id={existingProject.id} initial={toDraft(existingProject)} />
      )}
    </div>
  )
}
