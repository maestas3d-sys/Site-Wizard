import Dexie, { type Table } from 'dexie'
import type { AudioNote } from '../types/audio'
import type { Item } from '../types/item'
import type { Photo } from '../types/photo'
import type { Project } from '../types/project'
import type { Visit } from '../types/visit'

/**
 * All app data lives in IndexedDB via Dexie — this is a single-user,
 * single-device, backend-free build (Phase 1). Every record carries its own
 * uuid primary key so a future sync layer can adopt them without a rewrite.
 */
export class SiteWizardDB extends Dexie {
  projects!: Table<Project, string>
  visits!: Table<Visit, string>
  items!: Table<Item, string>
  photos!: Table<Photo, string>
  audioNotes!: Table<AudioNote, string>

  constructor() {
    super('site-wizard')
    this.version(1).stores({
      projects: 'id, jobNumber, name, createdAt',
      // &[projectId+reportNumber] keeps report numbers gapless-and-unique
      // per project at the DB layer, on top of the app assigning them.
      visits: 'id, projectId, &[projectId+reportNumber], createdAt',
      items: 'id, visitId, sequenceNumber, createdAt',
      photos: 'id, visitId, itemId, orderIndex',
      audioNotes: 'id, itemId, createdAt',
    })
  }
}

export const db = new SiteWizardDB()
