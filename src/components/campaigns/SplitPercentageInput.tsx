interface SplitPercentageInputProps {
  value: number
  onChange: (value: number) => void
}

export function SplitPercentageInput({ value, onChange }: SplitPercentageInputProps) {
  const halfPct = value / 2
  const holdBackPct = 100 - value
  const isValid = value >= 8 && value <= 90

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-gray-300">Test group size</label>
      <div className="flex items-center gap-3">
        <input
          type="number"
          min={8}
          max={90}
          step={2}
          value={value}
          onChange={(e) => {
            const num = parseInt(e.target.value, 10)
            if (!isNaN(num)) onChange(num)
          }}
          className={`w-24 bg-gray-800 border text-gray-100 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
            isValid ? 'border-gray-700' : 'border-red-500'
          }`}
        />
        <span className="text-sm text-gray-400">%</span>
      </div>
      {isValid ? (
        <p className="text-sm text-gray-400">
          Variant A: {halfPct}% &middot; Variant B: {halfPct}% &middot; Hold-back: {holdBackPct}%
        </p>
      ) : (
        <p className="text-sm text-red-400">
          Test group must be between 8% and 90%
        </p>
      )}
    </div>
  )
}
