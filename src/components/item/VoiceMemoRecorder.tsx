import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { PendingAudioNote } from '../../db/audioNotes'
import { formatDuration, pickAudioMimeType, vibrate } from '../../lib/audioRecording'
import { newId } from '../../lib/id'
import { Button } from '../ui/Button'

interface VoiceMemoRecorderProps {
  value: PendingAudioNote | null
  onChange: (next: PendingAudioNote | null) => void
}

const LOCK_DRAG_THRESHOLD_PX = 60
const MIN_RECORDING_SEC = 1

/**
 * Hold-to-record voice memo (§5). Optional throughout — the typed body
 * text field is always the complete path; this is a convenience layered on
 * top, framed as "Dictate note" rather than "Record" since the intended
 * use is describing what the engineer sees, not capturing a conversation.
 * Nothing here is committed to Dexie until the item itself is saved (see
 * db/audioNotes.ts) — `value`/`onChange` are just in-memory state.
 */
export function VoiceMemoRecorder({ value, onChange }: VoiceMemoRecorderProps) {
  const [micUnavailable, setMicUnavailable] = useState(false)
  const [recording, setRecording] = useState(false)
  const [locked, setLocked] = useState(false)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [amplitude, setAmplitude] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef(0)
  const pointerStartYRef = useRef(0)
  const lockedRef = useRef(false)
  const justLockedRef = useRef(false)
  const stoppingRef = useRef(false)

  // Stop everything if the form unmounts mid-recording (navigating away).
  useEffect(() => stopStream, [])

  function stopStream() {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    audioContextRef.current?.close().catch(() => {})
    audioContextRef.current = null
    analyserRef.current = null
  }

  function tick() {
    const analyser = analyserRef.current
    if (analyser) {
      const data = new Uint8Array(analyser.frequencyBinCount)
      analyser.getByteTimeDomainData(data)
      let sumSquares = 0
      for (const sample of data) {
        const normalized = (sample - 128) / 128
        sumSquares += normalized * normalized
      }
      const rms = Math.sqrt(sumSquares / data.length)
      setAmplitude(Math.min(1, rms * 4)) // raw RMS runs small; scale up for a visible meter
    }
    setElapsedSec((Date.now() - startTimeRef.current) / 1000)
    rafRef.current = requestAnimationFrame(tick)
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      if (window.AudioContext) {
        const audioContext = new AudioContext()
        const source = audioContext.createMediaStreamSource(stream)
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 256
        source.connect(analyser)
        audioContextRef.current = audioContext
        analyserRef.current = analyser
      }

      const mimeType = pickAudioMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = handleRecorderStop
      mediaRecorderRef.current = recorder
      recorder.start()

      startTimeRef.current = Date.now()
      setElapsedSec(0)
      setRecording(true)
      setLocked(false)
      lockedRef.current = false
      vibrate(30)
      rafRef.current = requestAnimationFrame(tick)
    } catch (err) {
      // Denied, no device, insecure context, etc. — hide the control and
      // let the rest of the form carry on; never block on this.
      console.warn('Microphone unavailable:', err)
      setMicUnavailable(true)
      stopStream()
    }
  }

  function handleRecorderStop() {
    const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm'
    const blob = new Blob(chunksRef.current, { type: mimeType })
    const durationSec = (Date.now() - startTimeRef.current) / 1000
    stopStream()
    setRecording(false)
    setLocked(false)
    setAmplitude(0)
    stoppingRef.current = false

    if (durationSec < MIN_RECORDING_SEC) {
      return // accidental tap — discard silently, no playback bar
    }
    vibrate(30)
    onChange({ id: newId(), blob, durationSec })
  }

  function stopRecording() {
    if (stoppingRef.current) return
    stoppingRef.current = true
    mediaRecorderRef.current?.stop()
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLButtonElement>) {
    // Already recording (locked, hands-free) — this press is the "tap to
    // stop" gesture, handled entirely by the click handler below. Starting
    // a second recording on top of it would leak a MediaRecorder/stream.
    if (recording) return
    e.currentTarget.setPointerCapture(e.pointerId)
    pointerStartYRef.current = e.clientY
    void startRecording()
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLButtonElement>) {
    if (!recording || lockedRef.current) return
    const draggedUp = pointerStartYRef.current - e.clientY
    if (draggedUp > LOCK_DRAG_THRESHOLD_PX) {
      setLocked(true)
      lockedRef.current = true
      justLockedRef.current = true // swallow the click this same gesture is about to fire
      vibrate([20, 40, 20])
    }
  }

  function handlePointerUp() {
    if (!recording || lockedRef.current) return // locked: keep recording hands-free
    stopRecording()
  }

  // The browser fires a synthesized click right after pointerup/pointerdown
  // on the same element — used here as the "tap to stop" while locked, but
  // guarded so the click that ends the lock-drag gesture itself doesn't
  // immediately stop the recording it just started.
  function handleClick() {
    if (justLockedRef.current) {
      justLockedRef.current = false
      return
    }
    if (recording && lockedRef.current) {
      stopRecording()
    }
  }

  if (micUnavailable && !value) {
    return null
  }

  if (value && !recording) {
    return <PlaybackBar value={value} onReRecord={() => onChange(null)} onDelete={() => onChange(null)} />
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleClick}
        style={{ touchAction: 'none' }}
        className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-2xl shadow-md transition ${
          recording ? 'scale-110 bg-red-600 text-white' : 'border border-slate-300 bg-white text-slate-700'
        }`}
        aria-label="Dictate note — press and hold to record"
      >
        🎙️
      </button>
      <div className="min-w-0 flex-1">
        {recording ? (
          <>
            <div className="flex items-center gap-2">
              <AmplitudeMeter amplitude={amplitude} />
              <span className="font-mono text-sm text-slate-700">{formatDuration(elapsedSec)}</span>
            </div>
            <p className="text-xs text-slate-500">
              {locked ? 'Recording — tap the mic to stop.' : 'Release to stop, or slide up to lock hands-free.'}
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-500">Hold to dictate a note.</p>
        )}
      </div>
    </div>
  )
}

function AmplitudeMeter({ amplitude }: { amplitude: number }) {
  const barWeights = [0.3, 0.6, 1, 0.6, 0.3]
  return (
    <div className="flex h-6 items-end gap-0.5">
      {barWeights.map((weight, i) => (
        <span
          key={i}
          className="w-1 rounded-full bg-red-500 transition-all"
          style={{ height: `${Math.max(15, amplitude * weight * 100)}%` }}
        />
      ))}
    </div>
  )
}

function PlaybackBar({
  value,
  onReRecord,
  onDelete,
}: {
  value: PendingAudioNote
  onReRecord: () => void
  onDelete: () => void
}) {
  const url = useMemo(() => URL.createObjectURL(value.blob), [value.blob])
  useEffect(() => () => URL.revokeObjectURL(url), [url])

  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2">
      <audio controls src={url} className="h-10 flex-1" />
      <span className="text-xs text-slate-500">{formatDuration(value.durationSec)}</span>
      <Button variant="secondary" onClick={onReRecord} className="min-h-9 px-3 py-1.5 text-sm">
        Re-record
      </Button>
      <Button variant="danger" onClick={onDelete} className="min-h-9 px-3 py-1.5 text-sm">
        Delete
      </Button>
    </div>
  )
}
