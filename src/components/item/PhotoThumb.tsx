import { useSafeObjectUrl } from '../../lib/useSafeObjectUrl'

interface PhotoThumbProps {
  blob: Blob
  className?: string
}

/**
 * Renders a Blob via an object URL. The URL is created during render (memoized
 * on the blob's identity, so it isn't recreated every render) and only ever
 * revoked in an effect's cleanup — never re-derived through setState there.
 * A blob that fails to load (missing/corrupt data, e.g. from an older
 * schema version) renders a placeholder instead of crashing the whole page.
 */
export function PhotoThumb({ blob, className }: PhotoThumbProps) {
  const url = useSafeObjectUrl(blob)

  if (!url) {
    return (
      <div
        className={`flex h-full w-full items-center justify-center bg-wr-taupe-200 p-1 text-center font-body text-[11px] text-wr-ink-500 ${className ?? ''}`}
      >
        Photo unavailable
      </div>
    )
  }

  return <img src={url} alt="Site photo" className={`h-full w-full object-cover ${className ?? ''}`} />
}
