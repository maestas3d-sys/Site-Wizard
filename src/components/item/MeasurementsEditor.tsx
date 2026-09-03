import type { Measurement } from '../../types/item'
import { Button } from '../ui/Button'

interface MeasurementsEditorProps {
  measurements: Measurement[]
  onChange: (next: Measurement[]) => void
}

/** Optional add-row measurements — stored as {label, value, unit}, never free text. */
export function MeasurementsEditor({ measurements, onChange }: MeasurementsEditorProps) {
  function addRow() {
    onChange([...measurements, { label: '', value: '', unit: '' }])
  }

  function updateRow(index: number, patch: Partial<Measurement>) {
    onChange(measurements.map((m, i) => (i === index ? { ...m, ...patch } : m)))
  }

  function removeRow(index: number) {
    onChange(measurements.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2">
      {measurements.map((m, index) => (
        <div key={index} className="flex gap-2">
          <input
            className="min-w-0 flex-[2] rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="crack width"
            value={m.label}
            onChange={(e) => updateRow(index, { label: e.target.value })}
          />
          <input
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="0.020"
            value={m.value}
            onChange={(e) => updateRow(index, { value: e.target.value })}
          />
          <input
            className="w-16 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="in"
            value={m.unit}
            onChange={(e) => updateRow(index, { unit: e.target.value })}
          />
          <button
            type="button"
            onClick={() => removeRow(index)}
            className="px-2 text-slate-400 hover:text-red-600"
            aria-label="Remove measurement"
          >
            ×
          </button>
        </div>
      ))}
      <Button variant="secondary" onClick={addRow} className="min-h-10 px-3 py-2 text-sm">
        + Measurement
      </Button>
    </div>
  )
}
