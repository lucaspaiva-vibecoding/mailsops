const COLORS = [
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Slate', value: '#64748b' },
]

interface ColorPickerProps {
  value: string | null
  onChange: (color: string) => void
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label="List color">
      {COLORS.map((color) => {
        const selected = value === color.value
        return (
          <button
            key={color.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={color.name}
            className={`w-7 h-7 rounded-full border-2 cursor-pointer transition-colors ${
              selected ? 'border-white' : 'border-transparent'
            }`}
            style={{ backgroundColor: color.value }}
            onClick={() => onChange(color.value)}
          />
        )
      })}
    </div>
  )
}
