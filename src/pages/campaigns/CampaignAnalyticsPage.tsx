import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Send, Eye, MousePointer, AlertTriangle, UserMinus } from 'lucide-react'
import { useCampaignAnalytics } from '../../hooks/campaigns/useCampaignAnalytics'
import { formatRate } from '../../lib/analyticsUtils'
import { StatCard } from '../../components/analytics/StatCard'
import { EventTimeline } from '../../components/analytics/EventTimeline'
import { LinkBreakdown } from '../../components/analytics/LinkBreakdown'
import { RecipientTable } from '../../components/analytics/RecipientTable'
import { Spinner } from '../../components/ui/Spinner'

export function CampaignAnalyticsPage() {
  const { id } = useParams<{ id: string }>()
  const {
    campaign,
    events,
    eventsTotal,
    eventsPage,
    setEventsPage,
    eventTypeFilter,
    setEventTypeFilter,
    links,
    recipients,
    recipientsTotal,
    recipientsPage,
    setRecipientsPage,
    recipientStatusFilter,
    setRecipientStatusFilter,
    recipientStatusCounts,
    loading,
    error,
  } = useCampaignAnalytics(id)

  if (loading && !campaign) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <Link
          to="/campaigns"
          className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Campaigns
        </Link>
        <h1 className="text-xl font-semibold text-gray-100 mt-2">Analytics</h1>
        <p className="text-sm text-gray-400">{campaign?.name ?? ''}</p>
      </div>

      {error && (
        <p className="text-sm text-red-400">Failed to load data. Try refreshing the page.</p>
      )}

      {/* Stat cards */}
      {campaign && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          <StatCard
            label="Sent"
            value={campaign.total_sent.toLocaleString()}
            icon={Send}
            iconColor="text-gray-400"
          />
          <StatCard
            label="Open Rate"
            value={formatRate(campaign.total_opened, campaign.total_sent)}
            subLabel={
              campaign.total_sent > 0
                ? `(${campaign.total_opened.toLocaleString()} opens)`
                : undefined
            }
            icon={Eye}
            iconColor="text-green-400"
          />
          <StatCard
            label="Click Rate"
            value={formatRate(campaign.total_clicked, campaign.total_sent)}
            subLabel={
              campaign.total_sent > 0
                ? `(${campaign.total_clicked.toLocaleString()} clicks)`
                : undefined
            }
            icon={MousePointer}
            iconColor="text-indigo-400"
          />
          <StatCard
            label="Bounce Rate"
            value={formatRate(campaign.total_bounced, campaign.total_sent)}
            subLabel={
              campaign.total_sent > 0
                ? `(${campaign.total_bounced.toLocaleString()} bounces)`
                : undefined
            }
            icon={AlertTriangle}
            iconColor="text-red-400"
          />
          <StatCard
            label="Unsubscribes"
            value={campaign.total_unsubscribed.toLocaleString()}
            icon={UserMinus}
            iconColor="text-yellow-400"
          />
        </div>
      )}

      {/* Event Timeline */}
      <EventTimeline
        events={events}
        totalCount={eventsTotal}
        page={eventsPage}
        onPageChange={setEventsPage}
        eventTypeFilter={eventTypeFilter}
        onEventTypeFilterChange={setEventTypeFilter}
        loading={loading}
      />

      {/* Link Breakdown */}
      <LinkBreakdown links={links} loading={loading} />

      {/* Recipient Engagement */}
      <RecipientTable
        recipients={recipients}
        totalCount={recipientsTotal}
        page={recipientsPage}
        onPageChange={setRecipientsPage}
        statusFilter={recipientStatusFilter}
        onStatusFilterChange={setRecipientStatusFilter}
        statusCounts={recipientStatusCounts}
        loading={loading}
      />
    </div>
  )
}
