import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useCsvCampaign } from '../../hooks/campaigns/useCsvCampaign'
import { useCampaign } from '../../hooks/campaigns/useCampaign'
import { useToast } from '../../components/ui/Toast'
import { SchedulingSection } from '../../components/campaigns/SchedulingSection'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import { supabase } from '../../lib/supabase'
import { truncateBody } from '../../lib/csvParser'
import type { CampaignRecipientWithContact } from '../../types/database'

export function CsvReviewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { campaign, loading: campaignLoading } = useCampaign(id)
  const { sendCsvCampaign } = useCsvCampaign()

  const [recipients, setRecipients] = useState<CampaignRecipientWithContact[]>([])
  const [loadingRecipients, setLoadingRecipients] = useState(true)
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now')
  const [scheduledAt, setScheduledAt] = useState('')
  const [timezone, setTimezone] = useState('UTC')
  const [sending, setSending] = useState(false)
  const [bccInput, setBccInput] = useState('')

  useEffect(() => {
    if (!id) return
    const loadRecipients = async () => {
      setLoadingRecipients(true)
      const { data, error } = await supabase
        .from('campaign_recipients')
        .select('*, contacts(email, first_name, last_name)')
        .eq('campaign_id', id)
        .order('created_at', { ascending: true })
      if (!error && data) {
        setRecipients(data as CampaignRecipientWithContact[])
      }
      setLoadingRecipients(false)
    }
    loadRecipients()
  }, [id])

  const handleSend = async () => {
    if (!id || !campaign) return

    if (scheduleMode === 'later') {
      if (!scheduledAt) {
        showToast('Please select a send date and time.', 'error')
        return
      }
      const scheduledAtUtc = new Date(scheduledAt).toISOString()
      const { error } = await supabase
        .from('campaigns')
        .update({ status: 'scheduled', scheduled_at: scheduledAtUtc })
        .eq('id', id)
      if (error) {
        showToast(error.message, 'error')
      } else {
        showToast('Campaign scheduled.', 'success')
        navigate('/campaigns')
      }
      return
    }

    const confirmed = window.confirm(
      `Send this campaign to ${recipients.length} recipients? This cannot be undone.`
    )
    if (!confirmed) return

    // Parse and save BCC emails to campaign settings before sending
    const bccEmails = bccInput
      .split(',')
      .map(e => e.trim())
      .filter(e => e.length > 0)

    if (bccEmails.length > 0) {
      const { data: currentCampaign } = await supabase
        .from('campaigns')
        .select('settings')
        .eq('id', id)
        .single()
      const currentSettings = (currentCampaign?.settings as Record<string, unknown>) ?? {}
      await supabase
        .from('campaigns')
        .update({ settings: { ...currentSettings, bcc_emails: bccEmails } })
        .eq('id', id)
    }

    setSending(true)
    const { error, sent, total } = await sendCsvCampaign(id)
    setSending(false)

    if (error) {
      showToast(error, 'error')
    } else {
      showToast(`Campaign sent to ${sent ?? 0} of ${total ?? 0} recipients.`, 'success')
      navigate('/campaigns')
    }
  }

  if (campaignLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="p-6 text-gray-400">Campaign not found.</div>
    )
  }

  // Guard: redirect non-csv campaigns to standard edit page
  if (campaign.campaign_type !== 'csv_personalized') {
    navigate(`/campaigns/${id}/edit`)
    return null
  }

  const canSend = campaign.status === 'draft' || campaign.status === 'scheduled'

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => navigate('/campaigns')}
              className="text-sm text-gray-400 hover:text-gray-200 mb-2 flex items-center gap-1"
            >
              ← Back to campaigns
            </button>
            <h1 className="text-2xl font-semibold text-gray-100">{campaign.name}</h1>
          </div>
        </div>

        {/* Recipients section */}
        <div>
          <h2 className="text-xs font-semibold tracking-widest uppercase text-gray-400 mb-3">
            Recipients ({recipients.length})
          </h2>
          <Card padding="sm">
            {loadingRecipients ? (
              <div className="flex items-center justify-center py-8">
                <Spinner size="md" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-900 border-b border-gray-800">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">#</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Subject</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Body Preview</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipients.map((recipient, index) => {
                      const name = [recipient.contacts?.first_name, recipient.contacts?.last_name]
                        .filter(Boolean).join(' ') || '—'
                      return (
                        <tr key={recipient.id} className="border-b border-gray-800 hover:bg-gray-900/50">
                          <td className="px-4 py-3 text-gray-400">{index + 1}</td>
                          <td className="px-4 py-3 text-gray-200">{name}</td>
                          <td className="px-4 py-3 text-gray-300">{recipient.contacts?.email ?? '—'}</td>
                          <td className="px-4 py-3 text-gray-300">{recipient.personalized_subject ?? '—'}</td>
                          <td className="px-4 py-3 text-gray-400">{truncateBody(recipient.personalized_body ?? '', 80)}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 rounded text-xs font-medium bg-gray-800 text-gray-300">
                              {recipient.status}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Send controls */}
        {canSend && (
          <div>
            <h2 className="text-xs font-semibold tracking-widest uppercase text-gray-400 mb-3">
              Delivery
            </h2>
            <Card padding="md">
              {/* BCC */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  BCC <span className="text-gray-500 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={bccInput}
                  onChange={e => setBccInput(e.target.value)}
                  placeholder="email1@exemplo.com, email2@exemplo.com"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="mt-1 text-xs text-gray-500">Separate multiple addresses with commas. These recipients will be hidden from each other and from the main recipient.</p>
              </div>

              <SchedulingSection
                scheduleMode={scheduleMode}
                onScheduleModeChange={setScheduleMode}
                scheduledAt={scheduledAt}
                onScheduledAtChange={setScheduledAt}
                timezone={timezone}
                onTimezoneChange={setTimezone}
              />
              <div className="mt-6">
                <Button
                  variant="primary"
                  size="md"
                  loading={sending}
                  onClick={handleSend}
                >
                  {scheduleMode === 'later' ? 'Schedule' : 'Send Now'}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {!canSend && (
          <div className="bg-gray-800/50 rounded-lg p-4 text-sm text-gray-400">
            {campaign.sent_at
              ? `This campaign was sent on ${new Date(campaign.sent_at).toLocaleDateString()}.`
              : 'This campaign has already been sent.'}
            {campaign.status === 'sent' && (
              <button
                onClick={() => navigate(`/campaigns/${id}/analytics`)}
                className="ml-2 text-indigo-400 hover:text-indigo-300 underline"
              >
                View analytics
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
