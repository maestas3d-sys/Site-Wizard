import type { Sheet, SheetDetail } from '../../types/project'
import { Button } from '../ui/Button'
import { TextField } from '../ui/Field'

interface SheetIndexEditorProps {
  sheets: Sheet[]
  onChange: (next: Sheet[]) => void
}

/**
 * Manual sheet index entry — tedious, one-time per project, and it's what
 * powers detail-reference autocomplete ("5/S4.1") and validation during
 * item capture, so it's worth doing before heading to the field.
 */
export function SheetIndexEditor({ sheets, onChange }: SheetIndexEditorProps) {
  function addSheet() {
    onChange([...sheets, { sheetNumber: '', documentSet: '', details: [] }])
  }

  function updateSheet(index: number, patch: Partial<Sheet>) {
    onChange(sheets.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  function removeSheet(index: number) {
    onChange(sheets.filter((_, i) => i !== index))
  }

  function addDetail(sheetIndex: number) {
    updateSheet(sheetIndex, { details: [...sheets[sheetIndex].details, { number: '' }] })
  }

  function updateDetail(sheetIndex: number, detailIndex: number, patch: Partial<SheetDetail>) {
    const details = sheets[sheetIndex].details.map((d, i) =>
      i === detailIndex ? { ...d, ...patch } : d,
    )
    updateSheet(sheetIndex, { details })
  }

  function removeDetail(sheetIndex: number, detailIndex: number) {
    updateSheet(sheetIndex, {
      details: sheets[sheetIndex].details.filter((_, i) => i !== detailIndex),
    })
  }

  return (
    <div className="space-y-4">
      {sheets.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
          No sheets yet. Add one for every drawing you'll reference in the field — it powers
          detail-reference autocomplete during item capture.
        </p>
      )}

      {sheets.map((sheet, sheetIndex) => (
        <div key={sheetIndex} className="rounded-lg border border-slate-200 p-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
            <TextField
              label="Sheet #"
              value={sheet.sheetNumber}
              onChange={(e) => updateSheet(sheetIndex, { sheetNumber: e.target.value })}
              placeholder="S4.1"
            />
            <TextField
              label="Title"
              value={sheet.title ?? ''}
              onChange={(e) => updateSheet(sheetIndex, { title: e.target.value })}
              placeholder="Framing Details"
            />
            <TextField
              label="Document set"
              value={sheet.documentSet}
              onChange={(e) => updateSheet(sheetIndex, { documentSet: e.target.value })}
              placeholder="Permit Set"
            />
            <Button variant="danger" onClick={() => removeSheet(sheetIndex)}>
              Remove
            </Button>
          </div>

          <div className="mt-3">
            <span className="mb-1 block text-xs font-semibold text-slate-500">
              Details on this sheet
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {sheet.details.map((detail, detailIndex) => (
                <div
                  key={detailIndex}
                  className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1"
                >
                  <input
                    className="w-10 bg-transparent text-sm font-medium text-slate-700 focus:outline-none"
                    value={detail.number}
                    onChange={(e) =>
                      updateDetail(sheetIndex, detailIndex, { number: e.target.value })
                    }
                    placeholder="5"
                  />
                  <input
                    className="w-32 bg-transparent text-sm text-slate-500 focus:outline-none"
                    value={detail.title ?? ''}
                    onChange={(e) =>
                      updateDetail(sheetIndex, detailIndex, { title: e.target.value })
                    }
                    placeholder="title (optional)"
                  />
                  <button
                    type="button"
                    onClick={() => removeDetail(sheetIndex, detailIndex)}
                    className="text-slate-400 hover:text-red-600"
                    aria-label="Remove detail"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addDetail(sheetIndex)}
                className="rounded-md border border-dashed border-slate-300 px-2 py-1 text-sm text-slate-500 hover:border-slate-400"
              >
                + Detail
              </button>
            </div>
          </div>
        </div>
      ))}

      <Button variant="secondary" onClick={addSheet}>
        + Add sheet
      </Button>
    </div>
  )
}
