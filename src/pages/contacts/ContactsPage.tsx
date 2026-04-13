import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { ListsGrid } from '../../components/contacts/ListsGrid'
import { useContactLists } from '../../hooks/contacts/useContactLists'

type ActiveTab = 'contacts' | 'lists'

export function ContactsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<ActiveTab>('contacts')

  const activeListId = searchParams.get('list')

  const { lists, loading: listsLoading, refetch: refetchLists } = useContactLists()

  const activeList = activeListId ? lists.find((l) => l.id === activeListId) : null

  const effectiveTab: ActiveTab = activeListId ? 'lists' : activeTab

  const handleTabChange = (tab: ActiveTab) => {
    if (tab === 'contacts') {
      setSearchParams({})
    }
    setActiveTab(tab)
  }

  const handleListClick = (listId: string) => {
    setSearchParams({ list: listId })
  }

  const handleClearList = () => {
    setSearchParams({})
    setActiveTab('contacts')
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-semibold text-gray-100">Contacts</h2>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => {}}>
            View import history
          </Button>
          <Button variant="secondary" onClick={() => {}}>
            Add Contact
          </Button>
          <Button variant="primary" onClick={() => {}}>
            Import Contacts
          </Button>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex items-center border-b border-gray-800">
        <button
          className={`px-4 py-2 text-sm font-medium transition-colors duration-150 border-b-2 -mb-px ${
            effectiveTab === 'contacts'
              ? 'text-indigo-400 border-b-2 border-indigo-500'
              : 'text-gray-400 hover:text-gray-200 border-transparent'
          }`}
          onClick={() => handleTabChange('contacts')}
        >
          All Contacts
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium transition-colors duration-150 border-b-2 -mb-px ${
            effectiveTab === 'lists'
              ? 'text-indigo-400 border-b-2 border-indigo-500'
              : 'text-gray-400 hover:text-gray-200 border-transparent'
          }`}
          onClick={() => handleTabChange('lists')}
        >
          Lists
        </button>
      </div>

      {/* Tab content */}
      {effectiveTab === 'lists' ? (
        <ListsGrid
          lists={lists}
          loading={listsLoading}
          onListClick={handleListClick}
          onRefresh={refetchLists}
        />
      ) : activeListId ? (
        /* Filtered contacts view — breadcrumb + table slot */
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 mb-4 text-sm">
            <button
              className="text-indigo-400 hover:text-indigo-300 cursor-pointer"
              onClick={handleClearList}
            >
              All Contacts
            </button>
            <span className="text-gray-600">/</span>
            {activeList && (
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: activeList.color || '#64748b' }}
              />
            )}
            <span className="text-gray-100 font-semibold">
              {activeList?.name ?? 'Loading...'}
            </span>
          </div>
          <div id="contacts-table-slot">
            <p className="text-gray-500 text-sm">Loading contacts...</p>
          </div>
        </div>
      ) : (
        /* All Contacts tab — placeholder filled by Plan 04 */
        <div id="contacts-table-slot">
          <p className="text-gray-500 text-sm">Loading contacts...</p>
        </div>
      )}
    </div>
  )
}
