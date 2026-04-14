import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../useAuth'
import type { Campaign, CampaignInsert, CampaignUpdate, AbTestSettings } from '../../types/database'

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
      .not('campaign_type', 'eq', 'ab_variant')  // Hide variant rows — only show regular + ab_test
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

    // Also soft-delete child variants if this is an A/B test parent
    const deletedCampaign = campaigns.find(c => c.id === id)
    if (deletedCampaign && deletedCampaign.campaign_type === 'ab_test') {
      await supabase
        .from('campaigns')
        .update({ deleted_at: new Date().toISOString() })
        .eq('parent_campaign_id', id)
        .eq('workspace_id', profile.workspace_id)
    }

    await fetchCampaigns()
    return { error: null }
  }

  const createAbTest = async (payload: {
    name: string
    fromName: string
    fromEmail: string
    replyTo: string | null
    contactListId: string
    splitPercentage: number
    variantA: { subject: string; bodyHtml: string; bodyJson: Record<string, unknown> | null }
    variantB: { subject: string; bodyHtml: string; bodyJson: Record<string, unknown> | null }
  }) => {
    if (!profile?.workspace_id) return { data: null, error: 'Not authenticated' }

    // 1. Insert parent campaign
    const { data: parentData, error: parentError } = await supabase
      .from('campaigns')
      .insert({
        workspace_id: profile.workspace_id,
        name: payload.name,
        status: 'draft',
        campaign_type: 'ab_test',
        from_name: payload.fromName,
        from_email: payload.fromEmail,
        reply_to_email: payload.replyTo,
        contact_list_id: payload.contactListId,
        settings: { split_percentage: payload.splitPercentage } as unknown as Record<string, unknown>,
        subject: '',
        body_html: '',
        body_json: null,
        preview_text: null,
        segment_filter: null,
        scheduled_at: null,
      })
      .select()
      .single()

    if (parentError || !parentData) return { data: null, error: parentError?.message ?? 'Failed to create A/B test' }
    const parent = parentData as Campaign

    // 2. Insert Variant A
    const { data: vaData, error: vaError } = await supabase
      .from('campaigns')
      .insert({
        workspace_id: profile.workspace_id,
        name: `${payload.name} \u2014 Variant A`,
        status: 'draft',
        campaign_type: 'ab_variant',
        parent_campaign_id: parent.id,
        from_name: payload.fromName,
        from_email: payload.fromEmail,
        reply_to_email: payload.replyTo,
        contact_list_id: payload.contactListId,
        subject: payload.variantA.subject,
        body_html: payload.variantA.bodyHtml,
        body_json: payload.variantA.bodyJson,
        preview_text: null,
        segment_filter: null,
        scheduled_at: null,
        settings: {},
      })
      .select()
      .single()

    if (vaError) {
      await supabase.from('campaigns').delete().eq('id', parent.id)
      return { data: null, error: vaError.message }
    }

    // 3. Insert Variant B
    const { data: vbData, error: vbError } = await supabase
      .from('campaigns')
      .insert({
        workspace_id: profile.workspace_id,
        name: `${payload.name} \u2014 Variant B`,
        status: 'draft',
        campaign_type: 'ab_variant',
        parent_campaign_id: parent.id,
        from_name: payload.fromName,
        from_email: payload.fromEmail,
        reply_to_email: payload.replyTo,
        contact_list_id: payload.contactListId,
        subject: payload.variantB.subject,
        body_html: payload.variantB.bodyHtml,
        body_json: payload.variantB.bodyJson,
        preview_text: null,
        segment_filter: null,
        scheduled_at: null,
        settings: {},
      })
      .select()
      .single()

    if (vbError) {
      await supabase.from('campaigns').delete().eq('id', parent.id)
      return { data: null, error: vbError.message }
    }

    await fetchCampaigns()
    return { data: { parent, variantA: vaData as Campaign, variantB: vbData as Campaign }, error: null }
  }

  const sendAbTestVariants = async (
    parentId: string,
    variantAId: string,
    variantBId: string,
    splitPercentage: number,
    contactListId: string
  ) => {
    if (!profile?.workspace_id) return { error: 'Not authenticated' }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return { error: 'Not authenticated' }

    // 1. Fetch active contacts in target list
    const { data: members, error: membersError } = await supabase
      .from('contact_list_members')
      .select('contact_id, contacts(id, status)')
      .eq('contact_list_id', contactListId)

    if (membersError) return { error: membersError.message }

    const activeContactIds = (members ?? [])
      .filter((m: any) => m.contacts && m.contacts.status === 'active')
      .map((m: any) => m.contacts.id as string)

    if (activeContactIds.length === 0) return { error: 'No active contacts in target list' }

    // 2. Fisher-Yates shuffle
    const shuffled = [...activeContactIds]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }

    // 3. Split into three groups per D-04
    const halfPct = splitPercentage / 2 / 100
    const splitSize = Math.round(halfPct * shuffled.length)
    const variantAContactIds = shuffled.slice(0, splitSize)
    const variantBContactIds = shuffled.slice(splitSize, splitSize * 2)
    const holdBackContactIds = shuffled.slice(splitSize * 2)

    // 4. Store hold-back contact IDs in parent settings JSONB
    await supabase
      .from('campaigns')
      .update({
        status: 'sending',
        settings: { split_percentage: splitPercentage, hold_back_contact_ids: holdBackContactIds } as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      })
      .eq('id', parentId)
      .eq('workspace_id', profile.workspace_id)

    // 5. Send Variant A via Edge Function with contact_ids override
    const { error: errA } = await supabase.functions.invoke('send-campaign', {
      body: { campaign_id: variantAId, contact_ids: variantAContactIds },
      headers: { Authorization: `Bearer ${session.access_token}` },
    })

    // 6. Send Variant B via Edge Function with contact_ids override
    const { error: errB } = await supabase.functions.invoke('send-campaign', {
      body: { campaign_id: variantBId, contact_ids: variantBContactIds },
      headers: { Authorization: `Bearer ${session.access_token}` },
    })

    // 7. Update parent status
    const finalStatus = (errA || errB) ? 'paused' : 'sent'
    await supabase
      .from('campaigns')
      .update({
        status: finalStatus,
        sent_at: new Date().toISOString(),
        total_recipients: activeContactIds.length,
        updated_at: new Date().toISOString(),
      })
      .eq('id', parentId)
      .eq('workspace_id', profile.workspace_id)

    await fetchCampaigns()

    if (errA) return { error: `Variant A send failed: ${errA.message}` }
    if (errB) return { error: `Variant B send failed: ${errB.message}` }
    return { error: null }
  }

  const sendAbTestWinner = async (parentId: string, winnerVariantId: string) => {
    if (!profile?.workspace_id) return { error: 'Not authenticated', sent: 0 }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return { error: 'Not authenticated', sent: 0 }

    // 1. Read hold-back contact IDs from parent settings
    const { data: parentData, error: parentError } = await supabase
      .from('campaigns')
      .select('settings')
      .eq('id', parentId)
      .eq('workspace_id', profile.workspace_id)
      .single()

    if (parentError || !parentData) return { error: 'Failed to load A/B test', sent: 0 }

    const settings = parentData.settings as AbTestSettings | null
    const holdBackContactIds = settings?.hold_back_contact_ids ?? []

    if (holdBackContactIds.length === 0) return { error: 'No hold-back contacts to send to', sent: 0 }

    // 2. Send winner to hold-back group via Edge Function with contact_ids override
    const { data, error: sendError } = await supabase.functions.invoke('send-campaign', {
      body: { campaign_id: winnerVariantId, contact_ids: holdBackContactIds },
      headers: { Authorization: `Bearer ${session.access_token}` },
    })

    if (sendError) return { error: sendError.message, sent: 0 }

    // 3. Update parent status to 'sent' (per D-06)
    await supabase
      .from('campaigns')
      .update({
        status: 'sent',
        updated_at: new Date().toISOString(),
      })
      .eq('id', parentId)
      .eq('workspace_id', profile.workspace_id)

    await fetchCampaigns()
    return { error: null, sent: data?.sent ?? holdBackContactIds.length }
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

  return { campaigns, loading, error, refetch: fetchCampaigns, createCampaign, updateCampaign, deleteCampaign, duplicateCampaign, createAbTest, sendAbTestVariants, sendAbTestWinner }
}
