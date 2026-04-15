# Phase 3: Email Delivery Engine - Research

**Researched:** 2026-04-13
**Domain:** Supabase Edge Functions + Resend API + Email tracking (open/click/unsubscribe/webhook)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01: Delivery Architecture**
- Supabase Edge Function handles all campaign sends — it calls the Resend API
- Emails are batched with rate limiting to respect Resend free tier (100 emails/day)
- Edge Function, not the browser, orchestrates sends (keeps API key server-side)

**D-02: Open Tracking**
- Tracking pixel: Edge Function at `/t/pixel/{tracking_id}` returns a 1x1 transparent PNG
- On pixel load, the function logs the open event to the database
- `tracking_id` is unique per recipient per campaign

**D-03: Click Tracking**
- Edge Function at `/t/click/{tracking_id}/{link_index}` handles click redirects
- Logs the click event (tracking_id + link_index) to the database
- 302 redirects the recipient to the original URL after logging

**D-04: Unsubscribe**
- Edge Function at `/t/unsub/{tracking_id}` processes unsubscribes
- Marks the contact as unsubscribed in the database
- Renders a confirmation page (not just a redirect) to acknowledge the action

**D-05: Resend Webhooks**
- Edge Function receives Resend webhook events: `email.delivered`, `email.bounced`, `email.complained`
- Updates `campaign_recipients` table with per-recipient delivery status
- Also updates aggregate campaign stats (counters on campaigns table)

**D-06: Edge Function Auth**
- All tracking/webhook Edge Functions use the `service_role` key (not RLS)
- Required because tracking hits come from anonymous email clients (no session)
- Resend webhook verification (signature check) used to protect the webhook endpoint

### Claude's Discretion
- Email HTML generation: how links are wrapped and pixel is injected before calling Resend
- Exactly which DB columns to update per event type (should align with existing schema)
- Batching strategy: concurrency limit, delay between batches, error retry logic
- Tracking URL base (probably SUPABASE_URL + /functions/v1)
- Campaign send status state machine (queued → sending → sent)

### Deferred Ideas (OUT OF SCOPE)
- A/B testing (Module 7 — separate phase)
- Drip sequences / scheduled sends (Module 8)
- Reply tracking (not in DELV requirements)
- Advanced retry logic / dead-letter queue for failed sends
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DELV-01 | User can send a campaign to all active contacts in the target list via Resend API | Resend batch API (up to 100/call), Edge Function send-campaign pattern, service_role client |
| DELV-02 | System wraps all links in campaign body with tracking redirect URLs before sending | HTML link regex replacement, tracking URL pattern `/t/click/{tracking_id}/{link_index}` |
| DELV-03 | System embeds a 1x1 transparent tracking pixel in every campaign email | 1x1 PNG served from Edge Function `/t/pixel/{tracking_id}`, injected before `</body>` |
| DELV-04 | Open events are recorded via Supabase Edge Function when pixel loads | `/t/pixel/{tracking_id}` Edge Function — logs to `tracking_events`, no-verify-jwt |
| DELV-05 | Click events are recorded and recipient is redirected to the original URL | `/t/click/{tracking_id}/{link_index}` — logs event, 302 redirect, no-verify-jwt |
| DELV-06 | Contacts who load the unsubscribe URL are marked as unsubscribed automatically | `/t/unsub/{tracking_id}` — updates contact status, renders HTML confirmation |
| DELV-07 | Resend webhooks update delivered/bounced status for each recipient | Webhook Edge Function with Svix signature verification, updates campaign_recipients |
</phase_requirements>

---

## Summary

Phase 3 requires four new Supabase Edge Functions (send-campaign, tracking router, and webhook handler) plus two database migrations (campaign_recipients table and tracking_events table). The existing `send-test-email` Edge Function establishes the correct pattern: Deno.serve, service_role client, and direct Resend API calls via fetch.

The Resend free tier imposes a **100 emails/day hard limit** (not 100/month as sometimes stated). With the Resend batch API accepting up to 100 emails per call at 5 requests/second, the entire daily quota could be exhausted in a single batch call. The send-campaign function must guard against this by tracking send counts and soft-stopping at the limit. Webhook verification uses the Svix library (which Resend bundles) and requires reading the raw request body — never re-parsing JSON before verification.

The three tracking endpoints (pixel, click, unsub) must have JWT verification disabled via `supabase/config.toml`, because email clients hitting a pixel URL carry no auth tokens. All tracking functions use a `service_role` Supabase client to write events directly, bypassing RLS. The tracking URL base is `{SUPABASE_URL}/functions/v1/t/...` with the `t` function name as the router.

**Primary recommendation:** Implement all tracking endpoints as routes inside a single `t` Edge Function using Hono's `basePath('/t')` pattern — avoids cold-start multiplication and aligns with Supabase's official multi-route recommendation.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Deno (built-in) | Supabase runtime | Edge Function runtime | Auto-provided by Supabase |
| `@supabase/supabase-js` | 2 (via esm.sh) | Supabase client in Edge Functions | Already used in send-test-email |
| `jsr:@hono/hono` | latest via JSR | Multi-route router in single Edge Function | Official Supabase docs recommendation |
| `svix` | npm:svix | Resend webhook signature verification | Resend uses Svix under the hood — official approach |
| Resend REST API | — | Email delivery | Direct fetch calls, no SDK required (matches existing pattern) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `npm:svix` | via Deno npm specifier | Webhook HMAC verification | Webhook handler function only |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hono router | Manual pathname parsing | Manual is fine for 3 routes but Hono gives typed params and is the documented pattern |
| Svix library | Manual HMAC-SHA256 | Manual works but Svix handles timestamp window + constant-time comparison correctly |
| 4 separate Edge Functions | Single `t` router | Separate functions = 4x cold starts; single router = 1 cold start for all tracking |

**Installation (Deno-side — no npm install needed):**
These are imported via URL/JSR specifiers in the Edge Function source:
```
import { Hono } from 'jsr:@hono/hono'
import { Webhook } from 'npm:svix'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
```

---

## Architecture Patterns

### Recommended Project Structure
```
supabase/
├── config.toml                  # NEW: per-function JWT config
├── functions/
│   ├── send-test-email/         # EXISTS: Phase 2 test email function
│   │   └── index.ts
│   ├── send-campaign/           # NEW: DELV-01 campaign send orchestrator
│   │   └── index.ts
│   ├── t/                       # NEW: DELV-02..06 tracking router (pixel/click/unsub)
│   │   └── index.ts
│   └── resend-webhook/          # NEW: DELV-07 Resend event receiver
│       └── index.ts
├── migrations/
│   ├── 001_contact_import_logs.sql      # EXISTS
│   ├── 002_contact_list_count_trigger.sql  # EXISTS
│   ├── 003_contact_list_members_rls.sql    # EXISTS
│   ├── 004_campaign_recipients.sql      # NEW: per-recipient delivery tracking
│   └── 005_tracking_events.sql          # NEW: open/click event log
```

### Pattern 1: Deno.serve with Hono Multi-Route (Tracking Router)
**What:** All tracking endpoints live in one `supabase/functions/t/index.ts` function using Hono's `basePath`
**When to use:** When a single function needs to serve multiple URL patterns with path parameters
**Example:**
```typescript
// Source: https://supabase.com/docs/guides/functions/routing
import { Hono } from 'jsr:@hono/hono'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const app = new Hono().basePath('/t')

// Service-role client — bypasses RLS, safe in Edge Function because
// no user credentials are exposed; function is the only caller
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

// DELV-04: Open pixel
app.get('/pixel/:trackingId', async (c) => {
  const trackingId = c.req.param('trackingId')
  await supabase.from('tracking_events').insert({
    tracking_id: trackingId,
    event_type: 'open',
    occurred_at: new Date().toISOString(),
  })
  // Smallest transparent PNG — 68 bytes
  const pixel = Uint8Array.from(atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
  ), c => c.charCodeAt(0))
  return new Response(pixel, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    },
  })
})

// DELV-05: Click redirect
app.get('/click/:trackingId/:linkIndex', async (c) => {
  const { trackingId, linkIndex } = c.req.param()
  // Fetch original URL from campaign_recipients.link_map
  const { data } = await supabase
    .from('campaign_recipients')
    .select('link_map')
    .eq('tracking_id', trackingId)
    .single()
  const originalUrl = data?.link_map?.[linkIndex]
  await supabase.from('tracking_events').insert({
    tracking_id: trackingId,
    event_type: 'click',
    link_index: parseInt(linkIndex),
    occurred_at: new Date().toISOString(),
  })
  return Response.redirect(originalUrl ?? 'https://example.com', 302)
})

// DELV-06: Unsubscribe
app.get('/unsub/:trackingId', async (c) => {
  const trackingId = c.req.param('trackingId')
  const { data: recipient } = await supabase
    .from('campaign_recipients')
    .select('contact_id')
    .eq('tracking_id', trackingId)
    .single()
  if (recipient) {
    await supabase.from('contacts')
      .update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
      .eq('id', recipient.contact_id)
  }
  return new Response('<html><body><h1>You have been unsubscribed.</h1></body></html>', {
    headers: { 'Content-Type': 'text/html' },
  })
})

Deno.serve(app.fetch)
```

### Pattern 2: Campaign Send Orchestrator (send-campaign)
**What:** JWT-authenticated function called from React UI to initiate campaign delivery
**When to use:** DELV-01 — triggered by user clicking "Send Campaign" button
**Example:**
```typescript
// Source: [ASSUMED] — adapted from existing send-test-email pattern
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const TRACKING_BASE = `${SUPABASE_URL}/functions/v1/t`

Deno.serve(async (req) => {
  // 1. Verify user JWT (keep API key server-side)
  const authHeader = req.headers.get('Authorization')
  const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader ?? '' } } })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  // 2. Admin client to bypass RLS for bulk operations
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  const { campaign_id } = await req.json()

  // 3. Load campaign + contact list
  const { data: campaign } = await adminClient
    .from('campaigns').select('*').eq('id', campaign_id).single()

  const { data: contacts } = await adminClient
    .from('contact_list_members')
    .select('contacts(*)')
    .eq('contact_list_id', campaign.contact_list_id)

  const active = contacts?.map(m => m.contacts).filter(c => c.status === 'active') ?? []

  // 4. Update campaign status to sending
  await adminClient.from('campaigns')
    .update({ status: 'sending', sent_at: new Date().toISOString(), total_recipients: active.length })
    .eq('id', campaign_id)

  // 5. Build recipient rows + send in batches of 50 (leaves headroom below 100/day limit)
  const BATCH_SIZE = 50
  for (let i = 0; i < active.length; i += BATCH_SIZE) {
    const batch = active.slice(i, i + BATCH_SIZE)
    const emails = batch.map(contact => {
      const trackingId = crypto.randomUUID()
      // Store recipient record first so tracking_id resolves later
      // (insert happens before send for referential integrity)
      return { contact, trackingId }
    })

    // Insert campaign_recipients in bulk
    await adminClient.from('campaign_recipients').insert(
      emails.map(({ contact, trackingId }) => ({
        campaign_id,
        contact_id: contact.id,
        tracking_id: trackingId,
        status: 'queued',
      }))
    )

    // Build + send batch via Resend
    const resendBatch = emails.map(({ contact, trackingId }) => {
      const html = injectTracking(campaign.body_html, trackingId, TRACKING_BASE)
      return {
        from: `${campaign.from_name} <${campaign.from_email}>`,
        to: [contact.email],
        subject: personalizeSubject(campaign.subject, contact),
        html,
      }
    })

    await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(resendBatch),
    })

    // Rate limit: 5 req/sec max on Resend, 100 emails/day hard cap
    // Add delay between batches for free tier safety
    if (i + BATCH_SIZE < active.length) {
      await new Promise(resolve => setTimeout(resolve, 300))
    }
  }

  // 6. Mark campaign as sent
  await adminClient.from('campaigns').update({ status: 'sent', total_sent: active.length }).eq('id', campaign_id)

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
})
```

### Pattern 3: HTML Pre-Send Processing (inject tracking)
**What:** Before calling Resend, transform the campaign HTML: wrap links and inject pixel
**When to use:** Called inside send-campaign for each recipient's personalized HTML
**Example:**
```typescript
// Source: [ASSUMED] — standard email HTML transformation pattern
function injectTracking(html: string, trackingId: string, baseUrl: string): string {
  let linkIndex = 0
  // Wrap all <a href="..."> links — skip mailto: and unsubscribe links already processed
  const wrappedHtml = html.replace(
    /href="(https?:\/\/[^"]+)"/g,
    (_, originalUrl) => {
      const encodedUrl = encodeURIComponent(originalUrl)
      const trackUrl = `${baseUrl}/click/${trackingId}/${linkIndex++}`
      return `href="${trackUrl}"`
    }
  )
  // Inject tracking pixel before </body>
  const pixel = `<img src="${baseUrl}/pixel/${trackingId}" width="1" height="1" style="display:none" alt="" />`
  return wrappedHtml.replace('</body>', `${pixel}</body>`)
}

function personalizeSubject(subject: string, contact: Contact): string {
  return subject
    .replace(/\{\{first_name\}\}/g, contact.first_name ?? '')
    .replace(/\{\{last_name\}\}/g, contact.last_name ?? '')
    .replace(/\{\{company\}\}/g, contact.company ?? '')
}
```

**Critical:** Personalization must happen BEFORE link wrapping so `{{first_name}}` in hrefs resolves correctly before the regex replaces them.

### Pattern 4: Resend Webhook Handler
**What:** Receives Resend delivery events and updates database
**When to use:** DELV-07 — Resend calls this endpoint on delivery outcomes
**Example:**
```typescript
// Source: https://resend.com/docs/dashboard/webhooks/verify-webhooks-requests
import { Webhook } from 'npm:svix'

Deno.serve(async (req) => {
  const payload = await req.text()  // RAW body — must not parse before verify
  const headers = {
    'svix-id': req.headers.get('svix-id') ?? '',
    'svix-timestamp': req.headers.get('svix-timestamp') ?? '',
    'svix-signature': req.headers.get('svix-signature') ?? '',
  }

  const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET') ?? ''
  const wh = new Webhook(webhookSecret)
  let event: { type: string; data: ResendEmailEvent }

  try {
    event = wh.verify(payload, headers) as typeof event
  } catch {
    return new Response('Invalid signature', { status: 400 })
  }

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const { type, data } = event
  // Match recipient by resend email_id stored at send time
  // OR match by email address + campaign context
  const statusMap: Record<string, string> = {
    'email.delivered': 'delivered',
    'email.bounced': 'bounced',
    'email.complained': 'complained',
  }

  const recipientStatus = statusMap[type]
  if (recipientStatus) {
    await adminClient.from('campaign_recipients')
      .update({ delivery_status: recipientStatus, delivered_at: event.data.created_at })
      .eq('resend_email_id', data.email_id)

    // Update campaign aggregate counters
    const counterField = {
      'email.delivered': 'total_delivered',
      'email.bounced': 'total_bounced',
      'email.complained': 'total_unsubscribed',
    }[type]

    if (counterField) {
      await adminClient.rpc('increment_campaign_counter', {
        p_email_id: data.email_id,
        p_field: counterField,
      })
    }
  }

  return new Response('ok')
})
```

### Pattern 5: config.toml JWT Bypass
**What:** Per-function JWT configuration so tracking endpoints accept anonymous hits
**When to use:** Required for pixel/click/unsub endpoints — email clients have no JWT
**Example:**
```toml
# supabase/config.toml
# Source: https://supabase.com/docs/guides/functions/function-configuration

[functions.t]
verify_jwt = false

[functions.resend-webhook]
verify_jwt = false

# send-campaign and send-test-email keep JWT verification ON (user-triggered)
```

### Anti-Patterns to Avoid
- **Separate Edge Functions per tracking endpoint:** Creates 3x cold starts for pixel/click/unsub — use one `t` router instead
- **Using `anon` key in tracking Edge Functions:** Tracking functions need to write events with no user session — must use service_role
- **Parsing webhook body as JSON before Svix verification:** Svix verifies the raw bytes; re-serializing breaks the HMAC signature
- **Wrapping links AFTER personalization variable replacement:** `{{first_name}}` inside an href would get wrapped with the literal variable name — wrap links first on the template, or personalize before wrapping
- **Using `import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'`:** Deprecated pattern — existing `send-test-email` uses this but new functions should use `Deno.serve` [CITED: https://supabase.com/docs/guides/getting-started/ai-prompts/edge-functions]
- **Not storing `resend_email_id` in campaign_recipients at send time:** The webhook payload identifies emails by `email_id` — without storing this at send time, webhook events cannot be matched to recipients

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Webhook HMAC signature verification | Custom SHA-256 HMAC code | `npm:svix` Webhook class | Timing attacks, timestamp window, constant-time comparison — all handled |
| HTTP routing inside Edge Function | `if (pathname === '/t/pixel/...')` conditionals | Hono `basePath` + `app.get` | Typed params, middleware support, Supabase-recommended approach |
| Email send rate limiting | Custom token bucket algorithm | Simple batch size + setTimeout delay | Free tier is 100/day so simple delay + batch count is sufficient |

**Key insight:** The tracking URL infrastructure is the main novel work. Resend sends email; Svix verifies webhooks; Hono routes requests. The custom logic is: link wrapping regex, pixel injection, and the DB schema design.

---

## Database Schema Requirements

### New Tables Needed

#### `campaign_recipients` (Migration 004)
Per-recipient delivery record — one row per contact per campaign.

```sql
CREATE TABLE public.campaign_recipients (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id       UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id        UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  tracking_id       UUID NOT NULL UNIQUE,   -- used in pixel/click/unsub URLs
  resend_email_id   TEXT,                   -- returned by Resend at send time, used for webhook matching
  delivery_status   TEXT NOT NULL DEFAULT 'queued',  -- queued | sent | delivered | bounced | complained
  link_map          JSONB,                  -- { "0": "https://...", "1": "https://..." } original URLs
  sent_at           TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  bounced_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaign_recipients_campaign ON campaign_recipients(campaign_id);
CREATE INDEX idx_campaign_recipients_tracking ON campaign_recipients(tracking_id);
CREATE INDEX idx_campaign_recipients_resend_id ON campaign_recipients(resend_email_id);

ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;
-- RLS policies: workspace users can SELECT their own campaign recipients
-- Edge Functions use service_role and bypass RLS entirely
```

#### `tracking_events` (Migration 005)
Append-only log of open and click events.

```sql
CREATE TABLE public.tracking_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_id   UUID NOT NULL,  -- FK to campaign_recipients.tracking_id
  event_type    TEXT NOT NULL,  -- 'open' | 'click'
  link_index    INT,            -- only for click events
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_agent    TEXT,           -- optional: from request headers for client detection
  ip_address    INET            -- optional: for dedup of Apple Mail proxy opens
);

CREATE INDEX idx_tracking_events_tracking_id ON tracking_events(tracking_id);
CREATE INDEX idx_tracking_events_type ON tracking_events(event_type);

ALTER TABLE tracking_events ENABLE ROW LEVEL SECURITY;
-- No direct user policies needed — written exclusively via service_role in Edge Functions
-- Analytics queries will go through campaigns/campaign_recipients JOIN path
```

### Existing Schema Alignment
The `campaigns` table in `src/types/database.ts` already has these counter columns that Phase 3 will populate:
- `total_recipients` — set at campaign launch
- `total_sent` — incremented as emails are sent
- `total_delivered` — incremented by webhook
- `total_opened` — incremented by pixel hits (via trigger or Edge Function)
- `total_clicked` — incremented by click hits
- `total_bounced` — incremented by webhook
- `total_unsubscribed` — incremented by unsub hits

The `contacts` table already has `status: 'active' | 'unsubscribed' | 'bounced' | 'complained'` and `unsubscribed_at`, `bounced_at` — DELV-06 writes `status='unsubscribed'` + `unsubscribed_at` directly.

### New TypeScript Types Needed
```typescript
// src/types/database.ts additions

export type RecipientStatus = 'queued' | 'sent' | 'delivered' | 'bounced' | 'complained'

export interface CampaignRecipient {
  id: string
  campaign_id: string
  contact_id: string
  tracking_id: string
  resend_email_id: string | null
  delivery_status: RecipientStatus
  link_map: Record<string, string> | null
  sent_at: string | null
  delivered_at: string | null
  bounced_at: string | null
  created_at: string
}

export interface TrackingEvent {
  id: string
  tracking_id: string
  event_type: 'open' | 'click'
  link_index: number | null
  occurred_at: string
  user_agent: string | null
  ip_address: string | null
}
```

---

## Resend API Facts

### Rate Limits and Quotas [VERIFIED: resend.com/docs/knowledge-base/account-quotas-and-limits]
- **Free tier daily hard limit: 100 emails/day** (both sent AND received count)
- **Free tier monthly: 3,000 emails/month**
- **Rate limit: 5 requests/second** across the whole team (not per key)
- A 6th request in the same second returns HTTP 429
- Batch API: up to **100 emails per batch call**

### Batch API [VERIFIED: resend.com/docs/api-reference/emails/send-batch-emails]
- **Endpoint:** `POST https://api.resend.com/emails/batch`
- **Request:** JSON array of email objects
- **Response:** `{ "data": [{ "id": "uuid" }, ...] }` — IDs array in same order as input
- **Limit:** 100 emails per call
- **Not supported in batch:** `attachments`, `scheduled_at`

```json
// Request body
[
  {
    "from": "Sender Name <sender@domain.com>",
    "to": ["recipient@example.com"],
    "subject": "Subject line",
    "html": "<p>Email body</p>"
  }
]

// Response
{
  "data": [
    { "id": "ae2014de-c168-4c61-8267-70d2662a1ce1" }
  ]
}
```

### Webhook Events [VERIFIED: resend.com/docs/webhooks/event-types]
Events relevant to Phase 3:
- `email.delivered` — mail server accepted the email
- `email.bounced` — permanent rejection; `data.bounce.type` field available
- `email.complained` — recipient marked as spam

Webhook delivery notes:
- **At-least-once:** Duplicates possible — use `email_id` for idempotency
- **Retry schedule:** 5s, 5min, 30min, 2hr, 5hr, 10hr
- **Order not guaranteed** — use `created_at` for sorting

### Webhook Payload [VERIFIED: resend.com/docs/webhooks/emails/delivered and /bounced]
```json
// email.delivered
{
  "type": "email.delivered",
  "created_at": "2026-02-22T23:41:12.126Z",
  "data": {
    "email_id": "56761188-7520-42d8-8898-ff6fc54ce618",
    "from": "Acme <sender@example.com>",
    "to": ["recipient@example.com"],
    "subject": "Subject line",
    "tags": { "campaign_id": "..." }
  }
}

// email.bounced (adds bounce object)
{
  "type": "email.bounced",
  "created_at": "...",
  "data": {
    "email_id": "...",
    "bounce": {
      "type": "Permanent",
      "subType": "Suppressed",
      "message": "...",
      "diagnosticCode": ["550 5.1.1 ..."]
    }
  }
}
```

**Key:** The `email_id` in webhook payload matches the `id` returned by the send API — store this in `campaign_recipients.resend_email_id` at send time.

---

## Common Pitfalls

### Pitfall 1: Tracking Pixel Cache by Email Clients
**What goes wrong:** Apple Mail's Mail Privacy Protection pre-fetches all images through an Apple proxy, making every open look like it came from Apple's IP. Apple also caches the pixel, so subsequent real opens may not fire.
**Why it happens:** Privacy features in modern email clients intercept image loading.
**How to avoid:** Use `Cache-Control: no-store, no-cache` headers + unique `tracking_id` per recipient (already planned). Accept that open tracking is approximate — do not make business-critical decisions on open data alone.
**Warning signs:** All opens appear to come from a single IP, opens fire before the email is logically readable.

### Pitfall 2: Webhook Body Re-Parsing Breaks Svix Verification
**What goes wrong:** If you do `const body = await req.json()` then pass `JSON.stringify(body)` to Svix, verification fails even with the correct secret.
**Why it happens:** JSON re-serialization changes whitespace, key order, and number precision — the HMAC is over the original raw bytes.
**How to avoid:** Always use `const payload = await req.text()` before passing to `wh.verify(payload, headers)`. Never parse as JSON first.
**Warning signs:** Svix throws "Invalid signature" error despite having the correct webhook secret configured.

### Pitfall 3: Missing resend_email_id — Webhooks Cannot Match Recipients
**What goes wrong:** Webhooks arrive with an `email_id` but there is no way to find which `campaign_recipients` row corresponds to it.
**Why it happens:** The Resend batch response returns IDs in order — if not stored immediately, the mapping is lost.
**How to avoid:** Store `resend_email_id` on the `campaign_recipients` row using the response array (index-matched to the batch input). Do this synchronously before returning from the send function.
**Warning signs:** Webhook events arrive but update 0 rows in `campaign_recipients`.

### Pitfall 4: Link Wrapping Order with Personalization Variables
**What goes wrong:** Campaign HTML has `href="https://example.com/?ref={{first_name}}"`. If you wrap links first, the variable stays unresolved in the tracking URL. If you personalize first, the variable is replaced per-contact, then wrapping works correctly.
**Why it happens:** The regex that wraps links and the regex that replaces variables both touch href attributes.
**How to avoid:** Apply personalization to body_html BEFORE link wrapping. Sequence: personalize → wrap links → inject pixel → send.
**Warning signs:** Click tracking URLs contain literal `{{first_name}}` strings in the stored `link_map`.

### Pitfall 5: Free Tier Daily Limit Exceeded Mid-Campaign
**What goes wrong:** A campaign to 150 contacts exhausts the 100/day limit mid-send — last 50 contacts never receive the email, but the campaign status is marked "sent".
**Why it happens:** The Resend free tier has a 100 email/day hard limit, not a rate limit that resets per second.
**How to avoid:** Before sending, check daily sent count. For MVP, surface a warning in the UI if contact list > 100. On 429 response from Resend, mark campaign status as 'paused' with an error message, do not silently fail.
**Warning signs:** Resend returns HTTP 429 with a daily quota error (distinct from rate limit 429).

### Pitfall 6: JWT Verification Not Disabled for Tracking Endpoints
**What goes wrong:** Email clients hit the pixel URL without any Authorization header — Supabase returns 401 and the event is never logged.
**Why it happens:** Supabase Edge Functions require a valid JWT by default.
**How to avoid:** Add `verify_jwt = false` for the `t` function and `resend-webhook` function in `supabase/config.toml`.
**Warning signs:** All pixel loads return 401; zero open events are recorded despite emails being received.

### Pitfall 7: Existing `send-test-email` Uses Deprecated `serve` Import
**What goes wrong:** The pattern `import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'` still works but is deprecated — new functions should not copy this pattern.
**Why it happens:** The existing function was written before Deno built-in `Deno.serve` became the standard.
**How to avoid:** All new Edge Functions use `Deno.serve(async (req) => { ... })` directly — no import needed.

---

## Campaign Send State Machine

```
draft
  → sending    (user clicks "Send Now")
    → sent     (all recipients processed)
    → paused   (Resend 429 daily quota hit mid-campaign)
    → cancelled (user manually cancels)

scheduled
  → sending    (scheduled_at time reached — future phase concern)
```

State transitions handled in `send-campaign` Edge Function:
1. At launch: `draft/scheduled → sending`, set `sent_at`, `total_recipients`
2. After all batches complete: `sending → sent`, set `total_sent`
3. On Resend daily quota 429: `sending → paused`, surface error to client

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Frontend build | Yes | 24.12.0 | — |
| npm | Frontend build | Yes | 11.6.2 | — |
| Supabase CLI | Deploy Edge Functions | No | — | Deploy via Supabase Dashboard UI (manual) |
| Supabase project | Backend | Yes (project live) | — | — |
| Resend API key | Email sending | Yes (used in send-test-email) | — | — |

**Missing dependencies with no fallback:**
- **Supabase CLI** — Edge Functions can be deployed via the Supabase Dashboard UI (Upload file) as a fallback. However, the Dashboard does not support `config.toml` `verify_jwt` settings — those must be set via CLI `supabase functions deploy --no-verify-jwt`. Plan must include a CLI install step or document the Dashboard workaround with the `--no-verify-jwt` flag equivalent.

**Install Supabase CLI (recommended for this phase):**
```bash
# macOS via Homebrew
brew install supabase/tap/supabase

# Or as project dev dependency
npm install --save-dev supabase
npx supabase functions deploy t --no-verify-jwt
npx supabase functions deploy resend-webhook --no-verify-jwt
npx supabase functions deploy send-campaign
```

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — no test files found in project |
| Config file | None — Wave 0 must create test infrastructure |
| Quick run command | (to be determined — likely `npm test` after setup) |
| Full suite command | (to be determined) |

Note: This project has no existing test infrastructure (no jest.config, no vitest.config, no test/ directory). For Phase 3, given the backend-heavy nature (Edge Functions, webhooks), manual integration testing and Supabase Dashboard logs are the primary validation approach. Unit tests for helper functions (link wrapping, personalization) can be added, but end-to-end tests require a live Supabase project.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DELV-01 | Send campaign emails via Resend | Integration/manual | — | No test infra |
| DELV-02 | Links are wrapped with tracking URLs | Unit | `npm test -- link-wrap` | Wave 0 |
| DELV-03 | Tracking pixel injected in HTML | Unit | `npm test -- inject-pixel` | Wave 0 |
| DELV-04 | Open pixel logs event to DB | Manual (email client test) | — | Manual only |
| DELV-05 | Click redirects and logs event | Manual (curl to pixel URL) | `curl -v {SUPABASE_URL}/functions/v1/t/click/...` | Manual |
| DELV-06 | Unsub URL marks contact unsubscribed | Manual (browser hit) | — | Manual |
| DELV-07 | Webhook updates recipient status | Manual (Resend CLI webhook replay) | `resend webhooks listen` | Manual |

### Sampling Rate
- **Per task commit:** Manual smoke test of changed Edge Function via `supabase functions serve` locally or Supabase Dashboard
- **Per wave merge:** Full integration smoke test — send a real test campaign to a single contact, verify event chain
- **Phase gate:** All 7 DELV requirements manually verified before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] No test framework configured — consider `vitest` for unit tests of `injectTracking` and `personalizeSubject` helpers
- [ ] `supabase/config.toml` — must be created before deploying `t` and `resend-webhook` functions

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes (send-campaign) | JWT verification via Supabase auth.getUser() |
| V3 Session Management | No | Stateless Edge Functions |
| V4 Access Control | Yes | service_role only in tracking functions; workspace_id scoping in send-campaign |
| V5 Input Validation | Yes | Validate campaign_id from request body; validate tracking_id format (UUID) |
| V6 Cryptography | Yes | Svix HMAC-SHA256 for webhook verification — never hand-roll |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Webhook spoofing | Spoofing | Svix signature verification on every webhook request |
| Replay attack on webhook | Repudiation | Svix includes timestamp window check (5-minute window) |
| Tracking ID enumeration | Info Disclosure | Use UUID v4 (128-bit random) for tracking_id — computationally infeasible to enumerate |
| Mass unsubscribe via guessed tracking IDs | Tampering | UUID v4 entropy makes guessing infeasible; no additional auth needed |
| Campaign send to wrong workspace contacts | Elevation of Privilege | Verify campaign.workspace_id matches authenticated user's workspace_id before sending |
| Open tracking pixel as spam signal | Availability | N/A — informational risk only; document in user guidance |

---

## Code Examples

### Verified Patterns from Official Sources

#### 1. config.toml JWT Bypass
```toml
# Source: https://supabase.com/docs/guides/functions/function-configuration
[functions.t]
verify_jwt = false

[functions.resend-webhook]
verify_jwt = false
```

#### 2. Hono basePath Router in Edge Function
```typescript
// Source: https://supabase.com/docs/guides/functions/routing
import { Hono } from 'jsr:@hono/hono'

const app = new Hono().basePath('/t')
app.get('/pixel/:trackingId', async (c) => { /* ... */ })
app.get('/click/:trackingId/:linkIndex', async (c) => { /* ... */ })
app.get('/unsub/:trackingId', async (c) => { /* ... */ })

Deno.serve(app.fetch)
```

#### 3. Service Role Client in Edge Function
```typescript
// Source: [VERIFIED: environment variable names] + existing send-test-email pattern
const adminClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)
// This client bypasses ALL RLS policies
```

#### 4. Svix Webhook Verification (raw body critical)
```typescript
// Source: https://resend.com/docs/dashboard/webhooks/verify-webhooks-requests
import { Webhook } from 'npm:svix'

const payload = await req.text()  // NOT req.json() — must be raw string
const wh = new Webhook(Deno.env.get('RESEND_WEBHOOK_SECRET') ?? '')
const event = wh.verify(payload, {
  'svix-id': req.headers.get('svix-id') ?? '',
  'svix-timestamp': req.headers.get('svix-timestamp') ?? '',
  'svix-signature': req.headers.get('svix-signature') ?? '',
})
```

#### 5. Resend Batch API Call
```typescript
// Source: https://resend.com/docs/api-reference/emails/send-batch-emails
const response = await fetch('https://api.resend.com/emails/batch', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${RESEND_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(batchArray),  // max 100 items
})
const { data } = await response.json()
// data[i].id = resend email ID for batchArray[i]
```

#### 6. 1x1 Transparent PNG Response
```typescript
// Source: [CITED: https://png-pixel.com/ — 68-byte minimal transparent PNG]
// The base64 below is a valid 1x1 transparent PNG
const PIXEL_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
const pixel = Uint8Array.from(atob(PIXEL_B64), c => c.charCodeAt(0))
return new Response(pixel, {
  headers: {
    'Content-Type': 'image/png',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
  },
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `import { serve } from 'std@0.168.0/http/server.ts'` | `Deno.serve()` built-in | Deno 1.35+ / Supabase 2024 | New functions should use `Deno.serve` — old import still works but deprecated |
| Separate Edge Function per endpoint | Single function with Hono router | Supabase docs 2024 | Reduces cold starts, preferred for tracking URL family |
| Manual HMAC verification for webhooks | Svix library | Resend adopted Svix | Correct timing attack protection handled by library |

**Deprecated/outdated:**
- `import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'`: The existing `send-test-email` uses this — acceptable to leave as-is but new functions should use `Deno.serve`

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `t` function name prefix is correct for routing — URLs will be `{SUPABASE_URL}/functions/v1/t/pixel/...` | Architecture Patterns | URLs embedded in sent emails would be wrong; tracking would be broken |
| A2 | Resend batch API response `data` array is index-matched to request array | Resend API Facts | `resend_email_id` stored on wrong recipient row — webhook updates wrong contact |
| A3 | The 1x1 PNG base64 string `iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==` is a valid transparent PNG | Code Examples | Broken image in email bodies — will not affect tracking functionality but looks bad |
| A4 | `link_map` column stores the original URLs indexed by position string (e.g., `{"0": "https://..."}`) | Database Schema | Click events log an index with no way to resolve the original URL for redirect |
| A5 | Campaign send should be orchestrated synchronously within one Edge Function invocation for MVP batch sizes ≤100 | Architecture Patterns | Edge Functions have a 150-second timeout — larger lists need async/queue approach |

**Claim A2 is HIGH risk if wrong.** Should be validated by testing the batch API with known input order.

---

## Open Questions (RESOLVED)

1. **Resend API key storage — project vs per-workspace**
   - What we know: `RESEND_API_KEY` is an Edge Function secret set in Supabase Dashboard; Phase 7 (SETT-02) will allow users to configure their own key
   - What's unclear: For Phase 3, is the key hardcoded as a project-level secret, or should we check the DB for a workspace-configured key?
   - RESOLVED: Recommendation: Use hardcoded Edge Function secret for Phase 3. Phase 7 will add DB-stored key lookup.

2. **Open event deduplication for aggregate counter updates**
   - What we know: `tracking_events` will have multiple open rows per recipient (multiple email opens). `campaigns.total_opened` should be unique openers, not total events.
   - What's unclear: Should `total_opened` be unique contacts or total open events?
   - RESOLVED: Recommendation: Count unique contacts (first open per tracking_id) for `total_opened`. Use a Postgres trigger or `INSERT ON CONFLICT DO NOTHING` with a unique constraint on (tracking_id, event_type='open') for the first occurrence.

3. **Edge Function timeout for large lists**
   - What we know: Supabase Edge Functions have a 150-second timeout wall clock limit (approximate)
   - What's unclear: For lists of 100 contacts (max free tier anyway), the send will complete well within timeout. Confirmed safe for MVP.
   - RESOLVED: Recommendation: No async queue needed for Phase 3. Document the limit as a known constraint.

---

## Sources

### Primary (HIGH confidence)
- [Supabase Functions Routing Docs](https://supabase.com/docs/guides/functions/routing) — Hono basePath pattern, function prefix requirement
- [Supabase Function Configuration Docs](https://supabase.com/docs/guides/functions/function-configuration) — `verify_jwt = false` in config.toml
- [Resend Account Quotas](https://resend.com/docs/knowledge-base/account-quotas-and-limits) — 100 emails/day free tier, 5 req/sec rate limit
- [Resend Batch API](https://resend.com/docs/api-reference/emails/send-batch-emails) — endpoint URL, request format, 100-per-call limit
- [Resend Webhook Verification](https://resend.com/docs/dashboard/webhooks/verify-webhooks-requests) — Svix library usage, raw body requirement
- [Resend Webhook Event Types](https://resend.com/docs/webhooks/event-types) — 11 email event types
- [Resend email.delivered payload](https://resend.com/docs/webhooks/emails/delivered) — exact JSON structure
- [Resend email.bounced payload](https://resend.com/docs/webhooks/emails/bounced) — bounce subtype fields
- Existing `supabase/functions/send-test-email/index.ts` — established project patterns for Edge Functions
- Existing `src/types/database.ts` — confirmed schema columns (total_opened, total_bounced, etc.)

### Secondary (MEDIUM confidence)
- [Supabase Edge Functions AI Prompt](https://supabase.com/docs/guides/getting-started/ai-prompts/edge-functions) — `Deno.serve` as current standard, `SUPABASE_SERVICE_ROLE_KEY` env var name
- [Supabase Edge Functions Auth Docs](https://supabase.com/docs/guides/functions/auth) — `SUPABASE_URL` auto-injected

### Tertiary (LOW confidence)
- [PNG Pixel reference](https://png-pixel.com/) — 68-byte PNG claim; exact base64 string not confirmed (A3 assumption)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Verified against official Supabase and Resend docs; existing codebase confirms patterns
- Architecture: HIGH — Hono routing and Deno.serve patterns are from official documentation; DB schema extrapolated from existing types (MEDIUM for schema specifics)
- Resend API details: HIGH — Verified against resend.com official docs
- Pitfalls: HIGH — Most derived from official docs and established patterns (pixel PNG base64 is MEDIUM)
- Tracking pixel PNG base64: LOW — Cited from png-pixel.com but exact bytes not byte-verified in this session

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (Resend pricing/limits change infrequently; Supabase Edge Function API is stable)
