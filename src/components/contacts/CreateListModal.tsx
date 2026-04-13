import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { ColorPicker } from './ColorPicker'
import { useContactLists } from '../../hooks/contacts/useContactLists'
import { useToast } from '../ui/Toast'

interface CreateListModalProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

const DEFAULT_COLOR = '#6366f1'

export function CreateListModal({ open, onClose, onCreated }: CreateListModalProps) {
  const { createList } = useContactLists()
  const { showToast } = useToast()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState<string>(DEFAULT_COLOR)
  const [nameError, setNameError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  if (!open) return null

  const handleClose = () => {
    setName('')
    setDescription('')
    setColor(DEFAULT_COLOR)
    setNameError(null)
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setNameError('List name is required.')
      return
    }
    setNameError(null)
    setCreating(true)
    const { error } = await createList(name.trim(), description.trim() || null, color)
    setCreating(false)
    if (error) {
      showToast(error, 'error')
    } else {
      showToast('List created.', 'success')
      handleClose()
      onCreated()
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-base font-semibold text-gray-100">New List</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-4 flex flex-col gap-4">
            <Input
              label="List name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={nameError ?? undefined}
              placeholder="e.g. Newsletter subscribers"
              autoFocus
            />
            <Input
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-300">Color</span>
              <ColorPicker value={color} onChange={setColor} />
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 p-4 border-t border-gray-800">
            <Button type="button" variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={creating}>
              Create List
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
