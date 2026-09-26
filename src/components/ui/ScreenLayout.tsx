import type { ReactNode } from 'react'

interface ScreenLayoutProps {
  appBar: ReactNode
  children: ReactNode
  footer?: ReactNode
}

/**
 * The shared shell every new-design screen but Projects/Project uses: an
 * app bar, normally-flowing scrollable content (this page scrolls with the
 * rest of the document, same as every other page here — no simulated
 * internal scroll region), and — when there's one — a footer pinned to the
 * true bottom of the screen via `position: fixed`, not a flexbox trick,
 * with its own safe-area-bottom padding since fixed positioning escapes
 * body's normal-flow safe-area padding. This is the same pattern already
 * proven on Item Capture's footer (see git history) rather than the
 * fixed-height flex-column the design's own HTML prototype used — that
 * prototype was simulating a phone frame inside a desktop browser tab,
 * a problem this real, full-page mobile app doesn't have.
 */
export function ScreenLayout({ appBar, children, footer }: ScreenLayoutProps) {
  return (
    <div className={footer ? 'pb-28' : ''}>
      {appBar}
      {children}
      {footer && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-wr-taupe-200 bg-wr-paper">
          <div
            className="flex gap-2.5 p-4"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          >
            {footer}
          </div>
        </div>
      )}
    </div>
  )
}
