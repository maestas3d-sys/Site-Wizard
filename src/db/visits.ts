import { newId } from '../lib/id'
import type { Visit } from '../types/visit'
import { db } from './db'

export type VisitDraft = Omit<Visit, 'id' | 'createdAt' | 'reportNumber'>

export function emptyVisitDraft(): VisitDraft {
  const today = new Date().toISOString().slice(0, 10)
  return {
    projectId: '',
    visitDate: today,
    reportDate: today,
    purpose: '',
    generalState: '',
    attendees: [],
    engineerName: '',
    engineerTitle: '',
    engineerCredential: '',
    nextObservation: '',
    status: 'draft',
  }
}

export async function listVisitsByProject(projectId: string): Promise<Visit[]> {
  return db.visits.where('projectId').equals(projectId).sortBy('reportNumber')
}

export async function getVisit(id: string): Promise<Visit | undefined> {
  return db.visits.get(id)
}

/** Report numbers are gapless per project — the next one is simply the current max + 1. */
export async function getNextReportNumber(projectId: string): Promise<number> {
  const visits = await db.visits.where('projectId').equals(projectId).toArray()
  return visits.reduce((max, v) => Math.max(max, v.reportNumber), 0) + 1
}

export async function createVisit(draft: VisitDraft): Promise<Visit> {
  const reportNumber = await getNextReportNumber(draft.projectId)
  const visit: Visit = { ...draft, id: newId(), reportNumber, createdAt: Date.now() }
  await db.visits.add(visit)
  return visit
}

export async function updateVisit(id: string, draft: VisitDraft): Promise<void> {
  await db.visits.update(id, draft)
}

export async function deleteVisit(id: string): Promise<void> {
  await db.transaction('rw', db.visits, db.items, db.photos, db.audioNotes, async () => {
    const items = await db.items.where('visitId').equals(id).toArray()
    const itemIds = items.map((i) => i.id)
    if (itemIds.length > 0) {
      await db.audioNotes.where('itemId').anyOf(itemIds).delete()
    }
    await db.photos.where('visitId').equals(id).delete()
    await db.items.where('visitId').equals(id).delete()
    await db.visits.delete(id)
  })
}
