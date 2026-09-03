import { ITEM_TYPES } from '../../lib/itemTypes'
import type { ItemType } from '../../types/item'

interface ItemTypeChipsProps {
  value: ItemType
  onChange: (value: ItemType) => void
}

/** Seven single-select chips, large enough for a gloved thumb. */
export function ItemTypeChips({ value, onChange }: ItemTypeChipsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {ITEM_TYPES.map((type) => {
        const selected = type.value === value
        return (
          <button
            key={type.value}
            type="button"
            onClick={() => onChange(type.value)}
            className={`min-h-12 rounded-full px-4 py-2 text-sm font-semibold transition ${
              selected
                ? `${type.colorClasses} ring-2 ring-offset-1 ring-current`
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            {type.label}
          </button>
        )
      })}
    </div>
  )
}
