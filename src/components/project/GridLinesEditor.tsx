import { useState } from 'react'
import { formatGridLine, parseGridLine } from '../../lib/grid'
import { TextField } from '../ui/Field'

interface GridLinesEditorProps {
  gridLetters: string[]
  gridNumbers: string[]
  onChange: (next: { gridLetters: string[]; gridNumbers: string[] }) => void
}

/**
 * Comma-separated entry for the letter and number grid lines that power the
 * two-tap grid-reference picker in Item Capture. Raw text is kept local so
 * typing "A, B, C" doesn't get reformatted mid-keystroke; parsed arrays are
 * only pushed up to the project draft on blur.
 *
 * Assumes it's mounted with real initial values already in hand (the parent
 * form only renders once project data has loaded) — there's no prop-change
 * resync here on purpose.
 */
export function GridLinesEditor({ gridLetters, gridNumbers, onChange }: GridLinesEditorProps) {
  const [lettersText, setLettersText] = useState(() => formatGridLine(gridLetters))
  const [numbersText, setNumbersText] = useState(() => formatGridLine(gridNumbers))

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Letter lines"
          hint='Comma-separated, in order — e.g. "A, B, C, D"'
          value={lettersText}
          onChange={(e) => setLettersText(e.target.value)}
          onBlur={() => onChange({ gridLetters: parseGridLine(lettersText), gridNumbers })}
          placeholder="A, B, C, D"
        />
        <TextField
          label="Number lines"
          hint='Comma-separated, in order — e.g. "1, 2, 3, 4, 5, 6"'
          value={numbersText}
          onChange={(e) => setNumbersText(e.target.value)}
          onBlur={() => onChange({ gridLetters, gridNumbers: parseGridLine(numbersText) })}
          placeholder="1, 2, 3, 4, 5, 6"
        />
      </div>

      {/*
        Always mounted at a fixed height, never conditionally shown or left
        to grow with the chip count: either kind of size change lands right
        on blur (i.e. exactly when a tap lands on whatever control comes
        next) and shifts the layout mid-tap — the classic Safari
        touchstart/touchend-target-moved dead zone that can eat that tap.
      */}
      <div>
        <span className="mb-1 block text-xs font-semibold text-slate-500">Grid picker preview</span>
        <div className="flex h-20 flex-wrap content-start items-start gap-1.5 overflow-y-auto rounded-md border border-slate-100 p-1.5">
          {gridLetters.length === 0 || gridNumbers.length === 0 ? (
            <span className="text-xs text-slate-400">
              Enter both letter and number lines to preview grid references.
            </span>
          ) : (
            gridNumbers.map((n) =>
              gridLetters.map((l) => (
                <span
                  key={`${n}-${l}`}
                  className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600"
                >
                  {n}-{l}
                </span>
              )),
            )
          )}
        </div>
      </div>
    </div>
  )
}
