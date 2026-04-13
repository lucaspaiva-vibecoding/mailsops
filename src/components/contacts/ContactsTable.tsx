import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'
import type { Contact } from '../../types/database'

interface ContactsTableProps {
  contacts: Contact[]
  loading: boolean
  totalCount: number
  page: number
  pageSize: number
  hasFilters?: boolean
  onPageChange: (page: number) => void
  onContactClick: (contact: Contact) => void
}

type StatusVariant = 'success' | 'warning' | 'danger' | 'default'

function getStatusVariant(status: Contact['status']): StatusVariant {
  switch (status) {
    case 'active':
      return 'success'
    case 'unsubscribed':
      return 'warning'
    case 'bounced':
      return 'danger'
    case 'complained':
      return 'warning'
    default:
      return 'default'
  }
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 1) return 'Today'
  if (diffDays < 2) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function ContactsTable({
  contacts,
  loading,
  totalCount,
  page,
  pageSize,
  hasFilters = false,
  onPageChange,
  onContactClick,
}: ContactsTableProps) {
  const totalPages = Math.ceil(totalCount / pageSize)

  if (loading) {
    return (
      <Card padding="sm">
        <div className="flex items-center justify-center py-12">
          <Spinner size="md" />
        </div>
      </Card>
    )
  }

  if (contacts.length === 0) {
    return (
      <Card padding="sm">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          {hasFilters ? (
            <>
              <p className="text-lg font-semibold text-gray-300">No contacts found</p>
              <p className="text-sm text-gray-500 mt-1">
                Try adjusting your search or clearing the filters.
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold text-gray-300">No contacts yet</p>
              <p className="text-sm text-gray-500 mt-1">
                Import a CSV file or add contacts manually to get started.
              </p>
            </>
          )}
        </div>
      </Card>
    )
  }

  return (
    <Card padding="sm">
      <table className="w-full">
        <thead>
          <tr className="text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-900 border-b border-gray-800">
            <th className="text-left px-4 py-3">Name</th>
            <th className="text-left px-4 py-3">Email</th>
            <th className="text-left px-4 py-3">Status</th>
            <th className="text-left px-4 py-3">Tags</th>
            <th className="text-left px-4 py-3">Added</th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((contact) => {
            const fullName = [contact.first_name, contact.last_name]
              .filter(Boolean)
              .join(' ')
              .trim()

            const visibleTags = contact.tags.slice(0, 3)
            const extraTagsCount = contact.tags.length - 3

            return (
              <tr
                key={contact.id}
                className="h-12 border-b border-gray-800/50 hover:bg-gray-800/50 cursor-pointer transition-colors"
                onClick={() => onContactClick(contact)}
              >
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-100 font-medium">
                    {fullName || '--'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-300">{contact.email}</span>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={getStatusVariant(contact.status)}>
                    {contact.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1 items-center">
                    {visibleTags.map((tag) => (
                      <Badge key={tag} variant="default" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {extraTagsCount > 0 && (
                      <span className="text-xs text-gray-500">+{extraTagsCount} more</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-500">
                    {formatRelativeDate(contact.created_at)}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-gray-400">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page === 1}
              onClick={() => onPageChange(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
