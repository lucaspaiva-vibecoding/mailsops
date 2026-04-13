import { useState, useRef, useEffect } from 'react'
import { Editor } from '@tiptap/react'
import { Variable } from 'lucide-react'
import { Button } from '../ui/Button'

interface VariableDropdownProps {
  editor: Editor
}

export const VARIABLES = [
  { label: 'First name', value: 'first_name' },
  { label: 'Last name', value: 'last_name' },
  { label: 'Company', value: 'company' },
]

export function VariableDropdown({ editor }: VariableDropdownProps) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const handleInsert = (variableName: string) => {
    editor.chain().focus().insertVariable(variableName).run()
    setOpen(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="sm"
        type="button"
        className="flex items-center gap-1 px-2 h-8 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
        onClick={() => setOpen(!open)}
      >
        <Variable size={16} />
        <span className="text-sm">Variable</span>
      </Button>
      {open && (
        <div
          role="listbox"
          className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-2 z-20 min-w-[180px]"
        >
          {VARIABLES.map((v) => (
            <button
              key={v.value}
              role="option"
              type="button"
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 rounded-md cursor-pointer w-full text-left"
              onClick={() => handleInsert(v.value)}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
