---
phase: 03-email-delivery-engine
plan: "04"
subsystem: edge-functions
tags: [resend, webhooks, svix, delivery-tracking, edge-functions, supabase]

requires:
  - phase: 03-email-delivery-engine plan 01
    provides: [campaign_recipients table, campaigns table, resend_email_id column, verify_jwt=false config for resend-webhook]
  - phase: 03-email-delivery-engine plan 03
    provides: [send-campaign stores resend_email_id per recipient, delivery_status=queued/sent lifecycle]

provides:
  - resend-webhook Edge Function at supabase/functions/resend-webhook/index.ts
  - Svix HMAC-SHA256 signature verification for all incoming Resend events
  - email.delivered -> campaign_recipients.delivery_status='delivered' + delivered_at
  - email.bounced -> campaign_recipients.delivery_status='bounced' + contacts.status='bounced' + bounce_type hard/soft
  - email.complained -> campaign_recipients.delivery_status='complained' + contacts.status='complained'
  - campaign aggregate counter increments (total_delivered, total_bounced, total_unsubscribed)
  - 400 rejection for invalid signatures (triggers Resend retry)

affects: [03-05-send-ui, analytics aggregation, contact list health management]

tech-stack:
  added: [npm:svix (Webhook signature verification)]
  patterns: [raw body read before verification (req.text() not req.json()), service_role for unauthenticated webhook, 400-on-invalid-sig for retry semantics]

key-files:
  created:
    - supabase/functions/resend-webhook/index.ts
  modified: []

key-decisions:
  - "raw body read via req.text() before Svix verification — JSON re-parsing would invalidate HMAC-SHA256 signature (T-03-16)"
  - "400 returned on invalid signature (not 200) — causes Resend to retry; 200 would silently discard the event"
  - "Unknown event types (email.opened, email.clicked) return 200 immediately — acknowledge without processing to prevent retries"
  - "No matching recipient returns 200 — test send emails have no campaign_recipient row; silent acknowledgement appropriate"
  - "Resend 500 response triggers Resend retry — used for unexpected errors to leverage Resend's retry schedule"
  - "module-level service_role client — webhook requests carry no JWT so RLS cannot be used; service_role bypasses RLS safely"

patterns-established:
  - "Webhook auth pattern: raw body read first, then Svix verify, then parse — order is mandatory for HMAC integrity"
  - "Delivery feedback loop: send-campaign stores resend_email_id -> webhook matches by resend_email_id -> updates status"

requirements-completed: [DELV-07]

duration: ~10min
completed: "2026-04-13"
---

# Phase 3 Plan 04: Resend Webhook Edge Function Summary

**Svix-verified resend-webhook Edge Function closing the delivery feedback loop — processes email.delivered/bounced/complained events to update campaign_recipients delivery status, contact bounce/complaint status, and campaign aggregate counters.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-13T13:40:00Z
- **Completed:** 2026-04-13T13:50:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Created `supabase/functions/resend-webhook/index.ts` (144 lines) with full delivery event processing
- Svix HMAC-SHA256 signature verification before any DB operations (T-03-14, T-03-15, T-03-16)
- All three delivery event types handled with correct status mapping and timestamp fields
- Contact bounce/complaint status propagation maintains list health for future campaigns
- Campaign aggregate counters incremented atomically per event

## Task Commits

1. **Task 1: Create resend-webhook Edge Function with Svix verification and event processing** - `d13bb31` (feat)

## Files Created/Modified

- `supabase/functions/resend-webhook/index.ts` - Resend webhook processor with Svix signature verification, event routing, campaign_recipients/contacts/campaigns updates

## Decisions Made

- Raw body read via `req.text()` before Svix verification — JSON re-parsing would invalidate HMAC-SHA256 signature (T-03-16)
- Returns 400 on invalid signature (not 200) — causes Resend to retry; 200 would silently discard the event
- Unknown event types (e.g. email.opened) return 200 immediately — acknowledge without processing to prevent unnecessary retries
- No matching recipient returns 200 — test send emails (send-test-email function) have no campaign_recipient row; silent acknowledgement is correct behavior
- Module-level `service_role` Supabase client — webhook requests carry no JWT so RLS cannot be used

## Deviations from Plan

None — plan executed exactly as written. All STRIDE mitigations from T-03-14 through T-03-18 applied as specified.

## Known Stubs

None — this plan creates backend Edge Function logic only. No UI components.

## Threat Flags

No new security surface beyond what is documented in the plan's threat model. All T-03-14 through T-03-18 threats addressed per their dispositions.

## User Setup Required

**External services require manual configuration:**

1. **RESEND_WEBHOOK_SECRET** env var — obtain from Resend Dashboard -> Webhooks -> Create webhook -> Signing secret (starts with `whsec_`). Add to Supabase Edge Function environment variables.

2. **Register webhook endpoint in Resend Dashboard** — Resend Dashboard -> Webhooks -> Add webhook:
   - URL: `{SUPABASE_URL}/functions/v1/resend-webhook`
   - Events to subscribe: `email.delivered`, `email.bounced`, `email.complained`

## Next Phase Readiness

- `resend-webhook` function is ready to deploy alongside `send-campaign`
- Delivery feedback loop is complete: send-campaign stores `resend_email_id` -> webhook matches by `resend_email_id` -> updates delivery status and campaign counters
- Plan 03-05 (send UI) can proceed — the backend delivery pipeline (send-campaign + resend-webhook) is now complete

## Self-Check: PASSED

- [x] `supabase/functions/resend-webhook/index.ts` — EXISTS (144 lines, min_lines: 80 satisfied)
- [x] Commit `d13bb31` — EXISTS
- [x] File contains `import { Webhook } from 'npm:svix'` — YES (line 1)
- [x] File contains `import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'` — YES (line 2)
- [x] File contains `SUPABASE_SERVICE_ROLE_KEY` — YES (line 8)
- [x] File contains `await req.text()` — YES (line 31)
- [x] File contains `wh.verify(payload` — YES (line 60)
- [x] File contains `'svix-id'` and `'svix-timestamp'` and `'svix-signature'` — YES (lines 39-43)
- [x] File contains `RESEND_WEBHOOK_SECRET` — YES (line 52)
- [x] File contains `'email.delivered'` — YES (lines 12, 96, 107)
- [x] File contains `'email.bounced'` — YES (lines 13, 97, 100, 109)
- [x] File contains `'email.complained'` — YES (lines 14, 98, 113)
- [x] File contains `resend_email_id` — YES (line 80)
- [x] File contains `delivery_status` — YES (lines 91, 93, 95)
- [x] File contains `total_delivered` — YES (line 16)
- [x] File contains `total_bounced` — YES (line 17)
- [x] File contains `status: 'bounced'` — YES (line 105)
- [x] File contains `Deno.serve(async (req)` — YES (line 26)
- [x] File contains `return new Response('Invalid signature', { status: 400 })` — YES (line 64)
- [x] File does NOT contain `await req.json()` before `wh.verify` — CONFIRMED
