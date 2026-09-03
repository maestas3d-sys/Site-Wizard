import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from './ui/Button'

/**
 * Registers the service worker and surfaces its two states the brief cares
 * about: "safe to lose signal now" (offlineReady) and "a new version is
 * cached, refresh to pick it up" (needRefresh) — never auto-reloads out
 * from under an engineer mid-visit.
 */
export function PwaStatus() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(url) {
      console.log('Service worker registered:', url)
    },
    onRegisterError(error) {
      console.error('Service worker registration failed:', error)
    },
  })

  if (!offlineReady && !needRefresh) return null

  return (
    // A full-width bar collides somewhere on every page: pinned to the
    // bottom it sits on top of Item Capture's sticky Save buttons; pinned
    // to the top it covers the page header's own title/actions row. A
    // small corner card, sized to its content rather than spanning the
    // screen, can't land on either.
    <div className="fixed bottom-24 right-4 z-50 flex max-w-xs items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
      {needRefresh ? (
        <>
          <p className="flex-1 text-sm text-slate-700">An update is ready.</p>
          <Button onClick={() => updateServiceWorker(true)} className="min-h-9 px-3 py-1.5 text-sm">
            Reload
          </Button>
          <button
            type="button"
            onClick={() => setNeedRefresh(false)}
            className="px-1 text-slate-400 hover:text-slate-600"
            aria-label="Dismiss"
          >
            ×
          </button>
        </>
      ) : (
        <>
          <p className="flex-1 text-sm text-slate-700">Ready to work offline.</p>
          <button
            type="button"
            onClick={() => setOfflineReady(false)}
            className="px-1 text-slate-400 hover:text-slate-600"
            aria-label="Dismiss"
          >
            ×
          </button>
        </>
      )}
    </div>
  )
}
