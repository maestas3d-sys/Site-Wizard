import type { PendingAudioNote } from './audioNotes'
import { db } from './db'
import type { ItemDraft } from './items'
import type { PendingPhoto } from './photos'

/**
 * A full in-progress Item Capture snapshot — everything ItemForm holds in
 * local state, including photo/audio blobs — autosaved to Dexie on every
 * field change so a dropped phone or force-quit mid-item doesn't lose it
 * (brief §8, and acceptance criterion #7). This is distinct from the
 * item's *actual* saved record: nothing here is a real Item/Photo/
 * AudioNote until Save is tapped, same as the rest of the form's
 * pending-until-save design.
 */
export interface ItemDraftRecord {
  key: string
  visitId: string
  itemId?: string
  draft: ItemDraft
  detailRefsText: string
  photos: PendingPhoto[]
  audioNote: PendingAudioNote | null
  updatedAt: number
}

/** Draft key for a not-yet-created item — one slot per visit, since only one "new item" form is open at a time. */
export function newItemDraftKey(visitId: string): string {
  return `new:${visitId}`
}

/** Draft key for in-progress edits to an existing item. */
export function editItemDraftKey(itemId: string): string {
  return `edit:${itemId}`
}

export async function saveItemDraftSnapshot(snapshot: Omit<ItemDraftRecord, 'updatedAt'>): Promise<void> {
  await db.itemDrafts.put({ ...snapshot, updatedAt: Date.now() })
}

export async function loadItemDraftSnapshot(key: string): Promise<ItemDraftRecord | undefined> {
  return db.itemDrafts.get(key)
}

export async function clearItemDraftSnapshot(key: string): Promise<void> {
  await db.itemDrafts.delete(key)
}
