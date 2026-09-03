import Dexie, { type Table } from 'dexie'
import type { AudioNote } from '../types/audio'
import type { Item } from '../types/item'
import type { Photo } from '../types/photo'
import type { Project } from '../types/project'
import type { Visit } from '../types/visit'
import type { ItemDraftRecord } from './itemDrafts'

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
  itemDrafts!: Table<ItemDraftRecord, string>

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
    // itemDrafts: an in-progress Item Capture snapshot, keyed by
    // "new:<visitId>" or "edit:<itemId>" (see itemDrafts.ts) — autosaved on
    // every field change so a dropped phone or force-quit mid-item doesn't
    // lose it (§8 of the brief). Added in v2, additive-only: existing data
    // in the other tables is untouched by this upgrade.
    this.version(2).stores({
      itemDrafts: 'key, updatedAt',
    })
  }
}

export const db = new SiteWizardDB()
