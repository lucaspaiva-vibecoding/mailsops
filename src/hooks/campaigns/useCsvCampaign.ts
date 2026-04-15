import { useAuth } from '../useAuth'
import { supabase } from '../../lib/supabase'
import type { CsvRow } from '../../types/database'

export function useCsvCampaign() {
  const { profile } = useAuth()

  const createCsvCampaign = async (payload: {
    name: string
    rows: CsvRow[]
  }): Promise<{ data: { campaignId: string; recipientCount: number } | null; error: string | null }> => {
    if (!profile?.workspace_id) return { data: null, error: 'Not authenticated' }

    // Step 1: Application-level upsert contacts by (workspace_id, email)
    // (No unique constraint on contacts(workspace_id, email) — use select+insert/update pattern)
    const emails = payload.rows.map(r => r.email.toLowerCase().trim())

    const { data: existingContacts, error: fetchError } = await supabase
      .from('contacts')
      .select('id, email')
      .eq('workspace_id', profile.workspace_id)
      .in('email', emails)
      .is('deleted_at', null)

    if (fetchError) return { data: null, error: `Contact lookup failed: ${fetchError.message}` }

    const existingByEmail = new Map<string, string>()
    for (const c of existingContacts ?? []) {
      existingByEmail.set(c.email, c.id)
    }

    const emailToContactId = new Map<string, string>()

    // Update existing contacts (first_name / last_name)
    const toUpdate = payload.rows.filter(r => existingByEmail.has(r.email.toLowerCase().trim()))
    for (const row of toUpdate) {
      const email = row.email.toLowerCase().trim()
      const id = existingByEmail.get(email)!
      await supabase.from('contacts').update({
        first_name: row.first_name || null,
        last_name: row.last_name || null,
        updated_at: new Date().toISOString(),
      }).eq('id', id)
      emailToContactId.set(email, id)
    }

    // Insert new contacts
    const toInsert = payload.rows.filter(r => !existingByEmail.has(r.email.toLowerCase().trim()))
    if (toInsert.length > 0) {
      const insertPayload = toInsert.map(row => ({
        workspace_id: profile.workspace_id,
        email: row.email.toLowerCase().trim(),
        first_name: row.first_name || null,
        last_name: row.last_name || null,
        company: null,
        tags: [],
        custom_fields: {},
        status: 'active' as const,
      }))
      const { data: inserted, error: insertError } = await supabase
        .from('contacts')
        .insert(insertPayload)
        .select('id, email')
      if (insertError) return { data: null, error: `Contact insert failed: ${insertError.message}` }
      for (const c of inserted ?? []) {
        emailToContactId.set(c.email, c.id)
      }
    }

    if (emailToContactId.size === 0) {
      return { data: null, error: 'No contacts were created or updated' }
    }

    // Step 2: Create campaign with campaign_type='csv_personalized'
    const { data: campaignData, error: campaignError } = await supabase
      .from('campaigns')
      .insert({
        workspace_id: profile.workspace_id,
        name: payload.name,
        status: 'draft',
        campaign_type: 'csv_personalized',
        from_name: profile.default_sender_name || '',
        from_email: profile.default_sender_email || '',
        reply_to_email: null,
        subject: '',
        preview_text: null,
        body_html: '',
        body_json: null,
        contact_list_id: null,
        segment_filter: null,
        scheduled_at: null,
        settings: {},
      })
      .select()
      .single()

    if (campaignError || !campaignData) {
      return { data: null, error: `Campaign creation failed: ${campaignError?.message ?? 'Unknown error'}` }
    }

    // Step 3: Bulk insert campaign_recipients with personalized_subject + personalized_body
    const recipientRows = payload.rows
      .map(row => {
        const contactId = emailToContactId.get(row.email.toLowerCase().trim())
        if (!contactId) return null
        return {
          campaign_id: campaignData.id,
          contact_id: contactId,
          workspace_id: profile.workspace_id,
          status: 'queued' as const,
          resend_message_id: null,
          variables: {},
          sent_at: null,
          delivered_at: null,
          opened_at: null,
          clicked_at: null,
          replied_at: null,
          bounced_at: null,
          unsubscribed_at: null,
          personalized_subject: row.subject,
          personalized_body: row.body,
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)

    const { error: recipientsError } = await supabase
      .from('campaign_recipients')
      .insert(recipientRows)

    if (recipientsError) {
      // Cleanup: delete the campaign if recipients failed
      await supabase.from('campaigns').delete().eq('id', campaignData.id)
      return { data: null, error: `Recipients insert failed: ${recipientsError.message}` }
    }

    // Update total_recipients count on campaign
    await supabase
      .from('campaigns')
      .update({ total_recipients: recipientRows.length })
      .eq('id', campaignData.id)

    return {
      data: { campaignId: campaignData.id, recipientCount: recipientRows.length },
      error: null,
    }
  }

  const sendCsvCampaign = async (campaignId: string): Promise<{ error: string | null; sent?: number; total?: number }> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return { error: 'Session expired. Please refresh the page.' }

    const { data, error } = await supabase.functions.invoke('send-campaign', {
      body: { campaign_id: campaignId },
      headers: { Authorization: `Bearer ${session.access_token}` },
    })

    if (error) return { error: error.message }
    if (data && !data.ok) return { error: data.error || 'Send failed' }
    return { error: null, sent: data?.sent, total: data?.total }
  }

  return { createCsvCampaign, sendCsvCampaign }
}
