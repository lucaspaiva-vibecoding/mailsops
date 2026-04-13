import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../useAuth'
import type { Campaign } from '../../types/database'

interface SentCampaignStats {
  total_sent: number
  total_opened: number
  total_clicked: number
}

export function useDashboardStats() {
  const { profile } = useAuth()

  const [contactCount, setContactCount] = useState<number | null>(null)
  const [sentCount, setSentCount] = useState<number | null>(null)
  const [avgOpenRate, setAvgOpenRate] = useState<number | null>(null)
  const [avgClickRate, setAvgClickRate] = useState<number | null>(null)
  const [recentCampaigns, setRecentCampaigns] = useState<Campaign[]>([])
  const [listsCount, setListsCount] = useState<number | null>(null)
  const [unsubscribedCount, setUnsubscribedCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboardStats = useCallback(async () => {
    if (!profile?.workspace_id) return
    setLoading(true)
    setError(null)

    try {
      const [
        contactsResult,
        sentCampaignsResult,
        recentCampaignsResult,
        allSentStatsResult,
        listsResult,
        unsubscribedResult,
      ] = await Promise.all([
        // 1. Total active contacts count
        supabase
          .from('contacts')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', profile.workspace_id)
          .is('deleted_at', null)
          .eq('status', 'active'),

        // 2. Sent campaigns count
        supabase
          .from('campaigns')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', profile.workspace_id)
          .eq('status', 'sent')
          .is('deleted_at', null),

        // 3. Recent 5 sent campaigns for the table
        supabase
          .from('campaigns')
          .select('id, name, sent_at, total_sent, total_opened, total_clicked, status, workspace_id, from_name, from_email, reply_to_email, subject, preview_text, body_html, body_json, contact_list_id, segment_filter, scheduled_at, total_recipients, total_delivered, total_replied, total_bounced, total_unsubscribed, settings, created_at, updated_at, deleted_at')
          .eq('workspace_id', profile.workspace_id)
          .eq('status', 'sent')
          .is('deleted_at', null)
          .order('sent_at', { ascending: false })
          .limit(5),

        // 4. All sent campaigns stats for avg rate computation
        supabase
          .from('campaigns')
          .select('total_sent, total_opened, total_clicked')
          .eq('workspace_id', profile.workspace_id)
          .eq('status', 'sent')
          .is('deleted_at', null),

        // 5. Contact lists count
        supabase
          .from('contact_lists')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', profile.workspace_id)
          .is('deleted_at', null),

        // 6. Unsubscribed contacts count
        supabase
          .from('contacts')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', profile.workspace_id)
          .is('deleted_at', null)
          .eq('status', 'unsubscribed'),
      ])

      // Handle errors from any query
      const firstError =
        contactsResult.error ||
        sentCampaignsResult.error ||
        recentCampaignsResult.error ||
        allSentStatsResult.error ||
        listsResult.error ||
        unsubscribedResult.error

      if (firstError) {
        setError(firstError.message)
        return
      }

      // Set simple counts
      setContactCount(contactsResult.count ?? null)
      setSentCount(sentCampaignsResult.count ?? null)
      setRecentCampaigns((recentCampaignsResult.data as Campaign[]) ?? [])
      setListsCount(listsResult.count ?? null)
      setUnsubscribedCount(unsubscribedResult.count ?? null)

      // Compute avg open/click rates from all sent campaigns
      const allSentStats = (allSentStatsResult.data as SentCampaignStats[]) ?? []
      const validCampaigns = allSentStats.filter(c => c.total_sent > 0)
      if (validCampaigns.length === 0) {
        setAvgOpenRate(null)
        setAvgClickRate(null)
      } else {
        const avgOpen =
          validCampaigns.reduce((sum, c) => sum + c.total_opened / c.total_sent, 0) /
          validCampaigns.length *
          100
        const avgClick =
          validCampaigns.reduce((sum, c) => sum + c.total_clicked / c.total_sent, 0) /
          validCampaigns.length *
          100
        setAvgOpenRate(avgOpen)
        setAvgClickRate(avgClick)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard stats')
    } finally {
      setLoading(false)
    }
  }, [profile?.workspace_id])

  useEffect(() => {
    fetchDashboardStats()
  }, [fetchDashboardStats])

  return {
    contactCount,
    sentCount,
    avgOpenRate,
    avgClickRate,
    recentCampaigns,
    listsCount,
    unsubscribedCount,
    loading,
    error,
    refetch: fetchDashboardStats,
  }
}
