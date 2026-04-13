import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { CampaignRecipientWithContact, RecipientStatusCounts } from '../../types/database'
import { STATUS_BADGE_VARIANT, PAGE_SIZE } from '../../lib/analyticsUtils'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Spinner } from '../ui/Spinner'

interface RecipientTableProps {
  recipients: CampaignRecipientWithContact[]
  totalCount: number
  page: number
  onPageChange: (page: number) => void
  statusFilter: string | null
  onStatusFilterChange: (filter: string | null) => void
  statusCounts: RecipientStatusCounts
  loading: boolean
}

const tabs = [
  { value: null, label: 'All', countKey: 'all' as keyof RecipientStatusCounts },
  { value: 'opened', label: 'Opened', countKey: 'opened' as keyof RecipientStatusCounts },
  { value: 'clicked', label: 'Clicked', countKey: 'clicked' as keyof RecipientStatusCounts },
  { value: 'bounced', label: 'Bounced', countKey: 'bounced' as keyof RecipientStatusCounts },
  { value: 'unsubscribed', label: 'Unsubscribed', countKey: 'unsubscribed' as keyof RecipientStatusCounts },
]

const timestampLabels: { key: keyof CampaignRecipientWithContact; label: string }[] = [
  { key: 'sent_at', label: 'Sent' },
  { key: 'delivered_at', label: 'Delivered' },
  { key: 'opened_at', label: 'Opened' },
  { key: 'clicked_at', label: 'Clicked' },
  { key: 'bounced_at', label: 'Bounced' },
  { key: 'unsubscribed_at', label: 'Unsubscribed' },
]

export function RecipientTable({
  recipients,
  totalCount,
  page,
  onPageChange,
  statusFilter,
  onStatusFilterChange,
  statusCounts,
  loading,
}: RecipientTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <Card padding="md">
      <h3 className="text-sm font-semibold text-gray-100 mb-4">Recipient Engagement</h3>

      {/* Tab strip with count badges per D-05 */}
      <div className="flex items-center gap-4 border-b border-gray-800 mb-4">
        {tabs.map((tab) => {
          const isActive = tab.value === statusFilter
          const count = statusCounts[tab.countKey]
          return (
            <button
              key={tab.value ?? 'all'}
              className={
                isActive
                  ? 'pb-2 text-xs font-semibold text-indigo-400 border-b-2 border-indigo-400'
                  : 'pb-2 text-xs font-semibold text-gray-400 hover:text-gray-200'
              }
              onClick={() => onStatusFilterChange(tab.value)}
            >
              {tab.label}
              <span
                className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-400'
                    : 'bg-gray-800 text-gray-500'
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : recipients.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm font-semibold text-gray-200">No recipients yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Recipients will appear after the campaign is sent.
          </p>
        </div>
      ) : (
        <>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-900 px-4 py-3 text-left">
                  Contact
                </th>
                <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-900 px-4 py-3 text-left">
                  Status
                </th>
                <th className="w-8 bg-gray-900" />
              </tr>
            </thead>
            <tbody>
              {recipients.map((r) => (
                <>
                  <tr
                    key={r.id}
                    className="border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setExpandedId(expandedId === r.id ? null : r.id)
                      }
                    }}
                  >
                    <td className="px-4 py-3">
                      <span className="text-sm font-semibold text-gray-100">
                        {r.contacts?.email ?? 'Unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_BADGE_VARIANT[r.status]}>
                        {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <ChevronDown
                        className={`w-4 h-4 text-gray-400 transition-transform ${expandedId === r.id ? 'rotate-180' : ''}`}
                        aria-label={expandedId === r.id ? 'Collapse row' : 'Expand row'}
                      />
                    </td>
                  </tr>
                  {expandedId === r.id && (
                    <tr key={`${r.id}-expanded`}>
                      <td colSpan={3} className="bg-gray-800/30 px-4 py-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          {timestampLabels.map(({ key, label }) => {
                            const value = r[key] as string | null
                            return (
                              <div key={label}>
                                <p className="text-xs text-gray-400">{label}</p>
                                <p className="text-sm text-gray-100">
                                  {value ? new Date(value).toLocaleString() : '\u2014'}
                                </p>
                              </div>
                            )
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
          {totalCount > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-4">
              <Button
                variant="ghost"
                size="sm"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
              >
                Prev
              </Button>
              <span className="text-sm text-gray-400">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
