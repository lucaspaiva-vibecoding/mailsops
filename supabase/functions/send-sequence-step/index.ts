import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const SEQUENCE_CRON_SECRET = Deno.env.get('SEQUENCE_CRON_SECRET') ?? ''
const TRACKING_BASE = `${SUPABASE_URL}/functions/v1/t`
const MAX_PER_INVOCATION = 100  // safety cap per Research recommendation

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Helper functions (copied from send-campaign — same personalization + tracking logic) ──

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

// ── Main handler ──

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Internal secret validation (since verify_jwt: false — per D-01 + Research Pattern 2)
    // Accept either x-internal-secret header OR Authorization bearer token matching the secret
    // This allows both pg_cron (via header) and manual testing (via curl with auth header)
    const internalSecret = req.headers.get('x-internal-secret')
    const authHeader = req.headers.get('Authorization')
    const bearerToken = authHeader?.replace('Bearer ', '')

    if (!SEQUENCE_CRON_SECRET) {
      console.error('[send-sequence-step] SEQUENCE_CRON_SECRET not configured')
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (internalSecret !== SEQUENCE_CRON_SECRET && bearerToken !== SEQUENCE_CRON_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Create admin client with service_role for all DB operations
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // 2a. Cache signature_html per workspace_id to avoid repeated lookups
    const signatureCache = new Map<string, string | null>()

    async function getSignatureForWorkspace(workspaceId: string): Promise<string | null> {
      if (signatureCache.has(workspaceId)) {
        return signatureCache.get(workspaceId) ?? null
      }
      const { data: senderProfile } = await adminClient
        .from('profiles')
        .select('signature_html')
        .eq('workspace_id', workspaceId)
        .single()
      const sig = senderProfile?.signature_html ?? null
      signatureCache.set(workspaceId, sig)
      return sig
    }

    // 3. Query due enrollments: status='active', next_send_at <= now(), limit 100
    // Join sequences (to check sequence status + get sender settings) and contacts (to check active status + get email)
    const { data: dueEnrollments, error: queryError } = await adminClient
      .from('sequence_enrollments')
      .select(`
        *,
        sequences:sequence_id(id, status, from_name, from_email, reply_to_email, workspace_id),
        contacts:contact_id(id, email, first_name, last_name, company, status)
      `)
      .eq('status', 'active')
      .lte('next_send_at', new Date().toISOString())
      .limit(MAX_PER_INVOCATION)

    if (queryError) {
      console.error('[send-sequence-step] query error:', queryError.message)
      return new Response(JSON.stringify({ error: queryError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!dueEnrollments || dueEnrollments.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0, message: 'No due enrollments' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let processed = 0
    let skipped = 0
    let errors = 0

    // 4. Process each due enrollment sequentially (per Research Pitfall 6 — idempotent)
    for (const enrollment of dueEnrollments) {
      const seq = enrollment.sequences as any
      const contact = enrollment.contacts as any

      // 4a. Skip if sequence is not active (paused/archived)
      if (!seq || seq.status !== 'active') {
        skipped++
        continue
      }

      // 4b. Skip if contact is not active (D-08: unsubscribe/bounce stop)
      if (!contact || contact.status !== 'active') {
        // Update enrollment status to match contact status
        const enrollmentStatus = contact?.status === 'bounced' ? 'bounced' : 'unsubscribed'
        await adminClient
          .from('sequence_enrollments')
          .update({ status: enrollmentStatus })
          .eq('id', enrollment.id)
        skipped++
        continue
      }

      // 4c. Load the current step for this enrollment
      const { data: step, error: stepError } = await adminClient
        .from('sequence_steps')
        .select('*')
        .eq('sequence_id', enrollment.sequence_id)
        .eq('step_number', enrollment.current_step)
        .single()

      if (stepError || !step) {
        // No step found for current_step — mark enrollment as completed
        await adminClient
          .from('sequence_enrollments')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', enrollment.id)
        skipped++
        continue
      }

      // 4d. Prepare the email — personalize, inject signature, wrap links, inject tracking
      const trackingId = crypto.randomUUID()
      const signatureHtml = await getSignatureForWorkspace(seq.workspace_id)
      const personalizedBody = personalizeHtml(step.body_html, contact)
      const personalizedSig = signatureHtml ? personalizeHtml(signatureHtml, contact) : null
      const bodyWithSignature = injectSignature(personalizedBody, personalizedSig)
      const { html: wrappedHtml, linkMap } = wrapLinks(bodyWithSignature, trackingId, TRACKING_BASE)
      const htmlWithUnsub = addUnsubscribeFooter(wrappedHtml, trackingId, TRACKING_BASE)
      const finalHtml = injectPixel(htmlWithUnsub, trackingId, TRACKING_BASE)
      const personalizedSubject = personalizeText(step.subject, contact)

      // 4e. Insert campaign_recipients row BEFORE sending (for tracking infrastructure)
      // CRITICAL: campaign_id is NULL, sequence_id is set to the enrollment's sequence_id.
      // Migration 008 makes campaign_id nullable and adds sequence_id FK column.
      // The tracking function (t) looks up by tracking_id only (globally unique UUID),
      // so campaign_id is not needed for tracking to work.
      const { data: recipientData, error: recipientError } = await adminClient
        .from('campaign_recipients')
        .insert({
          campaign_id: null,                    // NULL — this is a sequence send, not a campaign send
          sequence_id: enrollment.sequence_id,  // FK to sequences table (added in migration 008)
          contact_id: contact.id,
          workspace_id: seq.workspace_id,
          tracking_id: trackingId,
          status: 'queued',
          variables: linkMap,
        })
        .select('id')
        .single()

      if (recipientError) {
        console.error(`[send-sequence-step] campaign_recipients insert error for enrollment ${enrollment.id}:`, recipientError.message)
        errors++
        continue
      }

      // 4f. Send via Resend (single email, not batch — sequences are per-contact)
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${seq.from_name} <${seq.from_email}>`,
          to: [contact.email],
          subject: personalizedSubject,
          html: finalHtml,
          reply_to: seq.reply_to_email || undefined,
        }),
      })

      if (!resendResponse.ok) {
        const errorText = await resendResponse.text()
        console.error(`[send-sequence-step] Resend error for enrollment ${enrollment.id}: ${resendResponse.status} ${errorText}`)

        // Update recipient status to failed
        await adminClient
          .from('campaign_recipients')
          .update({ status: 'failed' })
          .eq('id', recipientData.id)

        errors++
        continue
      }

      // 4g. Update campaign_recipients with Resend message ID
      const resendData = await resendResponse.json()
      await adminClient
        .from('campaign_recipients')
        .update({
          resend_message_id: resendData.id ?? null,
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', recipientData.id)

      // 4h. Insert sequence_step_sends bridge row (for SEQN-04 per-step stats)
      await adminClient
        .from('sequence_step_sends')
        .insert({
          sequence_enrollment_id: enrollment.id,
          sequence_step_id: step.id,
          campaign_recipient_id: recipientData.id,
          step_number: step.step_number,
          workspace_id: seq.workspace_id,
        })

      // 4i. Advance enrollment: increment current_step, compute next next_send_at
      // Check if there's a next step
      const { data: nextStep } = await adminClient
        .from('sequence_steps')
        .select('delay_days')
        .eq('sequence_id', enrollment.sequence_id)
        .eq('step_number', enrollment.current_step + 1)
        .single()

      if (nextStep) {
        // There IS a next step — advance (per D-03: next_send_at = enrolled_at + delay_days)
        const enrolledAt = new Date(enrollment.enrolled_at)
        const nextSendAt = new Date(enrolledAt.getTime() + nextStep.delay_days * 24 * 60 * 60 * 1000)

        await adminClient
          .from('sequence_enrollments')
          .update({
            current_step: enrollment.current_step + 1,
            next_send_at: nextSendAt.toISOString(),
          })
          .eq('id', enrollment.id)
      } else {
        // No next step — mark enrollment as completed
        await adminClient
          .from('sequence_enrollments')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            current_step: enrollment.current_step + 1,
          })
          .eq('id', enrollment.id)
      }

      processed++

      // Rate limiting between sends — 200ms delay (lower than batch since single emails)
      if (processed < dueEnrollments.length) {
        await new Promise((resolve) => setTimeout(resolve, 200))
      }
    }

    // 5. Return summary
    return new Response(JSON.stringify({
      ok: true,
      processed,
      skipped,
      errors,
      total: dueEnrollments.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[send-sequence-step] unhandled error:', (err as Error).message)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
