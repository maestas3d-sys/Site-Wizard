import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from './ui/Button'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Last-resort safety net: an uncaught error anywhere below this unmounts
 * only this subtree instead of the whole app going blank (React's default
 * for an error during render). One bad record shouldn't cost access to
 * every other project/visit/item on the device — reloading re-mounts fresh
 * and, for a transient render error, is often enough on its own; a page
 * whose crash is caused by the SAME bad data every time will still show
 * this screen again rather than a blank one, which at least tells the
 * engineer something is wrong instead of looking like the app is broken.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled error rendering the app:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-wr-paper p-6 text-center">
        <p className="font-heading text-xl font-semibold text-wr-blue-900">Something went wrong</p>
        <p className="max-w-xs text-sm text-wr-ink-500">
          This screen couldn't be displayed. Your other projects and visits are unaffected.
        </p>
        {/* Plain text, not collapsed behind a toggle — this is a field app;
            the fastest way to get a fix is the engineer reading this back
            over the phone, not digging through a browser console. */}
        <p className="max-w-xs break-words rounded border border-wr-taupe-200 bg-white p-2.5 font-mono text-xs text-wr-ink-500">
          {this.state.error.message || String(this.state.error)}
        </p>
        <Button
          onClick={() => {
            // Reloading alone could land right back on the same crashed
            // route (HashRouter keeps the URL hash across a reload) — sending
            // the hash to the Projects list first means recovery actually
            // goes somewhere that isn't the page that just crashed.
            window.location.hash = '#/'
            window.location.reload()
          }}
          className="min-h-12 px-6"
        >
          Back to Projects
        </Button>
      </div>
    )
  }
}
