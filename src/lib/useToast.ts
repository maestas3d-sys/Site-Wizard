import { useEffect, useRef, useState } from 'react'

const TOAST_DURATION_MS = 2600

/** Transient top-of-screen confirmations ("Item #3 saved", "Changed to
 * Acceptable") — each page that needs one calls this and renders <Toast/>
 * with the result; auto-dismisses after 2.6s (design handoff, "Toast"). */
export function useToast() {
  const [text, setText] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    [],
  )

  function showToast(message: string) {
    setText(message)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setText(null), TOAST_DURATION_MS)
  }

  return { toastText: text, showToast }
}
