import { newId } from '../lib/id'
import type { Item } from '../types/item'
import { db } from './db'

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

export async function createItem(visitId: string, draft: ItemDraft): Promise<Item> {
  const existing = await listItemsByVisit(visitId)
  const now = Date.now()
  const item: Item = {
    ...draft,
    id: newId(),
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
