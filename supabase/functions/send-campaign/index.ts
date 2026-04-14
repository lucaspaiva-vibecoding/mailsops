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

function injectSignature(bodyHtml: string, signatureHtml: string | null): string {
  if (!signatureHtml) return bodyHtml
  const hr = '<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />'
  return `${bodyHtml}${hr}${signatureHtml}`
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
    const { campaign_id, contact_ids } = body
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
      .select('workspace_id, signature_html')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: 'User profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const workspaceId = profile.workspace_id
    const signatureHtml = profile.signature_html ?? null

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

    // 9. Load contacts — either from contact_ids override (A/B testing) or full list
    let activeContacts: any[]

    if (Array.isArray(contact_ids) && contact_ids.length > 0) {
      // A/B test mode: load specific contacts by ID
      const { data: contacts, error: contactsError } = await adminClient
        .from('contacts')
        .select('*')
        .in('id', contact_ids)
        .eq('status', 'active')

      if (contactsError) {
        return new Response(JSON.stringify({ error: 'Failed to load contacts' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      activeContacts = contacts ?? []
    } else {
      // Regular mode: load all active contacts from target list
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

      activeContacts = members
        ?.map((m: any) => m.contacts)
        .filter((c: any) => c && c.status === 'active') ?? []
    }

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

    // 11. Build campaign_links rows from the template HTML (before personalization).
    // We use the raw body_html because link URLs are the same for all recipients —
    // personalization only changes text content, not link targets.
    // campaign_links is the source of truth for click redirects in the t function.
    const templateLinkMap: Record<string, string> = {}
    let templateLinkIndex = 0
    campaign.body_html.replace(
      /href="(https?:\/\/[^"]+)"/g,
      (_: string, originalUrl: string) => {
        templateLinkMap[String(templateLinkIndex++)] = originalUrl
        return ''
      }
    )

    if (templateLinkIndex > 0) {
      const campaignLinkRows = Object.entries(templateLinkMap).map(([idx, url]) => ({
        campaign_id: campaign_id,
        workspace_id: workspaceId,
        original_url: url,
        link_index: parseInt(idx, 10),
        click_count: 0,
        unique_clicks: 0,
      }))

      const { error: linksInsertError } = await adminClient
        .from('campaign_links')
        .insert(campaignLinkRows)

      if (linksInsertError) {
        console.error('[send-campaign] campaign_links insert error:', linksInsertError.message)
      }
    }

    // 12. Process in batches of BATCH_SIZE (50) — T-03-12 rate limiting
    let totalSent = 0

    for (let i = 0; i < activeContacts.length; i += BATCH_SIZE) {
      const batch = activeContacts.slice(i, i + BATCH_SIZE)

      // a. Prepare recipients — personalize, wrap links, inject tracking
      const preparedEmails = batch.map((contact: any) => {
        const trackingId = crypto.randomUUID()

        // CRITICAL ORDER: personalize FIRST (body + signature), inject signature, then wrap links, then unsub footer, then pixel
        const personalizedBody = personalizeHtml(campaign.body_html, contact)
        const personalizedSig = signatureHtml ? personalizeHtml(signatureHtml, contact) : null
        const bodyWithSignature = injectSignature(personalizedBody, personalizedSig)
        const { html: wrappedHtml, linkMap } = wrapLinks(bodyWithSignature, trackingId, TRACKING_BASE)
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

      // b. Insert campaign_recipients rows before sending (for referential integrity).
      // - status: correct column name (not delivery_status)
      // - variables: stores the link map snapshot for this recipient (not link_map)
      // - workspace_id: required NOT NULL column
      const recipientRows = preparedEmails.map((email: any) => ({
        campaign_id: campaign_id,
        contact_id: email.contact.id,
        workspace_id: workspaceId,
        tracking_id: email.trackingId,
        status: 'queued',
        variables: email.linkMap,
      }))

      const { error: recipientsInsertError } = await adminClient
        .from('campaign_recipients')
        .insert(recipientRows)

      if (recipientsInsertError) {
        console.error('[send-campaign] campaign_recipients insert error:', recipientsInsertError.message)
      }

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
        console.error(`[send-campaign] Resend batch error: ${resendResponse.status} ${await resendResponse.text()}`)
        continue
      }

      // Success — store resend_message_id for webhook matching.
      // - resend_message_id: correct column name (not resend_email_id)
      // - status: correct column name (not delivery_status)
      const { data: resendData } = await resendResponse.json()
      if (resendData) {
        for (let j = 0; j < resendData.length; j++) {
          const { error: updateError } = await adminClient
            .from('campaign_recipients')
            .update({
              resend_message_id: resendData[j].id,
              status: 'sent',
              sent_at: new Date().toISOString(),
            })
            .eq('tracking_id', preparedEmails[j].trackingId)

          if (updateError) {
            console.error('[send-campaign] campaign_recipients post-send update error:', updateError.message)
          }
        }
      }

      totalSent += batch.length

      // f. Rate limiting between batches — 300ms delay
      if (i + BATCH_SIZE < activeContacts.length) {
        await new Promise((resolve) => setTimeout(resolve, 300))
      }
    }

    // 13. Mark campaign as sent
    await adminClient.from('campaigns').update({
      status: 'sent',
      total_sent: totalSent,
    }).eq('id', campaign_id)

    // 14. Return success
    return new Response(JSON.stringify({ ok: true, sent: totalSent, total: activeContacts.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[send-campaign] unhandled error:', (err as Error).message)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
