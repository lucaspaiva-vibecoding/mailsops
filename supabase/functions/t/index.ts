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
 * Returns the row ID (for campaign_events FK), contact_id, campaign_id,
 * workspace_id, and opened_at/clicked_at for first-event checks.
 */
async function getRecipient(trackingId: string) {
  const { data, error } = await supabase
    .from('campaign_recipients')
    .select('id, contact_id, campaign_id, workspace_id, opened_at, clicked_at')
    .eq('tracking_id', trackingId)
    .single()
  if (error) {
    console.error('[getRecipient] lookup error:', error.message)
  }
  return data
}

/**
 * Look up the original URL for a click redirect from campaign_links.
 * Returns the campaign_links row (id, original_url, click_count, unique_clicks).
 */
async function getCampaignLink(campaignId: string, linkIndex: number) {
  const { data, error } = await supabase
    .from('campaign_links')
    .select('id, original_url, click_count, unique_clicks')
    .eq('campaign_id', campaignId)
    .eq('link_index', linkIndex)
    .single()
  if (error) {
    console.error('[getCampaignLink] lookup error:', error.message)
  }
  return data
}

/**
 * Increment a numeric counter column on the campaigns row.
 * Fetches current value then updates — avoids needing a custom RPC function.
 */
async function incrementCampaignCounter(campaignId: string, field: string) {
  const { data: campaign, error } = await supabase
    .from('campaigns')
    .select(field)
    .eq('id', campaignId)
    .single()
  if (error) {
    console.error(`[incrementCampaignCounter] fetch error for field ${field}:`, error.message)
    return
  }
  if (campaign) {
    const { error: updateError } = await supabase
      .from('campaigns')
      .update({ [field]: (campaign as Record<string, number>)[field] + 1 })
      .eq('id', campaignId)
    if (updateError) {
      console.error(`[incrementCampaignCounter] update error for field ${field}:`, updateError.message)
    }
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
      const recipient = await getRecipient(trackingId)

      if (recipient) {
        const now = new Date().toISOString()

        // Insert open event into campaign_events
        const { error: insertError } = await supabase.from('campaign_events').insert({
          campaign_id: recipient.campaign_id,
          recipient_id: recipient.id,
          workspace_id: recipient.workspace_id,
          event_type: 'opened',
          user_agent: c.req.header('User-Agent') ?? null,
        })
        if (insertError) {
          console.error('[pixel] insert campaign_events error:', insertError.message)
        }

        // Update recipient.opened_at only on the first open
        if (!recipient.opened_at) {
          const { error: recipientUpdateError } = await supabase
            .from('campaign_recipients')
            .update({ opened_at: now, status: 'opened' })
            .eq('id', recipient.id)
          if (recipientUpdateError) {
            console.error('[pixel] update campaign_recipients error:', recipientUpdateError.message)
          }

          // First open — increment the campaign's total_opened counter
          await incrementCampaignCounter(recipient.campaign_id, 'total_opened')
        }
      }
    } catch (err) {
      // DB errors must not break email rendering — return pixel regardless
      console.error('[pixel] unexpected error:', (err as Error).message)
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
// Logs the click event then 302-redirects to the original URL from campaign_links.
// Security: redirect URL always comes from campaign_links in the DB — never from
// query params or request body (prevents open redirect, T-03-08).

app.get('/click/:trackingId/:linkIndex', async (c) => {
  const trackingId = c.req.param('trackingId')
  const linkIndexStr = c.req.param('linkIndex')
  const linkIndex = parseInt(linkIndexStr, 10)

  if (!UUID_REGEX.test(trackingId) || isNaN(linkIndex)) {
    return new Response('Invalid tracking link', { status: 400 })
  }

  const recipient = await getRecipient(trackingId)

  if (!recipient) {
    return new Response('Invalid tracking link', { status: 400 })
  }

  // Look up the original URL from campaign_links (never from request params)
  const campaignLink = await getCampaignLink(recipient.campaign_id, linkIndex)

  let originalUrl: string

  if (campaignLink) {
    originalUrl = campaignLink.original_url
  } else {
    // Fallback: check campaign_recipients.variables JSONB (used by csv_personalized)
    const { data: recipientRow, error: recipientError } = await supabase
      .from('campaign_recipients')
      .select('variables')
      .eq('id', recipient.id)
      .single()

    if (recipientError || !recipientRow) {
      console.error(`[click] No campaign_links or recipient variables for campaign=${recipient.campaign_id} link_index=${linkIndex}`)
      return new Response('Invalid tracking link', { status: 400 })
    }

    const variables = recipientRow.variables as Record<string, string> | null
    const fallbackUrl = variables?.[String(linkIndex)]

    if (!fallbackUrl) {
      console.error(`[click] No URL found in variables for link_index=${linkIndex}, recipient=${recipient.id}`)
      return new Response('Invalid tracking link', { status: 400 })
    }

    originalUrl = fallbackUrl
  }

  // Log click event and update counters (best-effort — don't block the redirect)
  try {
    const now = new Date().toISOString()

    // Insert clicked event into campaign_events
    const { error: insertError } = await supabase.from('campaign_events').insert({
      campaign_id: recipient.campaign_id,
      recipient_id: recipient.id,
      workspace_id: recipient.workspace_id,
      event_type: 'clicked',
      link_index: linkIndex,
      link_url: originalUrl,
      user_agent: c.req.header('User-Agent') ?? null,
    })
    if (insertError) {
      console.error('[click] insert campaign_events error:', insertError.message)
    }

    // Determine if this is the first click from this recipient (for unique_clicks)
    const isFirstClick = !recipient.clicked_at

    // Update recipient.clicked_at on first click
    if (isFirstClick) {
      const { error: recipientUpdateError } = await supabase
        .from('campaign_recipients')
        .update({ clicked_at: now, status: 'clicked' })
        .eq('id', recipient.id)
      if (recipientUpdateError) {
        console.error('[click] update campaign_recipients error:', recipientUpdateError.message)
      }

      // Increment campaign total_clicked counter on first click
      await incrementCampaignCounter(recipient.campaign_id, 'total_clicked')
    }

    // Increment campaign_links counters (only when campaign_links row exists)
    if (campaignLink) {
      const updatedClickCount = campaignLink.click_count + 1
      const updatedUniqueClicks = isFirstClick
        ? campaignLink.unique_clicks + 1
        : campaignLink.unique_clicks

      const { error: linkUpdateError } = await supabase
        .from('campaign_links')
        .update({ click_count: updatedClickCount, unique_clicks: updatedUniqueClicks })
        .eq('id', campaignLink.id)
      if (linkUpdateError) {
        console.error('[click] update campaign_links error:', linkUpdateError.message)
      }
    }
  } catch (err) {
    // DB errors must not block the redirect — recipient still gets to the URL
    console.error('[click] unexpected error:', (err as Error).message)
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
  const { error: contactUpdateError } = await supabase
    .from('contacts')
    .update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
    .eq('id', recipient.contact_id)
  if (contactUpdateError) {
    console.error('[unsub] update contacts error:', contactUpdateError.message)
  }

  // Update recipient status and timestamp
  const { error: recipientUpdateError } = await supabase
    .from('campaign_recipients')
    .update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
    .eq('id', recipient.id)
  if (recipientUpdateError) {
    console.error('[unsub] update campaign_recipients error:', recipientUpdateError.message)
  }

  // Log the unsubscribe event into campaign_events
  try {
    const { error: insertError } = await supabase.from('campaign_events').insert({
      campaign_id: recipient.campaign_id,
      recipient_id: recipient.id,
      workspace_id: recipient.workspace_id,
      event_type: 'unsubscribed',
      user_agent: c.req.header('User-Agent') ?? null,
    })
    if (insertError) {
      console.error('[unsub] insert campaign_events error:', insertError.message)
    }
  } catch (err) {
    // Event logging failure must not block the unsubscribe confirmation
    console.error('[unsub] unexpected error:', (err as Error).message)
  }

  // Increment campaign's total_unsubscribed counter
  await incrementCampaignCounter(recipient.campaign_id, 'total_unsubscribed')

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
