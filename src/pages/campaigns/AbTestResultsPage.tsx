import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Eye, MousePointer, Send, ArrowLeft } from 'lucide-react'
import { useAbTest } from '../../hooks/campaigns/useAbTest'
import { useCampaigns } from '../../hooks/campaigns/useCampaigns'
import { useToast } from '../../components/ui/Toast'
import { StatCard } from '../../components/analytics/StatCard'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { SendWinnerModal } from '../../components/campaigns/SendWinnerModal'
import { formatRate } from '../../lib/analyticsUtils'
import type { AbTestSettings } from '../../types/database'

export function AbTestResultsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { parent, variantA, variantB, loading, error, refetch } = useAbTest(id)
  const { sendAbTestWinner } = useCampaigns()

  // Winner send state
  const [winnerModal, setWinnerModal] = useState<{ open: boolean; variant: 'A' | 'B' }>({ open: false, variant: 'A' })
  const [sendingWinner, setSendingWinner] = useState(false)
  const [winnerSent, setWinnerSent] = useState(false)

  // Derived values
  const settings = parent?.settings as unknown as AbTestSettings | null
  const splitPct = settings?.split_percentage ?? 40
  const holdBackContactIds = settings?.hold_back_contact_ids ?? []
  const holdBackCount = holdBackContactIds.length
  const halfPct = splitPct / 2
  const holdBackPct = 100 - splitPct

  // Determine if variants have been sent (both must be sent for results)
  const variantsSent = variantA?.status === 'sent' && variantB?.status === 'sent'

  // Determine if winner was already sent (parent status is 'sent' after variants were sent)
  const isComplete = parent?.status === 'sent' && variantsSent

  const handleSendWinner = async () => {
    if (!parent || !id) return
    setSendingWinner(true)
    const winnerVariantId = winnerModal.variant === 'A' ? variantA?.id : variantB?.id
    if (!winnerVariantId) {
      showToast('Variant not found.', 'error')
      setSendingWinner(false)
      return
    }
    const { error: sendError, sent } = await sendAbTestWinner(id, winnerVariantId)
    if (sendError) {
      showToast(sendError, 'error')
    } else {
      showToast(`Variant ${winnerModal.variant} sent to ${sent} contacts.`, 'success')
      setWinnerSent(true)
      await refetch()
    }
    setSendingWinner(false)
    setWinnerModal({ open: false, variant: 'A' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error || !parent) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-gray-400">{error || 'A/B test not found.'}</p>
        <Button variant="secondary" size="sm" className="mt-4" onClick={() => navigate('/campaigns')}>
          Back to campaigns
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Link to="/campaigns" className="text-gray-400 hover:text-gray-200">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-semibold text-gray-100">
          {parent.name} — A/B Results
        </h1>
        <Badge variant={parent.status === 'sent' ? 'success' : 'warning'}>
          {parent.status === 'sent' ? 'Complete' : parent.status === 'sending' ? 'Sending' : 'Draft'}
        </Badge>
      </div>

      {/* Split breakdown summary */}
      <Card>
        <p className="text-sm text-gray-400">
          Variant A: {halfPct}% ({variantA?.total_sent ?? 0} contacts) &middot; Variant B: {halfPct}% ({variantB?.total_sent ?? 0} contacts) &middot; Hold-back: {holdBackPct}% ({holdBackCount} contacts)
        </p>
      </Card>

      {/* Side-by-side stat cards */}
      {variantsSent && variantA && variantB && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Variant A column */}
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Variant A</h2>
            <StatCard
              label="Open Rate"
              value={formatRate(variantA.total_opened, variantA.total_sent)}
              subLabel={`${variantA.total_opened} opened of ${variantA.total_sent} sent`}
              icon={Eye}
              iconColor="text-green-400"
            />
            <StatCard
              label="Click Rate"
              value={formatRate(variantA.total_clicked, variantA.total_sent)}
              subLabel={`${variantA.total_clicked} clicked of ${variantA.total_sent} sent`}
              icon={MousePointer}
              iconColor="text-indigo-400"
            />
            <StatCard
              label="Total Sent"
              value={variantA.total_sent.toLocaleString()}
              icon={Send}
              iconColor="text-gray-400"
            />
          </div>

          {/* Variant B column */}
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Variant B</h2>
            <StatCard
              label="Open Rate"
              value={formatRate(variantB.total_opened, variantB.total_sent)}
              subLabel={`${variantB.total_opened} opened of ${variantB.total_sent} sent`}
              icon={Eye}
              iconColor="text-green-400"
            />
            <StatCard
              label="Click Rate"
              value={formatRate(variantB.total_clicked, variantB.total_sent)}
              subLabel={`${variantB.total_clicked} clicked of ${variantB.total_sent} sent`}
              icon={MousePointer}
              iconColor="text-indigo-400"
            />
            <StatCard
              label="Total Sent"
              value={variantB.total_sent.toLocaleString()}
              icon={Send}
              iconColor="text-gray-400"
            />
          </div>
        </div>
      )}

      {/* Not yet sent state */}
      {!variantsSent && (
        <Card>
          <p className="text-sm text-gray-400 text-center py-8">
            Send both variants first to see results here.
          </p>
        </Card>
      )}

      {/* Send winner section — only visible when variants sent and winner not yet sent */}
      {variantsSent && !isComplete && !winnerSent && holdBackCount > 0 && (
        <Card>
          <h3 className="text-base font-semibold text-gray-100 mb-2">
            Send the winning variant
          </h3>
          <p className="text-sm text-gray-400 mb-4">
            Choose which variant to send to the remaining {holdBackCount.toLocaleString()} contacts.
          </p>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setWinnerModal({ open: true, variant: 'A' })}
            >
              Send Variant A to {holdBackCount.toLocaleString()} contacts
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setWinnerModal({ open: true, variant: 'B' })}
            >
              Send Variant B to {holdBackCount.toLocaleString()} contacts
            </Button>
          </div>
        </Card>
      )}

      {/* Winner sent success state */}
      {(isComplete || winnerSent) && (
        <Card>
          <div className="flex items-center gap-3">
            <Badge variant="success">Winner sent</Badge>
            <p className="text-sm text-gray-400">
              The winning variant has been sent to the hold-back group.
            </p>
          </div>
        </Card>
      )}

      {/* Send winner confirmation modal */}
      <SendWinnerModal
        open={winnerModal.open}
        variantLabel={winnerModal.variant}
        holdBackCount={holdBackCount}
        loading={sendingWinner}
        onConfirm={handleSendWinner}
        onCancel={() => setWinnerModal({ open: false, variant: 'A' })}
      />
    </div>
  )
}
