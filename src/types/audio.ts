export interface AudioNote {
  id: string
  itemId: string
  blob: Blob // audio/webm;codecs=opus, or audio/mp4 on Safari
  durationSec: number
  createdAt: number
}
