import { Webhook } from 'npm:svix'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Service-role client — bypasses RLS, required for webhook operations
// (no authenticated user in incoming webhook requests)
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

// Maps Resend event type to campaign_recipients.delivery_status value
const statusMap: Record<string, string> = {
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
}

// Maps Resend event type to campaigns aggregate counter column
const counterMap: Record<string, string> = {
  'email.delivered': 'total_delivered',
  'email.bounced': 'total_bounced',
  'email.complained': 'total_unsubscribed',
}

Deno.serve(async (req) => {
  // Only accept POST — all Resend webhook deliveries use POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    // CRITICAL: Read raw body BEFORE any parsing.
    // JSON re-serialization breaks the HMAC-SHA256 signature (T-03-16).
    const payload = await req.text()

    // Extract Svix headers required for signature verification
    const svixHeaders = {
      'svix-id': req.headers.get('svix-id') ?? '',
      'svix-timestamp': req.headers.get('svix-timestamp') ?? '',
      'svix-signature': req.headers.get('svix-signature') ?? '',
    }

    // Verify Svix HMAC-SHA256 signature (T-03-14, T-03-15)
    // wh.verify() performs constant-time comparison and enforces 5-minute
    // timestamp window to prevent replay attacks (T-03-15).
    const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET') ?? ''
    const wh = new Webhook(webhookSecret)

    let event: {
      type: string
      created_at: string
      data: {
        email_id: string
        bounce?: { type: string; message?: string }
      }
    }

    try {
      event = wh.verify(payload, svixHeaders) as typeof event
    } catch {
      // Return 400 so Resend retries with correct signature — do NOT return 200
      // (a 200 would make Resend consider the delivery successful and stop retrying)
      return new Response('Invalid signature', { status: 400 })
    }

    // Map event type to delivery status
    const newStatus = statusMap[event.type]
    if (!newStatus) {
      // Unhandled event type (e.g. email.opened, email.clicked) — acknowledge to
      // prevent unnecessary retries without processing anything
      return new Response('ok', { status: 200 })
    }

    // Locate the recipient row using the Resend email ID stored at send time
    const { data: recipient } = await supabase
      .from('campaign_recipients')
      .select('id, campaign_id, contact_id, delivery_status')
      .eq('resend_email_id', event.data.email_id)
      .single()

    if (!recipient) {
      // No matching recipient — may be from a test send (send-test-email does not
      // insert a campaign_recipient row). Acknowledge to prevent retries.
      return new Response('ok', { status: 200 })
    }

    // Build the update payload for campaign_recipients
    const updatePayload: Record<string, string> = {
      delivery_status: newStatus,
    }

    if (event.type === 'email.delivered') {
      updatePayload.delivered_at = event.created_at
    } else if (event.type === 'email.bounced') {
      updatePayload.bounced_at = event.created_at
    }

    await supabase
      .from('campaign_recipients')
      .update(updatePayload)
      .eq('id', recipient.id)

    // Update contact status for events that affect future deliverability
    if (event.type === 'email.bounced') {
      await supabase
        .from('contacts')
        .update({
          status: 'bounced',
          bounce_type: event.data.bounce?.type === 'Permanent' ? 'hard' : 'soft',
          bounced_at: event.created_at,
        })
        .eq('id', recipient.contact_id)
    }

    if (event.type === 'email.complained') {
      await supabase
        .from('contacts')
        .update({ status: 'complained' })
        .eq('id', recipient.contact_id)
    }

    // Increment the campaign's aggregate delivery counter
    const counterField = counterMap[event.type]
    if (counterField) {
      const { data: campaign } = await supabase
        .from('campaigns')
        .select(`id, ${counterField}`)
        .eq('id', recipient.campaign_id)
        .single()

      if (campaign) {
        await supabase
          .from('campaigns')
          .update({ [counterField]: (campaign as Record<string, number>)[counterField] + 1 })
          .eq('id', recipient.campaign_id)
      }
    }

    return new Response('ok', { status: 200 })
  } catch (err) {
    // Return 500 so Resend will retry the delivery
    return new Response((err as Error).message, { status: 500 })
  }
})
