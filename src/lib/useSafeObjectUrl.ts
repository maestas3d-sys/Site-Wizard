import { useEffect, useMemo } from 'react'

/**
 * Object URLs are how the whole app displays a stored Blob (photos, audio
 * memos) — but `URL.createObjectURL` throws synchronously on anything that
 * isn't a real Blob, and an uncaught error during render unmounts the whole
 * React tree to a blank screen, not just the one photo. A record with a
 * missing or corrupt blob — an older schema version's data, a browser
 * storage eviction, an interrupted write — must never take the rest of the
 * app down with it. Returns null instead of throwing when `blob` isn't a
 * valid Blob, so callers can render a placeholder for just that one item.
 */
export function useSafeObjectUrl(blob: unknown): string | null {
  const isValid = blob instanceof Blob
  const url = useMemo(() => (isValid ? URL.createObjectURL(blob as Blob) : null), [blob, isValid])
  useEffect(() => {
    if (!url) return
    return () => URL.revokeObjectURL(url)
  }, [url])
  return url
}
