// ISO date-only strings ("2026-09-03") parse as UTC midnight if handed to
// `new Date()` directly, which reads back as the previous day in any zone
// west of UTC — append a local time to force local-time parsing instead.
function parseLocalDate(iso: string): Date {
  return new Date(`${iso}T00:00:00`)
}

function ordinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th'
  switch (day % 10) {
    case 1:
      return 'st'
    case 2:
      return 'nd'
    case 3:
      return 'rd'
    default:
      return 'th'
  }
}

/** "June 4, 2024" — the DATE: field format. */
export function formatReportDate(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

/** "Tuesday, September 30th, 2025" — used in the opening sentence. */
export function formatVisitDateLong(iso: string): string {
  const date = parseLocalDate(iso)
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' })
  const month = date.toLocaleDateString('en-US', { month: 'long' })
  const day = date.getDate()
  const year = date.getFullYear()
  return `${weekday}, ${month} ${day}${ordinalSuffix(day)}, ${year}`
}
