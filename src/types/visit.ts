export interface Attendee {
  name: string
  firm: string
}

export type VisitStatus = 'draft' | 'complete'

export interface Visit {
  id: string
  projectId: string
  reportNumber: number // 1, 2, 3 — gapless per project
  visitDate: string // ISO date of the site visit
  reportDate: string // ISO date the report is issued
  purpose: string // "review the P/T cables at the tennis courts prior to pouring concrete"
  generalState: string // optional opening context paragraph
  attendees: Attendee[] // → PRESENT block
  engineerName: string // "David Maestas"
  engineerTitle: string // "Principal"
  engineerCredential: string // "SE"
  nextObservation: string // "Prior to pour-strip concrete pour. Tentatively 10/20/25."
  status: VisitStatus
  createdAt: number
}
