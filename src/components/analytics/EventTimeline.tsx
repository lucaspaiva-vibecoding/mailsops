import { Send, Mail, Eye, MousePointer, Reply, AlertTriangle, UserMinus, type LucideIcon } from 'lucide-react'
import type { CampaignEventType } from '../../types/database'
import { relativeTime, EVENT_COLOR_MAP, EVENT_LABEL_MAP, PAGE_SIZE } from '../../lib/analyticsUtils'
import { FilterChips } from './FilterChips'
import { Spinner } from '../ui/Spinner'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

const EVENT_ICON_COMPONENT: Record<CampaignEventType, LucideIcon> = {
  sent: Send,
  delivered: Mail,
  opened: Eye,
  clicked: MousePointer,
  replied: Reply,
  bounced: AlertTriangle,
  unsubscribed: UserMinus,
  complained: AlertTriangle,
}

interface EventWithContact {
  id: string
  event_type: CampaignEventType
  link_url: string | null
  created_at: string
  contacts?: { email: string; first_name: string | null; last_name: string | null } | null
}

interface EventTimelineProps {
  events: EventWithContact[]
  totalCount: number
  page: number
  onPageChange: (page: number) => void
  eventTypeFilter: string | null
  onEventTypeFilterChange: (filter: string | null) => void
  loading: boolean
}

const filterOptions = [
  { value: null, label: 'All' },
  { value: 'opened', label: 'Opened' },
  { value: 'clicked', label: 'Clicked' },
  { value: 'bounced', label: 'Bounced' },
  { value: 'unsubscribed', label: 'Unsubscribed' },
]

export function EventTimeline({
  events,
  totalCount,
  page,
  onPageChange,
  eventTypeFilter,
  onEventTypeFilterChange,
  loading,
}: EventTimelineProps) {
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <Card padding="md">
      <h3 className="text-sm font-semibold text-gray-100 mb-4">Event Timeline</h3>
      <div className="mb-4">
        <FilterChips
          options={filterOptions}
          activeValue={eventTypeFilter}
          onChange={onEventTypeFilterChange}
        />
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm font-semibold text-gray-200">No events yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Events will appear here once recipients open, click, or interact with this campaign.
          </p>
        </div>
      ) : (
        <>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-900 px-4 py-3 text-left">
                  Event
                </th>
                <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-900 px-4 py-3 text-left">
                  Contact
                </th>
                <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-900 px-4 py-3 text-left">
                  Time
                </th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => {
                const IconComponent = EVENT_ICON_COMPONENT[event.event_type]
                return (
                  <tr key={event.id} className="border-b border-gray-800">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-7 h-7 rounded-full bg-gray-800 inline-flex items-center justify-center ${EVENT_COLOR_MAP[event.event_type]}`}
                        >
                          <IconComponent className="w-4 h-4" />
                        </span>
                        <span className="text-sm text-gray-300">
                          {EVENT_LABEL_MAP[event.event_type]}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-semibold text-gray-100">
                        {event.contacts?.email ?? 'Unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-sm text-gray-400"
                        title={new Date(event.created_at).toLocaleString()}
                      >
                        {relativeTime(event.created_at)}
                      </span>
                    </td>
                  </tr>
                )
              })}
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
