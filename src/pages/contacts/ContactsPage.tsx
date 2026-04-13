import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { ListsGrid } from '../../components/contacts/ListsGrid'
import { ContactsFilters } from '../../components/contacts/ContactsFilters'
import { ContactsTable } from '../../components/contacts/ContactsTable'
import { ContactDrawer } from '../../components/contacts/ContactDrawer'
import { ImportWizardModal } from '../../components/contacts/ImportWizardModal'
import { ImportHistoryModal } from '../../components/contacts/ImportHistoryModal'
import { useContactLists } from '../../hooks/contacts/useContactLists'
import { useContacts } from '../../hooks/contacts/useContacts'
import type { Contact } from '../../types/database'
import type { ContactFilters } from '../../hooks/contacts/useContacts'

type ActiveTab = 'contacts' | 'lists'

export function ContactsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<ActiveTab>('contacts')
  const [filters, setFilters] = useState<ContactFilters>({})
  const [page, setPage] = useState(1)
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [showNewContact, setShowNewContact] = useState(false)
  const [showImportWizard, setShowImportWizard] = useState(false)
  const [showImportHistory, setShowImportHistory] = useState(false)

  const activeListId = searchParams.get('list')

  const { lists, loading: listsLoading, refetch: refetchLists } = useContactLists()

  const activeList = activeListId ? lists.find((l) => l.id === activeListId) : null

  const effectiveTab: ActiveTab = activeListId ? 'lists' : activeTab

  // Build effective filters (merge page and listId)
  const effectiveFilters: ContactFilters = {
    ...filters,
    page,
    pageSize: 50,
    ...(activeListId ? { listId: activeListId } : {}),
  }

  const { contacts, loading: contactsLoading, totalCount, refetch: refetchContacts } = useContacts(effectiveFilters)

  const hasFilters = !!(filters.search || filters.status || filters.tag || filters.customFieldKey)

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

  const handleFiltersChange = (newFilters: ContactFilters) => {
    setFilters(newFilters)
    setPage(newFilters.page ?? 1)
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
  }

  const handleContactClick = (contact: Contact) => {
    setSelectedContact(contact)
    setShowNewContact(false)
  }

  const handleAddContact = () => {
    setSelectedContact(null)
    setShowNewContact(true)
  }

  const handleDrawerClose = () => {
    setSelectedContact(null)
    setShowNewContact(false)
  }

  const handleDrawerUpdated = () => {
    refetchContacts()
    refetchLists()
  }

  const handleDrawerDeleted = () => {
    refetchContacts()
    setPage(1)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-semibold text-gray-100">Contacts</h2>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowImportHistory(true)}>
            View import history
          </Button>
          <Button variant="secondary" onClick={handleAddContact}>
            Add Contact
          </Button>
          <Button variant="primary" onClick={() => setShowImportWizard(true)}>
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
      ) : (
        <div className="flex flex-col gap-0">
          {/* Breadcrumb strip when filtering by list */}
          {activeListId && (
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
          )}

          <ContactsFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
          />
          <ContactsTable
            contacts={contacts}
            loading={contactsLoading}
            totalCount={totalCount}
            page={page}
            pageSize={50}
            hasFilters={hasFilters}
            onPageChange={handlePageChange}
            onContactClick={handleContactClick}
          />
        </div>
      )}

      {/* Contact Drawer */}
      {(selectedContact !== null || showNewContact) && (
        <ContactDrawer
          contact={selectedContact}
          isNew={showNewContact}
          onClose={handleDrawerClose}
          onUpdated={handleDrawerUpdated}
          onDeleted={handleDrawerDeleted}
        />
      )}

      {/* Import Wizard Modal */}
      <ImportWizardModal
        open={showImportWizard}
        onClose={() => setShowImportWizard(false)}
        onImportComplete={() => {
          refetchContacts()
          setShowImportWizard(false)
        }}
      />

      {/* Import History Modal */}
      <ImportHistoryModal
        open={showImportHistory}
        onClose={() => setShowImportHistory(false)}
      />
    </div>
  )
}
