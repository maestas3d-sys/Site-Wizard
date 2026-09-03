/**
 * MediaRecorder mime type, feature-detected rather than assumed — Chrome
 * and Firefox support opus-in-webm, Safari doesn't and needs mp4 instead.
 * Returns undefined to let the browser pick its own default as a last
 * resort, which MediaRecorder accepts fine.
 */
export function pickAudioMimeType(): string | undefined {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(type)) {
      return type
    }
  }
  return undefined
}

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds))
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}

/** A pulse the field engineer can feel through gloves — a no-op where unsupported (most desktops). */
export function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // Vibration API can throw in some embedded/iframe contexts — never let it break recording.
  }
}
