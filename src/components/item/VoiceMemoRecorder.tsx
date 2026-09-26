import { useEffect, useMemo } from 'react'
import type { PendingAudioNote } from '../../db/audioNotes'
import { formatDuration } from '../../lib/audioRecording'
import type { VoiceMemoState } from '../../lib/useVoiceMemo'

/**
 * Hold-to-record voice memo (§5) — split into two pieces the caller places
 * independently (Item Capture puts the mic inside the body-text field and
 * the memo row below it), both driven by one `useVoiceMemo` instance so
 * there's a single recorder rather than each piece opening its own.
 * Optional throughout: the typed body text is always the complete path on
 * its own, and the mic control hides entirely (not disabled) if there's no
 * existing memo and the mic turns out to be unavailable, rather than
 * blocking the rest of the form on it.
 */
export function VoiceMemoMicControl({ voice, hasMemo }: { voice: VoiceMemoState; hasMemo: boolean }) {
  if (voice.micUnavailable && !hasMemo) return null

  return (
    <div className="flex items-center gap-2.5">
      <button
        type="button"
        onPointerDown={voice.handlePointerDown}
        onPointerMove={voice.handlePointerMove}
        onPointerUp={voice.handlePointerUp}
        onClick={voice.handleClick}
        style={{ touchAction: 'none', background: voice.recording ? '#A13D33' : '#59462A' }}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-body text-[11px] font-semibold text-white"
        aria-label="Dictate note — press and hold to record"
      >
        MIC
      </button>
      <span className="text-[13px]" style={{ color: voice.recording ? '#A13D33' : '#6B7477' }}>
        {voice.statusText}
      </span>
    </div>
  )
}

export function VoiceMemoPlaybackRow({ value, onDelete }: { value: PendingAudioNote; onDelete: () => void }) {
  const url = useMemo(() => URL.createObjectURL(value.blob), [value.blob])
  useEffect(() => () => URL.revokeObjectURL(url), [url])

  return (
    <div className="flex flex-col gap-1.5 rounded border border-wr-taupe-200 bg-white p-2 pl-3">
      <div className="flex items-center gap-2.5">
        <span className="h-2.5 w-2.5 flex-none rounded-full bg-wr-brown-700" />
        <span className="flex-1 text-sm text-wr-ink-900">Voice memo · {formatDuration(value.durationSec)}</span>
        <button
          type="button"
          onClick={onDelete}
          className="min-h-9 rounded border border-wr-danger px-3 font-body text-[13px] font-semibold text-wr-danger"
        >
          Delete
        </button>
      </div>
      <audio controls src={url} className="h-8 w-full" />
    </div>
  )
}
