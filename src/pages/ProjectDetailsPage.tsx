import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { AppBar } from '../components/ui/AppBar'
import { Button } from '../components/ui/Button'
import { TextField } from '../components/ui/Field'
import { ScreenLayout } from '../components/ui/ScreenLayout'
import { db } from '../db/db'
import { type ProjectDraft, createProject, deleteProject, emptyProjectDraft, updateProject } from '../db/projects'
import type { Project } from '../types/project'

function toDraft(project: Project): ProjectDraft {
  const { id: _id, createdAt: _createdAt, ...draft } = project
  return draft
}

const FIELDS: { key: keyof ProjectDraft; label: string; placeholder: string }[] = [
  { key: 'jobNumber', label: 'Job number', placeholder: '00-000' },
  { key: 'name', label: 'Project name', placeholder: 'Project Name' },
  { key: 'location', label: 'Location', placeholder: 'City, ST' },
  { key: 'clientFirm', label: 'Client firm', placeholder: 'Client Firm' },
  { key: 'clientCity', label: 'Client city', placeholder: 'City, ST' },
  { key: 'clientAttn', label: 'Attn', placeholder: 'Name' },
]

interface ProjectFormProps {
  id: string | undefined
  initial: ProjectDraft
}

/**
 * Mounted only once its initial values are known (see ProjectDetailsPage
 * below), so `initial` never changes out from under an in-progress edit.
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
        navigate(`/projects/${id}`, { replace: true })
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

  const canSave = draft.jobNumber.trim().length > 0 && draft.name.trim().length > 0

  return (
    <ScreenLayout
      appBar={
        <AppBar
          backLabel="Back"
          backTo={isNew ? '/' : `/projects/${id}`}
          title={isNew ? 'New project' : 'Project details'}
          subtitle="The client fields fill the TO: / ATTN: block on the report."
        />
      }
      footer={
        <Button onClick={handleSave} disabled={saving || !canSave} className="min-h-[52px] w-full">
          {saving ? 'Saving…' : isNew ? 'Create project' : 'Save changes'}
        </Button>
      }
    >
      <div className="flex flex-col gap-3.5 p-4">
        {FIELDS.map((f) => (
          <TextField
            key={f.key}
            label={f.label}
            value={draft[f.key] as string}
            onChange={(e) => patch({ [f.key]: e.target.value } as Partial<ProjectDraft>)}
            placeholder={f.placeholder}
          />
        ))}
        {!isNew && (
          <Button variant="danger" onClick={handleDelete} disabled={deleting} className="mt-3 min-h-12 w-full">
            {deleting ? 'Deleting…' : 'Delete project'}
          </Button>
        )}
      </div>
    </ScreenLayout>
  )
}

export function ProjectDetailsPage() {
  const { id } = useParams()
  const isNew = !id

  const existingProject = useLiveQuery(() => (id ? db.projects.get(id) : undefined), [id])
  const loading = !isNew && existingProject === undefined

  if (loading) {
    return (
      <ScreenLayout appBar={<AppBar backLabel="Back" backTo="/" title="Loading…" />}>
        <p className="p-4 text-wr-ink-500">Loading…</p>
      </ScreenLayout>
    )
  }

  if (isNew) return <ProjectForm id={undefined} initial={emptyProjectDraft()} />

  if (existingProject) {
    // Keyed by id so navigating between two existing projects remounts with
    // the right initial data.
    return <ProjectForm key={existingProject.id} id={existingProject.id} initial={toDraft(existingProject)} />
  }

  return null
}
