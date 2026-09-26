import { useState } from 'react'
import { useSafeObjectUrl } from '../../lib/useSafeObjectUrl'

interface PhotoThumbProps {
  blob: Blob
  className?: string
}

function Unavailable({ className }: { className?: string }) {
  return (
    <div
      className={`flex h-full w-full items-center justify-center bg-wr-taupe-200 p-1 text-center font-body text-[11px] text-wr-ink-500 ${className ?? ''}`}
    >
      Photo unavailable
    </div>
  )
}

/**
 * Renders a Blob via an object URL. The URL is created during render (memoized
 * on the blob's identity, so it isn't recreated every render) and only ever
 * revoked in an effect's cleanup — never re-derived through setState there.
 * Two independent failure modes render the same placeholder instead of
 * crashing or showing a raw broken-image icon: `blob` itself isn't a real
 * Blob (missing/corrupt data, e.g. from an older schema version — caught by
 * useSafeObjectUrl), or it IS a real Blob but the browser can't decode its
 * bytes as an image (truncated/corrupt image data — only the <img> element's
 * own decoder can detect this, via onError).
 */
export function PhotoThumb({ blob, className }: PhotoThumbProps) {
  const url = useSafeObjectUrl(blob)
  const [decodeFailed, setDecodeFailed] = useState(false)
  // Reset the failure flag when the blob changes to a different one, without
  // an effect-based cascade — adjusting state during render, as React docs
  // recommend for "reset on prop change" (matches useImageDimensions.ts's
  // own no-effect-reset reasoning next door).
  const [lastUrl, setLastUrl] = useState(url)
  if (url !== lastUrl) {
    setLastUrl(url)
    setDecodeFailed(false)
  }

  if (!url || decodeFailed) {
    return <Unavailable className={className} />
  }

  return (
    <img
      src={url}
      alt="Site photo"
      className={`h-full w-full object-cover ${className ?? ''}`}
      onError={() => setDecodeFailed(true)}
    />
  )
}
