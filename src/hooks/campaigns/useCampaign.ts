import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../useAuth'
import type { Campaign, CampaignUpdate } from '../../types/database'

export function useCampaign(id: string | undefined) {
  const { profile } = useAuth()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCampaign = useCallback(async () => {
    if (!profile?.workspace_id || !id) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .eq('workspace_id', profile.workspace_id)
      .is('deleted_at', null)
      .single()

    if (fetchError) {
      setError(fetchError.message)
      setCampaign(null)
    } else {
      setCampaign(data as Campaign)
    }
    setLoading(false)
  }, [profile?.workspace_id, id])

  useEffect(() => {
    fetchCampaign()
  }, [fetchCampaign])

  const updateCampaign = async (updates: CampaignUpdate) => {
    if (!profile?.workspace_id || !id) return { error: 'Not authenticated' }
    const { error } = await supabase
      .from('campaigns')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('workspace_id', profile.workspace_id)
    if (error) return { error: error.message }
    await fetchCampaign()
    return { error: null }
  }

  const sendCampaign = async (): Promise<{ error: string | null; sent?: number; total?: number }> => {
    if (!profile?.workspace_id || !id) return { error: 'Not authenticated' }

    const { data, error } = await supabase.functions.invoke('send-campaign', {
      body: { campaign_id: id },
    })

    if (error) {
      return { error: error.message || 'Failed to send campaign' }
    }

    if (data && !data.ok) {
      return { error: data.error || 'Campaign send failed', sent: data.sent, total: data.total }
    }

    await fetchCampaign()
    return { error: null, sent: data?.sent, total: data?.total }
  }

  return { campaign, loading, error, refetch: fetchCampaign, updateCampaign, sendCampaign }
}
