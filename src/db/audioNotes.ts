import type { AudioNote } from '../types/audio'
import { db } from './db'

/**
 * An item's voice memo held in memory, not necessarily written to Dexie yet
 * — same "pending until the item is saved" pattern as PendingPhoto.
 */
export interface PendingAudioNote {
  id: string
  blob: Blob
  durationSec: number
}

/** Loads an existing item's audio note as a pending record, for editing. */
export async function loadPendingAudioNote(audioId: string | undefined): Promise<PendingAudioNote | null> {
  if (!audioId) return null
  const note = await db.audioNotes.get(audioId)
  if (!note) return null
  return { id: note.id, blob: note.blob, durationSec: note.durationSec }
}

/**
 * Reconciles an item's audio note against what's stored: if it was removed
 * or replaced with a re-recording, the old row is deleted; the new one (if
 * any) is upserted, preserving its original createdAt when it's the same
 * note being saved unchanged. Returns the id to store as Item.audioId.
 */
export async function reconcileAudioNote(
  itemId: string,
  pending: PendingAudioNote | null,
  originalId: string | undefined,
): Promise<string | undefined> {
  return db.transaction('rw', db.audioNotes, async () => {
    if (originalId && originalId !== pending?.id) {
      await db.audioNotes.delete(originalId)
    }
    if (!pending) return undefined

    const unchanged = pending.id === originalId
    const existing = unchanged ? await db.audioNotes.get(pending.id) : undefined
    const record: AudioNote = {
      id: pending.id,
      itemId,
      blob: pending.blob,
      durationSec: pending.durationSec,
      createdAt: existing?.createdAt ?? Date.now(),
    }
    await db.audioNotes.put(record)
    return pending.id
  })
}
