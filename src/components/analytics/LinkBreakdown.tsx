import type { CampaignLink } from '../../types/database'
import { Card } from '../ui/Card'
import { Spinner } from '../ui/Spinner'

interface LinkBreakdownProps {
  links: CampaignLink[]
  loading: boolean
}

export function LinkBreakdown({ links, loading }: LinkBreakdownProps) {
  return (
    <Card padding="md">
      <h3 className="text-sm font-semibold text-gray-100 mb-4">Link Breakdown</h3>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : links.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm font-semibold text-gray-200">No links tracked yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Links will appear once the campaign is sent and recipients click.
          </p>
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-900 px-4 py-3 text-left">
                URL
              </th>
              <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-900 px-4 py-3 text-left">
                Total Clicks
              </th>
              <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-900 px-4 py-3 text-left">
                Unique Clicks
              </th>
            </tr>
          </thead>
          <tbody>
            {links.map((link) => (
              <tr key={link.id} className="border-b border-gray-800">
                <td className="px-4 py-3">
                  <span
                    className="text-sm text-gray-100 truncate max-w-xs block"
                    title={link.original_url}
                  >
                    {link.original_url}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-400">
                    {link.click_count.toLocaleString()}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-400">
                    {link.unique_clicks.toLocaleString()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}
