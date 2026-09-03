import type { Attendee } from '../../types/visit'
import { Button } from '../ui/Button'

interface AttendeesEditorProps {
  attendees: Attendee[]
  onChange: (next: Attendee[]) => void
}

/** Add-row name/firm list — renders as the PRESENT: block on the generated report. */
export function AttendeesEditor({ attendees, onChange }: AttendeesEditorProps) {
  function addRow() {
    onChange([...attendees, { name: '', firm: '' }])
  }

  function updateRow(index: number, patch: Partial<Attendee>) {
    onChange(attendees.map((a, i) => (i === index ? { ...a, ...patch } : a)))
  }

  function removeRow(index: number) {
    onChange(attendees.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2">
      {attendees.length === 0 && (
        <p className="text-sm text-slate-400">No attendees added yet.</p>
      )}
      {attendees.map((a, index) => (
        <div key={index} className="flex gap-2">
          <input
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Name"
            value={a.name}
            onChange={(e) => updateRow(index, { name: e.target.value })}
          />
          <input
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Firm"
            value={a.firm}
            onChange={(e) => updateRow(index, { firm: e.target.value })}
          />
          <button
            type="button"
            onClick={() => removeRow(index)}
            className="px-2 text-slate-400 hover:text-red-600"
            aria-label="Remove attendee"
          >
            ×
          </button>
        </div>
      ))}
      <Button variant="secondary" onClick={addRow} className="min-h-10 px-3 py-2 text-sm">
        + Attendee
      </Button>
    </div>
  )
}
