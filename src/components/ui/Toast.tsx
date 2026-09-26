interface ToastProps {
  text: string | null
}

/** Fixed to the viewport, not the nearest positioned ancestor — this app's
 * viewport *is* the phone, so "always on top regardless of scroll" is what
 * the design's phone-frame-relative "position: absolute" meant in practice. */
export function Toast({ text }: ToastProps) {
  if (!text) return null
  return (
    <div
      className="fixed left-4 right-4 top-6 z-30 rounded bg-wr-ink-900 px-3.5 py-3 text-sm leading-tight text-white shadow-[0_6px_16px_rgba(0,0,0,.25)]"
      role="status"
    >
      {text}
    </div>
  )
}
