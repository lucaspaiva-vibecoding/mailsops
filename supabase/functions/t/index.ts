import { Hono } from 'jsr:@hono/hono'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Service-role client — bypasses RLS for anonymous tracking hits (D-06)
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

// 1×1 transparent PNG (68 bytes) — returned for all open pixel requests
const PIXEL_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
const PIXEL_BYTES = Uint8Array.from(atob(PIXEL_B64), (c) => c.charCodeAt(0))

// UUID v4 regex for validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Look up a campaign_recipient row by tracking_id.
 * Returns contact_id, campaign_id, and link_map.
 */
async function getRecipient(trackingId: string) {
  const { data } = await supabase
    .from('campaign_recipients')
    .select('contact_id, campaign_id, link_map')
    .eq('tracking_id', trackingId)
    .single()
  return data
}

/**
 * Increment a numeric counter column on the campaigns row.
 * Fetches current value then updates — avoids needing a custom RPC function.
 */
async function incrementCampaignCounter(campaignId: string, field: string) {
  const { data: campaign } = await supabase
    .from('campaigns')
    .select(field)
    .eq('id', campaignId)
    .single()
  if (campaign) {
    await supabase
      .from('campaigns')
      .update({ [field]: (campaign as Record<string, number>)[field] + 1 })
      .eq('id', campaignId)
  }
}

// ── Router ───────────────────────────────────────────────────────────────────

const app = new Hono().basePath('/t')

// ── Route 1: Open Pixel (D-02, DELV-04) ─────────────────────────────────────
// Email clients embed <img src="/t/pixel/{trackingId}"> — load signals an open.
// Always returns the PNG so email rendering is never broken by DB errors.

app.get('/pixel/:trackingId', async (c) => {
  const trackingId = c.req.param('trackingId')
  const isValidUUID = UUID_REGEX.test(trackingId)

  if (isValidUUID) {
    try {
      // Insert open event — fire before returning pixel
      await supabase.from('tracking_events').insert({
        tracking_id: trackingId,
        event_type: 'open',
        occurred_at: new Date().toISOString(),
        user_agent: c.req.header('User-Agent') ?? null,
      })

      // Check if this is the first open for this tracking_id (count === 1)
      const { count } = await supabase
        .from('tracking_events')
        .select('*', { count: 'exact', head: true })
        .eq('tracking_id', trackingId)
        .eq('event_type', 'open')

      if (count === 1) {
        // First open — increment the campaign's total_opened counter
        const recipient = await getRecipient(trackingId)
        if (recipient?.campaign_id) {
          await incrementCampaignCounter(recipient.campaign_id, 'total_opened')
        }
      }
    } catch {
      // DB errors must not break email rendering — return pixel regardless
    }
  }

  return new Response(PIXEL_BYTES, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    },
  })
})

// ── Route 2: Click Redirect (D-03, DELV-05) ──────────────────────────────────
// Logs the click event then 302-redirects to the original URL from the DB.
// Security: redirect URL always comes from link_map in the DB — never from
// query params or request body (prevents open redirect, T-03-08).

app.get('/click/:trackingId/:linkIndex', async (c) => {
  const trackingId = c.req.param('trackingId')
  const linkIndex = c.req.param('linkIndex')

  if (!UUID_REGEX.test(trackingId)) {
    return new Response('Invalid tracking link', { status: 400 })
  }

  const recipient = await getRecipient(trackingId)
  const originalUrl = recipient?.link_map?.[linkIndex]

  if (!recipient || !originalUrl) {
    return new Response('Invalid tracking link', { status: 400 })
  }

  // Log click event (best-effort — don't block the redirect)
  try {
    await supabase.from('tracking_events').insert({
      tracking_id: trackingId,
      event_type: 'click',
      link_index: parseInt(linkIndex, 10),
      link_url: originalUrl,
      occurred_at: new Date().toISOString(),
      user_agent: c.req.header('User-Agent') ?? null,
    })

    if (recipient.campaign_id) {
      await incrementCampaignCounter(recipient.campaign_id, 'total_clicked')
    }
  } catch {
    // DB errors must not block the redirect — recipient still gets to the URL
  }

  return Response.redirect(originalUrl, 302)
})

// ── Route 3: Unsubscribe (D-04, DELV-06) ─────────────────────────────────────
// Marks the contact as unsubscribed and returns an HTML confirmation page.

app.get('/unsub/:trackingId', async (c) => {
  const trackingId = c.req.param('trackingId')

  const invalidHtml = (message: string) =>
    new Response(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Error</title></head><body><p>${message}</p></body></html>`,
      { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )

  if (!UUID_REGEX.test(trackingId)) {
    return invalidHtml('Invalid unsubscribe link.')
  }

  const recipient = await getRecipient(trackingId)

  if (!recipient) {
    return invalidHtml('Invalid unsubscribe link.')
  }

  // Update contact status to unsubscribed
  await supabase
    .from('contacts')
    .update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
    .eq('id', recipient.contact_id)

  // Log the unsubscribe event
  try {
    await supabase.from('tracking_events').insert({
      tracking_id: trackingId,
      event_type: 'unsubscribe',
      occurred_at: new Date().toISOString(),
      user_agent: c.req.header('User-Agent') ?? null,
    })
  } catch {
    // Event logging failure must not block the unsubscribe confirmation
  }

  // Increment campaign's total_unsubscribed counter
  if (recipient.campaign_id) {
    await incrementCampaignCounter(recipient.campaign_id, 'total_unsubscribed')
  }

  return new Response(
    `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Unsubscribed</title>
<style>body{font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f9fafb;color:#111827}
.card{text-align:center;padding:2rem;border-radius:0.5rem;background:white;box-shadow:0 1px 3px rgba(0,0,0,0.1)}</style>
</head><body><div class="card"><h1>Unsubscribed</h1><p>You have been successfully unsubscribed and will no longer receive emails from us.</p></div></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
})

Deno.serve(app.fetch)
