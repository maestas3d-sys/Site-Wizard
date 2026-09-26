import { ITEM_TYPES } from '../../lib/itemTypes'
import type { ItemType } from '../../types/item'

interface ItemTypeChipsProps {
  value: ItemType
  onChange: (value: ItemType) => void
}

/** 2-column grid, large enough for a gloved thumb. Selected fills with the
 * type's own color and a matching 2px border; unselected stays a plain
 * outline so the grid doesn't compete with the photos/observation above it. */
export function ItemTypeChips({ value, onChange }: ItemTypeChipsProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {ITEM_TYPES.map((type) => {
        const selected = type.value === value
        return (
          <button
            key={type.value}
            type="button"
            onClick={() => onChange(type.value)}
            style={
              selected
                ? { background: type.bg, color: type.text, border: `2px solid ${type.text}` }
                : { background: '#fff', color: '#6B7477', border: '1px solid #DCD8CA' }
            }
            className="min-h-12 rounded font-body text-sm font-semibold"
          >
            {type.label}
          </button>
        )
      })}
    </div>
  )
}
