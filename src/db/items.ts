import { newId } from '../lib/id'
import type { Item } from '../types/item'
import { type PendingAudioNote, reconcileAudioNote } from './audioNotes'
import { db } from './db'
import { type PendingPhoto, reconcilePhotos } from './photos'

export type ItemDraft = Omit<Item, 'id' | 'visitId' | 'sequenceNumber' | 'createdAt' | 'updatedAt'>

export function emptyItemDraft(): ItemDraft {
  return {
    gridRef: '',
    elementRef: '',
    levelRef: '',
    itemType: 'deficiency',
    bodyText: '',
    detailRefs: [],
    measurements: [],
    photoIds: [],
  }
}

export async function listItemsByVisit(visitId: string): Promise<Item[]> {
  return db.items.where('visitId').equals(visitId).sortBy('sequenceNumber')
}

export async function getItem(id: string): Promise<Item | undefined> {
  return db.items.get(id)
}

export async function createItem(visitId: string, draft: ItemDraft, id: string = newId()): Promise<Item> {
  const existing = await listItemsByVisit(visitId)
  const now = Date.now()
  const item: Item = {
    ...draft,
    id,
    visitId,
    sequenceNumber: existing.length + 1,
    createdAt: now,
    updatedAt: now,
  }
  await db.items.add(item)
  return item
}

export async function updateItem(id: string, draft: ItemDraft): Promise<void> {
  await db.items.update(id, { ...draft, updatedAt: Date.now() })
}

/**
 * Saves an item, its photos, and its voice memo together, in one
 * transaction: photos and the audio note are reconciled against the
 * item's (possibly not-yet-existing) id first, then the item is created
 * or updated with the resulting photoIds/audioId. Nothing is left
 * half-written if any part fails.
 */
export async function saveItem(
  visitId: string,
  itemId: string | undefined,
  draft: ItemDraft,
  photos: PendingPhoto[],
  originalPhotoIds: string[],
  audioNote: PendingAudioNote | null,
  originalAudioId: string | undefined,
): Promise<Item> {
  return db.transaction('rw', db.items, db.photos, db.audioNotes, async () => {
    const finalItemId = itemId ?? newId()
    const photoIds = await reconcilePhotos(visitId, finalItemId, photos, originalPhotoIds)
    const audioId = await reconcileAudioNote(finalItemId, audioNote, originalAudioId)
    const fullDraft: ItemDraft = { ...draft, photoIds, audioId }

    if (itemId) {
      await updateItem(itemId, fullDraft)
      const updated = await db.items.get(itemId)
      if (!updated) throw new Error('Item vanished mid-save')
      return updated
    }
    return createItem(visitId, fullDraft, finalItemId)
  })
}

/** Renumbers a visit's items to a gapless 1..N in their current sequence order. */
async function renumber(visitId: string): Promise<void> {
  const items = await listItemsByVisit(visitId)
  await Promise.all(
    items.map((item, index) => db.items.update(item.id, { sequenceNumber: index + 1 })),
  )
}

export async function deleteItem(id: string): Promise<void> {
  const item = await db.items.get(id)
  if (!item) return
  await db.transaction('rw', db.items, db.photos, db.audioNotes, async () => {
    await db.photos.where('itemId').equals(id).delete()
    await db.audioNotes.where('itemId').equals(id).delete()
    await db.items.delete(id)
    await renumber(item.visitId)
  })
}

/** Swaps an item with its neighbor — the reorder mechanism until a drag handle replaces it. */
export async function moveItem(visitId: string, itemId: string, direction: 'up' | 'down'): Promise<void> {
  const items = await listItemsByVisit(visitId)
  const index = items.findIndex((it) => it.id === itemId)
  if (index === -1) return
  const swapWith = direction === 'up' ? index - 1 : index + 1
  if (swapWith < 0 || swapWith >= items.length) return

  const a = items[index]
  const b = items[swapWith]
  await db.transaction('rw', db.items, async () => {
    await db.items.update(a.id, { sequenceNumber: b.sequenceNumber })
    await db.items.update(b.id, { sequenceNumber: a.sequenceNumber })
  })
}
