interface VariantTabStripProps {
  activeTab: 'A' | 'B'
  onTabChange: (tab: 'A' | 'B') => void
}

export function VariantTabStrip({ activeTab, onTabChange }: VariantTabStripProps) {
  return (
    <div className="border-b border-gray-800 flex gap-6 mb-6" role="tablist">
      {(['A', 'B'] as const).map((tab) => (
        <button
          key={tab}
          role="tab"
          aria-selected={activeTab === tab}
          type="button"
          onClick={() => onTabChange(tab)}
          className={`pb-3 text-sm font-medium border-b-2 ${
            activeTab === tab
              ? 'text-gray-100 border-indigo-500'
              : 'text-gray-400 border-transparent hover:text-gray-200'
          }`}
        >
          Variant {tab}
        </button>
      ))}
    </div>
  )
}
