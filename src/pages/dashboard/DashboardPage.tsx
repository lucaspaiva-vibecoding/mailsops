import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useDashboardStats } from '../../hooks/dashboard/useDashboardStats'
import { formatRate } from '../../lib/analyticsUtils'
import { StatCard } from '../../components/analytics/StatCard'
import { Card } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import { Users, Mail, Eye, MousePointer } from 'lucide-react'

export function DashboardPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const {
    contactCount,
    sentCount,
    avgOpenRate,
    avgClickRate,
    recentCampaigns,
    listsCount,
    unsubscribedCount,
    loading,
    error,
  } = useDashboardStats()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-100">
          Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
        </h2>
        <p className="text-gray-400 text-sm mt-1">Here&apos;s an overview of your email operations.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Contacts"
          value={contactCount !== null ? contactCount.toLocaleString() : '\u2014'}
          icon={Users}
          iconColor="text-blue-400"
        />
        <StatCard
          label="Campaigns Sent"
          value={sentCount !== null ? sentCount.toLocaleString() : '\u2014'}
          icon={Mail}
          iconColor="text-indigo-400"
        />
        <StatCard
          label="Avg Open Rate"
          value={avgOpenRate !== null ? `${avgOpenRate.toFixed(1)}%` : '\u2014'}
          icon={Eye}
          iconColor="text-green-400"
        />
        <StatCard
          label="Avg Click Rate"
          value={avgClickRate !== null ? `${avgClickRate.toFixed(1)}%` : '\u2014'}
          icon={MousePointer}
          iconColor="text-purple-400"
        />
      </div>

      <p className="text-sm text-gray-400">
        {listsCount !== null ? listsCount : 0} contact list{listsCount !== 1 ? 's' : ''} &middot;{' '}
        {unsubscribedCount !== null ? unsubscribedCount : 0} unsubscribed contact{unsubscribedCount !== 1 ? 's' : ''}
      </p>

      {error && (
        <p className="text-sm text-red-400">Failed to load data. Try refreshing the page.</p>
      )}

      <Card padding="md">
        <h3 className="text-sm font-semibold text-gray-100 mb-4">Recent Campaigns</h3>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : recentCampaigns.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm font-semibold text-gray-200">No campaigns sent yet</p>
            <p className="text-sm text-gray-400 mt-1">Send your first campaign to see results here.</p>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-900 px-4 py-3 text-left">
                    Campaign
                  </th>
                  <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-900 px-4 py-3 text-left">
                    Sent
                  </th>
                  <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-900 px-4 py-3 text-left">
                    Open Rate
                  </th>
                  <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-900 px-4 py-3 text-left">
                    Click Rate
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentCampaigns.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer"
                    onClick={() => navigate(`/campaigns/${c.id}/analytics`)}
                  >
                    <td className="px-4 py-3 text-sm font-semibold text-gray-100">{c.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {c.sent_at ? new Date(c.sent_at).toLocaleDateString() : '\u2014'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {formatRate(c.total_opened, c.total_sent)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {formatRate(c.total_clicked, c.total_sent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 text-center">
              <button
                className="text-sm text-indigo-400 hover:text-indigo-300"
                onClick={() => navigate('/campaigns')}
              >
                View all campaigns &rarr;
              </button>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
