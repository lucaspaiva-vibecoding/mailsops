import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../useAuth'
import type { Campaign, CampaignInsert, CampaignUpdate } from '../../types/database'

export function useCampaigns() {
  const { profile } = useAuth()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCampaigns = useCallback(async () => {
    if (!profile?.workspace_id) return
    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('workspace_id', profile.workspace_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setCampaigns((data as Campaign[]) ?? [])
    }
    setLoading(false)
  }, [profile?.workspace_id])

  useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns])

  const createCampaign = async (campaign: Omit<CampaignInsert, 'workspace_id'>) => {
    if (!profile?.workspace_id) return { data: null, error: 'Not authenticated' }
    const { data, error } = await supabase
      .from('campaigns')
      .insert({ ...campaign, workspace_id: profile.workspace_id })
      .select()
      .single()
    if (error) return { data: null, error: error.message }
    await fetchCampaigns()
    return { data: data as Campaign, error: null }
  }

  const updateCampaign = async (id: string, updates: CampaignUpdate) => {
    if (!profile?.workspace_id) return { error: 'Not authenticated' }
    const { error } = await supabase
      .from('campaigns')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('workspace_id', profile.workspace_id)
    if (error) return { error: error.message }
    await fetchCampaigns()
    return { error: null }
  }

  const deleteCampaign = async (id: string) => {
    if (!profile?.workspace_id) return { error: 'Not authenticated' }
    const { error } = await supabase
      .from('campaigns')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('workspace_id', profile.workspace_id)
    if (error) return { error: error.message }
    await fetchCampaigns()
    return { error: null }
  }

  const duplicateCampaign = async (id: string) => {
    if (!profile?.workspace_id) return { data: null, error: 'Not authenticated' }
    const source = campaigns.find(c => c.id === id)
    if (!source) return { data: null, error: 'Campaign not found' }
    const { data, error } = await supabase
      .from('campaigns')
      .insert({
        workspace_id: profile.workspace_id,
        name: `Copy of ${source.name}`,
        status: 'draft',
        from_name: source.from_name,
        from_email: source.from_email,
        reply_to_email: source.reply_to_email,
        subject: source.subject,
        preview_text: source.preview_text,
        body_html: source.body_html,
        body_json: source.body_json,
        contact_list_id: source.contact_list_id,
        segment_filter: source.segment_filter,
        scheduled_at: null,
        settings: source.settings,
      })
      .select()
      .single()
    if (error) return { data: null, error: error.message }
    await fetchCampaigns()
    return { data: data as Campaign, error: null }
  }

  return { campaigns, loading, error, refetch: fetchCampaigns, createCampaign, updateCampaign, deleteCampaign, duplicateCampaign }
}
