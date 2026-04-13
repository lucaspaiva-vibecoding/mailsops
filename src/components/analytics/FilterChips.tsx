interface FilterChipsProps {
  options: { value: string | null; label: string }[]
  activeValue: string | null
  onChange: (value: string | null) => void
}

export function FilterChips({ options, activeValue, onChange }: FilterChipsProps) {
  return (
    <div className="flex items-center gap-2">
      {options.map((option) => {
        const isActive = option.value === activeValue
        return (
          <button
            key={option.value ?? 'all'}
            className={
              isActive
                ? 'px-3 h-8 rounded-lg text-xs font-semibold bg-indigo-600/20 text-indigo-400 border border-indigo-600/30'
                : 'px-3 h-8 rounded-lg text-xs font-semibold text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors'
            }
            onClick={() => onChange(option.value === activeValue ? null : option.value)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
