# Phase 3: Email Delivery Engine - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning
**Source:** User decisions (discuss-phase)

<domain>
## Phase Boundary

Deliver campaign emails via Resend API through Supabase Edge Functions, with full open/click/unsubscribe tracking and Resend webhook processing to keep delivery status in sync.

</domain>

<decisions>
## Implementation Decisions

### D-01: Delivery Architecture
- Supabase Edge Function handles all campaign sends — it calls the Resend API
- Emails are batched with rate limiting to respect Resend free tier (100 emails/day)
- Edge Function, not the browser, orchestrates sends (keeps API key server-side)

### D-02: Open Tracking
- Tracking pixel: Edge Function at `/t/pixel/{tracking_id}` returns a 1×1 transparent PNG
- On pixel load, the function logs the open event to the database
- `tracking_id` is unique per recipient per campaign

### D-03: Click Tracking
- Edge Function at `/t/click/{tracking_id}/{link_index}` handles click redirects
- Logs the click event (tracking_id + link_index) to the database
- 302 redirects the recipient to the original URL after logging

### D-04: Unsubscribe
- Edge Function at `/t/unsub/{tracking_id}` processes unsubscribes
- Marks the contact as unsubscribed in the database
- Renders a confirmation page (not just a redirect) to acknowledge the action

### D-05: Resend Webhooks
- Edge Function receives Resend webhook events: `delivered`, `bounced`, `complained`
- Updates `campaign_recipients` table with per-recipient delivery status
- Also updates aggregate campaign stats (counters on campaigns table)

### D-06: Edge Function Auth
- All tracking/webhook Edge Functions use the `service_role` key (not RLS)
- Required because tracking hits come from anonymous email clients (no session)
- Resend webhook verification (signature check) used to protect the webhook endpoint

### Claude's Discretion
- Email HTML generation: how links are wrapped and pixel is injected before calling Resend
- Exactly which DB columns to update per event type (should align with existing schema)
- Batching strategy: concurrency limit, delay between batches, error retry logic
- Tracking URL base (probably SUPABASE_URL + /functions/v1)
- Campaign send status state machine (queued → sending → sent)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Foundation
- `.planning/ROADMAP.md` — Phase 3 scope, success criteria, and dependencies
- `.planning/REQUIREMENTS.md` — DELV-01 through DELV-07 (all must be covered)
- `.planning/STATE.md` — Project decisions and current state
- `CLAUDE.md` — Project conventions and tech stack

### Existing Codebase
- `src/lib/supabase.ts` — Supabase client patterns in use
- `src/types/database.ts` — Database type definitions and existing schema shape
- `supabase/` — Any existing Edge Functions or migrations to understand DB structure

</canonical_refs>

<specifics>
## Specific Ideas

- Tracking URLs format: `{SUPABASE_URL}/functions/v1/t/pixel/{tracking_id}`, `/t/click/{tracking_id}/{link_index}`, `/t/unsub/{tracking_id}`
- All Edge Functions anonymous (no JWT required) for tracking endpoints; webhook endpoint uses Resend signature verification
- Rate limiting must account for Resend free tier: 100 emails/day hard limit → batch/throttle logic required
- Resend event types to handle: `email.delivered`, `email.bounced`, `email.complained`

</specifics>

<deferred>
## Deferred Ideas

- A/B testing (Module 7 — separate phase)
- Drip sequences / scheduled sends (Module 8)
- Reply tracking (not in DELV requirements)
- Advanced retry logic / dead-letter queue for failed sends

</deferred>

---

*Phase: 03-email-delivery-engine*
*Context gathered: 2026-04-13 via user decisions*
