import { newId } from '../lib/id'
import type { Project } from '../types/project'
import { db } from './db'

export type ProjectDraft = Omit<Project, 'id' | 'createdAt'>

export function emptyProjectDraft(): ProjectDraft {
  return {
    jobNumber: '',
    name: '',
    location: '',
    clientFirm: '',
    clientCity: '',
    clientAttn: '',
    gridLetters: [],
    gridNumbers: [],
    sheets: [],
    elementPresets: [],
  }
}

export async function listProjects(): Promise<Project[]> {
  return db.projects.orderBy('createdAt').reverse().toArray()
}

export async function getProject(id: string): Promise<Project | undefined> {
  return db.projects.get(id)
}

export async function createProject(draft: ProjectDraft): Promise<Project> {
  const project: Project = { ...draft, id: newId(), createdAt: Date.now() }
  await db.projects.add(project)
  return project
}

export async function updateProject(id: string, draft: ProjectDraft): Promise<void> {
  await db.projects.update(id, draft)
}

export async function deleteProject(id: string): Promise<void> {
  await db.transaction('rw', db.projects, db.visits, db.items, db.photos, db.audioNotes, async () => {
    const visits = await db.visits.where('projectId').equals(id).toArray()
    const visitIds = visits.map((v) => v.id)
    if (visitIds.length > 0) {
      const items = await db.items.where('visitId').anyOf(visitIds).toArray()
      const itemIds = items.map((i) => i.id)
      if (itemIds.length > 0) {
        await db.audioNotes.where('itemId').anyOf(itemIds).delete()
      }
      await db.photos.where('visitId').anyOf(visitIds).delete()
      await db.items.where('visitId').anyOf(visitIds).delete()
      await db.visits.where('projectId').equals(id).delete()
    }
    await db.projects.delete(id)
  })
}

/**
 * Learns a new element/level preset from a saved item, so the second item
 * of a visit autocompletes faster than the first. Silently no-ops on a
 * blank value or an exact duplicate.
 */
export async function addElementPreset(id: string, value: string): Promise<void> {
  const trimmed = value.trim()
  if (!trimmed) return
  const project = await db.projects.get(id)
  if (!project || project.elementPresets.includes(trimmed)) return
  await db.projects.update(id, { elementPresets: [...project.elementPresets, trimmed] })
}
