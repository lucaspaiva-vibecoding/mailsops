import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Send, Eye, MousePointer } from 'lucide-react'
import { useSequence } from '../../hooks/sequences/useSequence'
import { useSequences } from '../../hooks/sequences/useSequences'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { StatCard } from '../../components/analytics/StatCard'
import { formatRate } from '../../lib/analyticsUtils'
import { useToast } from '../../components/ui/Toast'
import type { SequenceStatus } from '../../types/database'

interface StepStats {
  stepNumber: number
  delayDays: number
  sent: number
  opened: number
  clicked: number
}

function statusBadgeVariant(status: string): 'default' | 'success' | 'warning' | 'danger' | 'info' {
  switch (status) {
    case 'active': return 'success'
    case 'paused': return 'warning'
    default: return 'default'
  }
}

export function SequenceResultsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { profile } = useAuth()
  const { sequence, steps, loading, error } = useSequence(id)
  const { pauseSequence, resumeSequence } = useSequences()

  const [stepStats, setStepStats] = useState<StepStats[]>([])
  const [enrollmentCount, setEnrollmentCount] = useState(0)
  const [statsLoading, setStatsLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    if (!id || !profile?.workspace_id) return
    setStatsLoading(true)

    // Enrollment count
    const { data: enrollments, error: enrollError } = await supabase
      .from('sequence_enrollments')
      .select('id')
      .eq('sequence_id', id)

    if (!enrollError) setEnrollmentCount(enrollments?.length ?? 0)

    // Per-step stats: query sequence_step_sends by step IDs for this sequence,
    // joined to campaign_recipients for open/click data
    if (steps.length > 0) {
      const stepIds = steps.map((s) => s.id)
      const { data: sends, error: sendsError } = await supabase
        .from('sequence_step_sends')
        .select('step_number, sequence_step_id, campaign_recipients(status, opened_at, clicked_at)')
        .in('sequence_step_id', stepIds)

      if (sendsError) {
        showToast('Failed to load step stats.', 'error')
      } else {
        // Aggregate per step
        const statsMap: Record<number, { sent: number; opened: number; clicked: number }> = {}
        ;(sends ?? []).forEach((send: any) => {
          const sn = send.step_number
          if (!statsMap[sn]) statsMap[sn] = { sent: 0, opened: 0, clicked: 0 }
          statsMap[sn].sent++
          if (send.campaign_recipients?.opened_at) statsMap[sn].opened++
          if (send.campaign_recipients?.clicked_at) statsMap[sn].clicked++
        })

        const computed = steps.map((step) => ({
          stepNumber: step.step_number,
          delayDays: step.delay_days,
          sent: statsMap[step.step_number]?.sent ?? 0,
          opened: statsMap[step.step_number]?.opened ?? 0,
          clicked: statsMap[step.step_number]?.clicked ?? 0,
        }))

        setStepStats(computed)
      }
    }

    setStatsLoading(false)
  }, [id, profile?.workspace_id, steps, showToast])

  useEffect(() => { fetchStats() }, [fetchStats])

  const handlePause = async () => {
    if (!id) return
    if (!window.confirm('Pause this sequence? Active contacts will stop receiving steps until you resume.')) return
    const { error: pauseError } = await pauseSequence(id)
    if (pauseError) showToast(pauseError, 'error')
    else showToast('Sequence paused.', 'success')
  }

  const handleResume = async () => {
    if (!id) return
    const { error: resumeError } = await resumeSequence(id)
    if (resumeError) showToast(resumeError, 'error')
    else showToast('Sequence resumed.', 'success')
  }

  if (loading && !sequence) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error || !sequence) {
    return (
      <p className="text-sm text-red-400">
        Failed to load sequence results. Try refreshing the page.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {/* Header row */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/sequences')}>
          <ArrowLeft className="w-5 h-5 text-gray-400 hover:text-gray-100" />
        </button>
        <h1 className="text-xl font-semibold text-gray-100">
          {sequence.name} — Results
        </h1>
        <Badge variant={statusBadgeVariant(sequence.status as SequenceStatus)}>
          {sequence.status}
        </Badge>
      </div>

      {/* Enrollment summary card */}
      <Card padding="md">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">
            {enrollmentCount} contacts enrolled · {sequence.status}
          </p>
          <div>
            {sequence.status === 'active' && (
              <Button variant="secondary" size="sm" onClick={handlePause}>
                Pause Sequence
              </Button>
            )}
            {sequence.status === 'paused' && (
              <Button variant="primary" size="sm" onClick={handleResume}>
                Resume Sequence
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Per-step results */}
      <div className="flex flex-col gap-6">
        {statsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="lg" />
          </div>
        ) : (
          <>
            {stepStats.map((stat) => (
              <div key={stat.stepNumber}>
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">
                  Step {stat.stepNumber} — Day {stat.delayDays}
                </h3>
                {stat.sent === 0 ? (
                  <Card>
                    <p className="text-sm text-gray-400 text-center py-8">
                      Step not sent yet. Stats will appear after this step runs.
                    </p>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <StatCard
                      label="Sent"
                      value={String(stat.sent)}
                      icon={Send}
                      iconColor="text-gray-400"
                    />
                    <StatCard
                      label="Open Rate"
                      value={formatRate(stat.opened, stat.sent)}
                      subLabel={`${stat.opened} of ${stat.sent}`}
                      icon={Eye}
                      iconColor="text-green-400"
                    />
                    <StatCard
                      label="Click Rate"
                      value={formatRate(stat.clicked, stat.sent)}
                      subLabel={`${stat.clicked} of ${stat.sent}`}
                      icon={MousePointer}
                      iconColor="text-indigo-400"
                    />
                  </div>
                )}
              </div>
            ))}

            {steps.length === 0 && !statsLoading && (
              <Card>
                <p className="text-sm text-gray-400 text-center py-8">
                  No contacts enrolled. Start the sequence to enroll your contact list.
                </p>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  )
}
