import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const TRACKING_BASE = `${SUPABASE_URL}/functions/v1/t`
const BATCH_SIZE = 50

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- Helper functions ---

function personalizeText(
  text: string,
  contact: { first_name: string | null; last_name: string | null; company: string | null; email: string }
): string {
  return text
    .replace(/\{\{first_name\}\}/g, contact.first_name ?? '')
    .replace(/\{\{last_name\}\}/g, contact.last_name ?? '')
    .replace(/\{\{company\}\}/g, contact.company ?? '')
    .replace(/\{\{email\}\}/g, contact.email)
}

function personalizeHtml(
  html: string,
  contact: { first_name: string | null; last_name: string | null; company: string | null; email: string }
): string {
  return personalizeText(html, contact)
}

function wrapLinks(
  html: string,
  trackingId: string,
  baseUrl: string
): { html: string; linkMap: Record<string, string> } {
  const linkMap: Record<string, string> = {}
  let linkIndex = 0
  const wrappedHtml = html.replace(
    /href="(https?:\/\/[^"]+)"/g,
    (_, originalUrl) => {
      const idx = String(linkIndex++)
      linkMap[idx] = originalUrl
      return `href="${baseUrl}/click/${trackingId}/${idx}"`
    }
  )
  return { html: wrappedHtml, linkMap }
}

function injectPixel(html: string, trackingId: string, baseUrl: string): string {
  const pixel = `<img src="${baseUrl}/pixel/${trackingId}" width="1" height="1" style="display:none" alt="" />`
  if (html.includes('</body>')) {
    return html.replace('</body>', `${pixel}</body>`)
  }
  return html + pixel
}

function addUnsubscribeFooter(html: string, trackingId: string, baseUrl: string): string {
  const footer = `<p style="font-size:12px;color:#999;text-align:center;margin-top:30px;"><a href="${baseUrl}/unsub/${trackingId}" style="color:#999;">Unsubscribe</a></p>`
  if (html.includes('</body>')) {
    return html.replace('</body>', `${footer}</body>`)
  }
  return html + footer
}

// --- Main handler ---

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. JWT Authentication — verify user identity (T-03-10)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Parse request body
    const body = await req.json()
    const { campaign_id } = body
    if (!campaign_id) {
      return new Response(JSON.stringify({ error: 'campaign_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Create admin client (service_role for bulk operations — T-03-11)
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // 4. Get user's workspace_id
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('workspace_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: 'User profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const workspaceId = profile.workspace_id

    // 5. Load campaign
    const { data: campaign, error: campaignError } = await adminClient
      .from('campaigns')
      .select('*')
      .eq('id', campaign_id)
      .single()

    if (campaignError || !campaign) {
      return new Response(JSON.stringify({ error: 'Campaign not found or unauthorized' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 6. Workspace isolation check — T-03-09 and T-03-13
    if (campaign.workspace_id !== workspaceId) {
      return new Response(JSON.stringify({ error: 'Campaign not found or unauthorized' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 7. Validate campaign status — only draft or scheduled can be sent
    if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
      return new Response(JSON.stringify({ error: 'Campaign already sent or in progress' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 8. Validate campaign has a contact list
    if (!campaign.contact_list_id) {
      return new Response(JSON.stringify({ error: 'Campaign has no target contact list' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 9. Load active contacts from target list
    const { data: members, error: membersError } = await adminClient
      .from('contact_list_members')
      .select('contact_id, contacts(*)')
      .eq('contact_list_id', campaign.contact_list_id)

    if (membersError) {
      return new Response(JSON.stringify({ error: 'Failed to load contacts' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const activeContacts = members
      ?.map((m: any) => m.contacts)
      .filter((c: any) => c && c.status === 'active') ?? []

    if (activeContacts.length === 0) {
      return new Response(JSON.stringify({ error: 'No active contacts in target list' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 10. Update campaign status to 'sending'
    await adminClient.from('campaigns').update({
      status: 'sending',
      sent_at: new Date().toISOString(),
      total_recipients: activeContacts.length,
    }).eq('id', campaign_id)

    // 11. Process in batches of BATCH_SIZE (50) — T-03-12 rate limiting
    let totalSent = 0

    for (let i = 0; i < activeContacts.length; i += BATCH_SIZE) {
      const batch = activeContacts.slice(i, i + BATCH_SIZE)

      // a. Prepare recipients — personalize, wrap links, inject tracking
      const preparedEmails = batch.map((contact: any) => {
        const trackingId = crypto.randomUUID()

        // CRITICAL ORDER: personalize FIRST, then wrap links, then unsub footer, then pixel
        const personalizedHtml = personalizeHtml(campaign.body_html, contact)
        const { html: wrappedHtml, linkMap } = wrapLinks(personalizedHtml, trackingId, TRACKING_BASE)
        const htmlWithUnsub = addUnsubscribeFooter(wrappedHtml, trackingId, TRACKING_BASE)
        const finalHtml = injectPixel(htmlWithUnsub, trackingId, TRACKING_BASE)
        const personalizedSubject = personalizeText(campaign.subject, contact)

        return {
          contact,
          trackingId,
          html: finalHtml,
          subject: personalizedSubject,
          linkMap,
        }
      })

      // b. Insert campaign_recipients rows before sending (for referential integrity)
      const recipientRows = preparedEmails.map((email: any) => ({
        campaign_id: campaign_id,
        contact_id: email.contact.id,
        tracking_id: email.trackingId,
        delivery_status: 'queued',
        link_map: email.linkMap,
      }))

      await adminClient.from('campaign_recipients').insert(recipientRows)

      // c. Build Resend batch payload
      const resendBatch = preparedEmails.map((email: any) => ({
        from: `${campaign.from_name} <${campaign.from_email}>`,
        to: [email.contact.email],
        subject: email.subject,
        html: email.html,
        reply_to: campaign.reply_to_email || undefined,
      }))

      // d. Send via Resend batch API
      const resendResponse = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(resendBatch),
      })

      // e. Handle Resend response
      if (resendResponse.status === 429) {
        // Rate limit or daily quota reached — pause campaign
        await adminClient.from('campaigns').update({
          status: 'paused',
          total_sent: totalSent,
        }).eq('id', campaign_id)

        return new Response(JSON.stringify({
          ok: false,
          error: 'Rate limit reached. Campaign paused.',
          sent: totalSent,
          total: activeContacts.length,
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (!resendResponse.ok) {
        // Log error and continue to next batch (partial failure tolerance)
        console.error(`Resend batch error: ${resendResponse.status} ${await resendResponse.text()}`)
        continue
      }

      // Success — store resend_email_id for webhook matching
      const { data: resendData } = await resendResponse.json()
      if (resendData) {
        for (let j = 0; j < resendData.length; j++) {
          await adminClient.from('campaign_recipients')
            .update({
              resend_email_id: resendData[j].id,
              delivery_status: 'sent',
              sent_at: new Date().toISOString(),
            })
            .eq('tracking_id', preparedEmails[j].trackingId)
        }
      }

      totalSent += batch.length

      // f. Rate limiting between batches — 300ms delay
      if (i + BATCH_SIZE < activeContacts.length) {
        await new Promise((resolve) => setTimeout(resolve, 300))
      }
    }

    // 12. Mark campaign as sent
    await adminClient.from('campaigns').update({
      status: 'sent',
      total_sent: totalSent,
    }).eq('id', campaign_id)

    // 13. Return success
    return new Response(JSON.stringify({ ok: true, sent: totalSent, total: activeContacts.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
