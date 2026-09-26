import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { PendingAudioNote } from '../db/audioNotes'
import { newId } from './id'
import { formatDuration, pickAudioMimeType, vibrate } from './audioRecording'

const LOCK_DRAG_THRESHOLD_PX = 60
const MIN_RECORDING_SEC = 1

export interface VoiceMemoState {
  /** True once the mic has been denied/unavailable and there's no existing
   * memo to fall back to showing — the caller should hide the mic control
   * entirely in that case (never block the rest of the form on this). */
  micUnavailable: boolean
  recording: boolean
  locked: boolean
  elapsedSec: number
  /** What the status label next to the mic should say right now. */
  statusText: string
  handlePointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => void
  handlePointerMove: (e: ReactPointerEvent<HTMLButtonElement>) => void
  handlePointerUp: () => void
  handleClick: () => void
}

/**
 * All the hold-to-record logic (§5): press and hold to record, slide up
 * ~60px to lock hands-free, a 1-second minimum (shorter is an accidental
 * tap, discarded silently), and a haptic pulse on start/lock. Framed to the
 * user as "dictate," not "record" — this describes what the engineer sees,
 * not a conversation with others.
 *
 * Split out of the (now purely presentational) VoiceMemoRecorder component
 * so the mic control and the "voice memo saved" row can be positioned
 * independently in the new layout (mic sits inside the body-text field,
 * the memo row sits below it) while still sharing one recorder instance —
 * two separate components each calling this hook would each open their own
 * MediaRecorder.
 */
export function useVoiceMemo(
  value: PendingAudioNote | null,
  onChange: (next: PendingAudioNote | null) => void,
): VoiceMemoState {
  const [micUnavailable, setMicUnavailable] = useState(false)
  const [recording, setRecording] = useState(false)
  const [locked, setLocked] = useState(false)
  const [elapsedSec, setElapsedSec] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef(0)
  const pointerStartYRef = useRef(0)
  const lockedRef = useRef(false)
  const justLockedRef = useRef(false)
  const stoppingRef = useRef(false)

  // Stop everything if the form unmounts mid-recording (navigating away).
  useEffect(() => stopStream, [])

  function stopStream() {
    if (tickTimerRef.current !== null) clearInterval(tickTimerRef.current)
    tickTimerRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

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
      tickTimerRef.current = setInterval(() => {
        setElapsedSec((Date.now() - startTimeRef.current) / 1000)
      }, 200)
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

  const statusText = recording
    ? locked
      ? `Recording ${formatDuration(elapsedSec)} · tap the mic to stop`
      : `Recording ${formatDuration(elapsedSec)} · release to stop`
    : value
      ? 'Hold to re-record'
      : 'Hold to dictate'

  return {
    micUnavailable,
    recording,
    locked,
    elapsedSec,
    statusText,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleClick,
  }
}
