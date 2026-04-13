import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, MoreHorizontal, Mail } from 'lucide-react'
import { useCampaigns } from '../../hooks/campaigns/useCampaigns'
import { useContactLists } from '../../hooks/contacts/useContactLists'
import { useToast } from '../../components/ui/Toast'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import type { CampaignStatus } from '../../types/database'

const statusBadgeVariant: Record<CampaignStatus, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  draft: 'default',
  scheduled: 'info',
  sending: 'warning',
  sent: 'success',
  paused: 'default',
  cancelled: 'default',
}

const statusLabel: Record<CampaignStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  sending: 'Sending',
  sent: 'Sent',
  paused: 'Paused',
  cancelled: 'Cancelled',
}

export function CampaignsPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { campaigns, loading, deleteCampaign, duplicateCampaign } = useCampaigns()
  const { lists } = useContactLists()
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const listMap = Object.fromEntries(lists.map((l) => [l.id, l.name]))

  // Close menu on click outside
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null)
      }
    }
    if (openMenuId) {
      document.addEventListener('mousedown', handleMouseDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
    }
  }, [openMenuId])

  const handleRowClick = (e: React.MouseEvent, campaignId: string) => {
    if ((e.target as HTMLElement).closest('[data-no-list-click]')) return
    navigate(`/campaigns/${campaignId}/edit`)
  }

  const handleDuplicate = async (id: string) => {
    const { error } = await duplicateCampaign(id)
    if (error) showToast(error, 'error')
    else showToast('Campaign duplicated.', 'success')
    setOpenMenuId(null)
  }

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete '${name}'? This cannot be undone.`)) return
    const { error } = await deleteCampaign(id)
    if (error) showToast(error, 'error')
    else showToast('Campaign deleted.', 'success')
    setOpenMenuId(null)
  }

  const handleToggleMenu = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setOpenMenuId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-100">Campaigns</h1>
        <Button variant="primary" size="md" onClick={() => navigate('/campaigns/new')}>
          <Plus size={16} />
          New Campaign
        </Button>
      </div>

      <Card padding="sm" className="overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Mail size={40} className="text-gray-600 mb-4" />
            <h3 className="text-base font-semibold text-gray-200 mb-2">No campaigns yet</h3>
            <p className="text-sm text-gray-400 mb-6">
              Create your first campaign to start reaching your audience.
            </p>
            <Button variant="primary" size="md" onClick={() => navigate('/campaigns/new')}>
              <Plus size={16} />
              New Campaign
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto" ref={openMenuId ? menuRef : undefined}>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-900 px-4 py-3 text-left">
                    Campaign
                  </th>
                  <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-900 px-4 py-3 text-left">
                    Status
                  </th>
                  <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-900 px-4 py-3 text-left">
                    Target list
                  </th>
                  <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-900 px-4 py-3 text-left">
                    Scheduled / Sent
                  </th>
                  <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-900 px-4 py-3 w-12" />
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <tr
                    key={campaign.id}
                    onClick={(e) => handleRowClick(e, campaign.id)}
                    className="border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer"
                  >
                    <td className="px-4 py-3 text-sm font-semibold text-gray-100">
                      {campaign.name}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusBadgeVariant[campaign.status]}>
                        {statusLabel[campaign.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {campaign.contact_list_id
                        ? (listMap[campaign.contact_list_id] ?? '—')
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {campaign.sent_at
                        ? new Date(campaign.sent_at).toLocaleDateString()
                        : campaign.scheduled_at
                          ? new Date(campaign.scheduled_at).toLocaleDateString()
                          : '—'}
                    </td>
                    <td className="px-4 py-3 relative" data-no-list-click>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-8 h-8 p-0 justify-center"
                        aria-label={`Campaign options for ${campaign.name}`}
                        onClick={(e) => handleToggleMenu(e, campaign.id)}
                      >
                        <MoreHorizontal size={16} />
                      </Button>
                      {openMenuId === campaign.id && (
                        <div
                          ref={menuRef}
                          className="absolute right-4 top-full mt-1 z-20 bg-gray-800 border border-gray-700 rounded-lg shadow-lg py-1 min-w-[140px]"
                        >
                          <button
                            className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700"
                            onClick={(e) => {
                              e.stopPropagation()
                              setOpenMenuId(null)
                              navigate(`/campaigns/${campaign.id}/edit`)
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDuplicate(campaign.id)
                            }}
                          >
                            Duplicate
                          </button>
                          <button
                            className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-700"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(campaign.id, campaign.name)
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
