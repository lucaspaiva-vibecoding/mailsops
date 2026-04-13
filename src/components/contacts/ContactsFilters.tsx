import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import type { ContactFilters } from '../../hooks/contacts/useContacts'

interface ContactsFiltersProps {
  filters: ContactFilters
  onFiltersChange: (filters: ContactFilters) => void
}

export function ContactsFilters({ filters, onFiltersChange }: ContactsFiltersProps) {
  const [search, setSearch] = useState(filters.search ?? '')
  const [tag, setTag] = useState(filters.tag ?? '')
  const [customFieldKey, setCustomFieldKey] = useState(filters.customFieldKey ?? '')
  const [customFieldValue, setCustomFieldValue] = useState(filters.customFieldValue ?? '')

  // Debounce all text filter fields together to avoid stale closure merging issues
  useEffect(() => {
    const timer = setTimeout(() => {
      onFiltersChange({
        ...filters,
        search: search || undefined,
        tag: tag || undefined,
        customFieldKey: customFieldKey || undefined,
        customFieldValue: customFieldValue || undefined,
        page: 1,
      })
    }, 300)
    return () => clearTimeout(timer)
  }, [search, tag, customFieldKey, customFieldValue]) // eslint-disable-line react-hooks/exhaustive-deps

  const hasActiveFilters = !!(search || filters.status || tag || customFieldKey)

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFiltersChange({ ...filters, status: e.target.value || undefined, page: 1 })
  }

  const handleClearFilters = () => {
    setSearch('')
    setTag('')
    setCustomFieldKey('')
    setCustomFieldValue('')
    onFiltersChange({})
  }

  return (
    <div className="flex flex-wrap gap-3 items-center mb-4">
      <Input
        icon={<Search size={16} />}
        placeholder="Search contacts..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-64"
      />

      <select
        value={filters.status ?? ''}
        onChange={handleStatusChange}
        className="bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <option value="">All statuses</option>
        <option value="active">Active</option>
        <option value="unsubscribed">Unsubscribed</option>
        <option value="bounced">Bounced</option>
        <option value="complained">Complained</option>
      </select>

      <Input
        placeholder="Filter by tag..."
        value={tag}
        onChange={(e) => setTag(e.target.value)}
        className="w-40"
      />

      <Input
        placeholder="Field name"
        value={customFieldKey}
        onChange={(e) => setCustomFieldKey(e.target.value)}
        className="w-32"
      />

      <Input
        placeholder="Field value"
        value={customFieldValue}
        onChange={(e) => setCustomFieldValue(e.target.value)}
        className="w-32"
      />

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={handleClearFilters}>
          Clear filters
        </Button>
      )}
    </div>
  )
}
