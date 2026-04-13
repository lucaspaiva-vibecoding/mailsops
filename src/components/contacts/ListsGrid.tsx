import { useState, useRef, useEffect } from 'react'
import { MoreHorizontal, Plus } from 'lucide-react'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Spinner } from '../ui/Spinner'
import { Input } from '../ui/Input'
import { CreateListModal } from './CreateListModal'
import { useContactLists } from '../../hooks/contacts/useContactLists'
import { useToast } from '../ui/Toast'
import type { ContactList } from '../../types/database'

interface ListsGridProps {
  lists: ContactList[]
  loading: boolean
  onListClick: (listId: string) => void
  onRefresh: () => void
}

interface ListCardProps {
  list: ContactList
  onListClick: (listId: string) => void
  onRefresh: () => void
}

function ListCard({ list, onListClick, onRefresh }: ListCardProps) {
  const { updateList, deleteList } = useContactLists()
  const { showToast } = useToast()

  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renamingValue, setRenamingValue] = useState(list.name)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)

  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  const handleRenameStart = () => {
    setRenamingValue(list.name)
    setRenaming(true)
    setMenuOpen(false)
  }

  const handleRenameSave = async () => {
    const trimmed = renamingValue.trim()
    if (!trimmed || trimmed === list.name) {
      setRenaming(false)
      return
    }
    setSaving(true)
    const { error } = await updateList(list.id, { name: trimmed })
    setSaving(false)
    setRenaming(false)
    if (error) {
      showToast(error, 'error')
    } else {
      showToast('List updated.', 'success')
      onRefresh()
    }
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      void handleRenameSave()
    } else if (e.key === 'Escape') {
      setRenaming(false)
    }
  }

  const handleDeleteConfirm = async () => {
    setDeleting(true)
    const { error } = await deleteList(list.id)
    setDeleting(false)
    setConfirmingDelete(false)
    if (error) {
      showToast(error, 'error')
    } else {
      showToast('List deleted.', 'success')
      onRefresh()
    }
  }

  const colorBar = list.color || '#64748b'

  return (
    <div className="relative">
      <Card
        padding="sm"
        className="cursor-pointer hover:border-gray-700 transition-colors border-l-4 rounded-l-lg"
        style={{ borderLeftColor: colorBar }}
        onClick={(e) => {
          // Don't trigger list click when interacting with menu/actions
          if ((e.target as HTMLElement).closest('[data-no-list-click]')) return
          if (renaming || confirmingDelete) return
          onListClick(list.id)
        }}
      >
        {/* Top row: name + options menu */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {renaming ? (
              <Input
                value={renamingValue}
                onChange={(e) => setRenamingValue(e.target.value)}
                onBlur={() => void handleRenameSave()}
                onKeyDown={handleRenameKeyDown}
                disabled={saving}
                autoFocus
                className="text-sm"
                data-no-list-click
              />
            ) : (
              <p className="text-sm font-semibold text-gray-100 truncate">{list.name}</p>
            )}
            {list.description && !renaming && (
              <p className="text-xs text-gray-400 mt-0.5 truncate">{list.description}</p>
            )}
          </div>

          <div className="relative flex-shrink-0" ref={menuRef} data-no-list-click>
            <Button
              variant="ghost"
              size="sm"
              aria-label="List options"
              onClick={() => setMenuOpen((prev) => !prev)}
              className="p-1"
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>

            {menuOpen && (
              <div className="absolute right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg py-1 z-10 min-w-[140px]">
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 cursor-pointer"
                  onClick={handleRenameStart}
                >
                  Rename
                </button>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-700 cursor-pointer"
                  onClick={() => {
                    setConfirmingDelete(true)
                    setMenuOpen(false)
                  }}
                >
                  Delete list
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Contact count */}
        {!renaming && (
          <div className="mt-3">
            <p className="text-xl font-semibold text-gray-100">{list.contact_count}</p>
            <p className="text-xs text-gray-500">contacts</p>
          </div>
        )}

        {/* Delete confirmation */}
        {confirmingDelete && (
          <div className="mt-3 border-t border-gray-700 pt-3" data-no-list-click>
            <p className="text-sm text-gray-300 mb-3">
              Delete &apos;{list.name}&apos;? This will remove the list but not the contacts in it.
            </p>
            <div className="flex gap-2">
              <Button
                variant="danger"
                size="sm"
                loading={deleting}
                onClick={() => void handleDeleteConfirm()}
              >
                Yes, delete list
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

export function ListsGrid({ lists, loading, onListClick, onRefresh }: ListsGridProps) {
  const [createModalOpen, setCreateModalOpen] = useState(false)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="md" />
      </div>
    )
  }

  return (
    <>
      {lists.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <h3 className="text-lg font-semibold text-gray-300">No lists yet</h3>
          <p className="text-sm text-gray-500 mt-1">
            Create a list to organize your contacts for targeting campaigns.
          </p>
          <div className="mt-6">
            <Button variant="primary" onClick={() => setCreateModalOpen(true)}>
              <Plus className="w-4 h-4" />
              New List
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {lists.map((list) => (
            <ListCard
              key={list.id}
              list={list}
              onListClick={onListClick}
              onRefresh={onRefresh}
            />
          ))}

          {/* New List card */}
          <button
            type="button"
            className="border-2 border-dashed border-gray-700 rounded-lg p-4 flex items-center justify-center gap-2 text-gray-400 hover:border-indigo-500 hover:text-indigo-400 cursor-pointer transition-colors"
            onClick={() => setCreateModalOpen(true)}
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">New List</span>
          </button>
        </div>
      )}

      <CreateListModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={() => {
          setCreateModalOpen(false)
          onRefresh()
        }}
      />
    </>
  )
}
