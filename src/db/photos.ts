import type { Photo } from '../types/photo'
import { db } from './db'

/**
 * A photo attached to an item that hasn't necessarily been written to Dexie
 * yet — item capture holds all its photos as in-memory pending records
 * (mirroring how detailRefs/measurements work) and only reconciles them
 * against the `photos` table when the item itself is saved.
 */
export interface PendingPhoto {
  id: string
  blob: Blob
  thumbBlob: Blob
  caption: string
  includeInReport: boolean
  exifTimestamp?: number
  orientationCorrected: boolean
}

/** Loads an existing item's photos as pending records, in photoIds order, for editing. */
export async function loadPendingPhotos(photoIds: string[]): Promise<PendingPhoto[]> {
  if (photoIds.length === 0) return []
  const photos = await db.photos.bulkGet(photoIds) // preserves input order
  return photos
    .filter((p): p is Photo => p !== undefined)
    .map((p) => ({
      id: p.id,
      blob: p.blob,
      thumbBlob: p.thumbBlob,
      caption: p.caption,
      includeInReport: p.includeInReport,
      exifTimestamp: p.exifTimestamp,
      orientationCorrected: p.orientationCorrected,
    }))
}

/**
 * Reconciles an item's final photo list against what's stored: anything
 * dropped from `pending` since `originalIds` was captured gets deleted,
 * everything remaining is upserted (put() covers both new and edited
 * records) with orderIndex set from its position. Returns the ids in
 * order, ready to store as Item.photoIds.
 */
export async function reconcilePhotos(
  visitId: string,
  itemId: string,
  pending: PendingPhoto[],
  originalIds: string[],
): Promise<string[]> {
  const finalIds = pending.map((p) => p.id)
  const removedIds = originalIds.filter((id) => !finalIds.includes(id))

  return db.transaction('rw', db.photos, async () => {
    if (removedIds.length > 0) {
      await db.photos.bulkDelete(removedIds)
    }
    await Promise.all(
      pending.map((p, index) => {
        const record: Photo = {
          id: p.id,
          visitId,
          itemId,
          blob: p.blob,
          thumbBlob: p.thumbBlob,
          label: '', // assigned at report generation, per the data model
          caption: p.caption,
          exifTimestamp: p.exifTimestamp,
          orientationCorrected: p.orientationCorrected,
          includeInReport: p.includeInReport,
          orderIndex: index,
        }
        return db.photos.put(record)
      }),
    )
    return finalIds
  })
}
