import { useEffect, useMemo } from 'react'

interface PhotoThumbProps {
  blob: Blob
  className?: string
}

/**
 * Renders a Blob via an object URL. The URL is created during render (memoized
 * on the blob's identity, so it isn't recreated every render) and only ever
 * revoked in an effect's cleanup — never re-derived through setState there.
 */
export function PhotoThumb({ blob, className }: PhotoThumbProps) {
  const url = useMemo(() => URL.createObjectURL(blob), [blob])
  useEffect(() => () => URL.revokeObjectURL(url), [url])

  return <img src={url} alt="Site photo" className={`object-cover ${className ?? ''}`} />
}
