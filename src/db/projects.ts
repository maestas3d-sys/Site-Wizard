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
  // Phase 1 has no visits/items yet to cascade; once those exist, deleting a
  // project must also remove its visits, items, photos, and audio notes.
  await db.projects.delete(id)
}
