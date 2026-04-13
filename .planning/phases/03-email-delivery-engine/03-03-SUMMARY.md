---
phase: 03-email-delivery-engine
plan: "03"
subsystem: edge-functions
tags: [resend, batch-sending, tracking, personalization, rate-limiting, edge-functions, supabase]
dependency_graph:
  requires: [campaign_recipients table, campaigns table, contact_list_members table, contacts table, supabase/config.toml JWT bypass for t function]
  provides: [send-campaign Edge Function, campaign send orchestration, link wrapping, pixel injection, unsubscribe footer, batch rate limiting]
  affects: [03-04-webhook, 03-05-send-ui, analytics aggregation]
tech_stack:
  added: []
  patterns: [JWT-authenticated Edge Function, service_role admin client for bulk writes, crypto.randomUUID for per-recipient tracking, Resend batch API, 429-paused state machine]
key_files:
  created:
    - supabase/functions/send-campaign/index.ts
  modified: []
decisions:
  - "admin client (service_role) used for all DB operations after JWT auth — avoids RLS contention on bulk inserts"
  - "campaign_recipients rows inserted BEFORE Resend batch send — ensures records exist if webhook arrives quickly"
  - "personalizeHtml -> wrapLinks -> addUnsubscribeFooter -> injectPixel order enforced — prevents pixel and unsub URLs from being re-wrapped as tracked links"
  - "429 from Resend sets campaign status to 'paused' (not 'failed') — allows future retry UI"
  - "!resendResponse.ok (non-429 errors) logs error and continues to next batch — tolerates partial failures"
  - "resend_email_id stored index-matched from batch response array — required for webhook delivery status updates"
metrics:
  duration: ~2m
  completed_date: "2026-04-13"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 1
---

# Phase 3 Plan 03: send-campaign Edge Function Summary

**One-liner:** JWT-authenticated send-campaign Edge Function orchestrating full campaign delivery pipeline — contact loading, per-recipient personalization, link wrapping, pixel injection, unsubscribe footer, Resend batch API sending with rate limiting, and campaign status state machine (draft/scheduled -> sending -> sent/paused).

## Tasks Completed

### Task 1: Create send-campaign Edge Function with tracking injection and batch sending

**Status:** COMPLETE — committed at `972881b`

Created `supabase/functions/send-campaign/index.ts` (316 lines) with:

**Authentication & Authorization:**
- `Deno.serve(async (req) => ...)` entry point (not deprecated `import { serve }`)
- CORS preflight handling (`OPTIONS -> 200 ok`)
- JWT verification via `userClient.auth.getUser()` with anon key + Authorization header (T-03-10)
- Workspace isolation: `campaign.workspace_id === workspaceId` check before any send operations (T-03-09, T-03-13)

**Campaign Loading:**
- Validates `campaign_id` in POST body
- Loads campaign with service_role admin client
- Validates campaign status is `draft` or `scheduled` (blocks re-sends)
- Loads active contacts via `contact_list_members` joined with `contacts` table, filtered to `status === 'active'`

**Processing Pipeline (per contact):**
1. `personalizeHtml(campaign.body_html, contact)` — replace `{{first_name}}`, `{{last_name}}`, `{{company}}`, `{{email}}` tokens
2. `wrapLinks(personalizedHtml, trackingId, TRACKING_BASE)` — regex wraps `href="https?://..."` with `/t/click/{trackingId}/{idx}` and builds `linkMap`
3. `addUnsubscribeFooter(wrappedHtml, trackingId, TRACKING_BASE)` — appends unsubscribe link before `</body>` or at end
4. `injectPixel(htmlWithUnsub, trackingId, TRACKING_BASE)` — injects 1x1 pixel before `</body>` or at end
5. `personalizeText(campaign.subject, contact)` — same token replacement for subject line

**Batch Sending:**
- `BATCH_SIZE = 50` (rate limit compliance)
- `campaign_recipients` rows inserted with `delivery_status: 'queued'` BEFORE batch send
- Resend batch API: `POST https://api.resend.com/emails/batch` with Bearer token (T-03-11 — API key server-side only)
- `resend_email_id` stored index-matched from response array for webhook matching
- `delivery_status` updated to `'sent'` with `sent_at` timestamp per recipient
- 300ms delay between batches (T-03-12 rate limiting)

**Campaign Status State Machine:**
- `draft/scheduled` -> `sending` (with `sent_at` and `total_recipients` set) at start
- `sending` -> `sent` (with `total_sent`) on completion
- `sending` -> `paused` (with `total_sent`) on Resend 429 (quota exhaustion)
- Non-429 Resend errors: logged and skipped (partial failure tolerance)

**Helper Functions:**
- `personalizeText(text, contact)` — token replacement for plain text
- `personalizeHtml(html, contact)` — delegates to personalizeText
- `wrapLinks(html, trackingId, baseUrl)` — returns `{ html, linkMap }`
- `injectPixel(html, trackingId, baseUrl)` — inserts 1x1 PNG img tag
- `addUnsubscribeFooter(html, trackingId, baseUrl)` — inserts styled unsub paragraph

All 19 acceptance criteria from the plan verified passing.

## Deviations from Plan

None — plan executed exactly as written. All STRIDE mitigations from T-03-09 through T-03-13 applied as specified. Processing order enforced per Research pitfall #4 (personalize FIRST, then link-wrap, then unsub footer, then pixel).

## Known Stubs

None — this plan creates backend Edge Function logic only. No UI components.

## Threat Flags

No new security surface beyond what is documented in the plan's threat model. All T-03-09 through T-03-13 threats addressed per their dispositions (mitigate as specified). RESEND_API_KEY accessed only via `Deno.env.get()` inside Edge Function — never exposed to browser.

## Self-Check: PASSED

- [x] `supabase/functions/send-campaign/index.ts` — EXISTS (316 lines, min_lines: 150 satisfied)
- [x] Commit `972881b` — EXISTS (`git log --oneline | head -1`)
- [x] File contains `Deno.serve(async (req)` — YES (line 70)
- [x] File contains `SUPABASE_SERVICE_ROLE_KEY` — YES (line 8)
- [x] File contains `SUPABASE_ANON_KEY` — YES (line 7)
- [x] File contains `userClient.auth.getUser()` — YES (line 88)
- [x] File contains `campaign.workspace_id` check — YES (lines 139-144)
- [x] File contains `function personalizeText` — YES (line 17)
- [x] File contains `function personalizeHtml` — YES (line 27)
- [x] File contains `function wrapLinks` with href regex — YES (lines 35-48)
- [x] File contains `function injectPixel` with `</body>` replacement — YES (lines 51-57)
- [x] File contains `function addUnsubscribeFooter` — YES (lines 59-65)
- [x] File contains `https://api.resend.com/emails/batch` — YES (line 244)
- [x] File contains `resend_email_id` — YES (lines 282+)
- [x] File contains `crypto.randomUUID()` — YES (line 205)
- [x] File contains `BATCH_SIZE` constant (value 50) — YES (line 10)
- [x] File contains `setTimeout(resolve, 300)` — YES (line 300)
- [x] File contains `status: 'sending'` — YES (line 192)
- [x] File contains `status: 'sent'` — YES (line 302)
- [x] File contains `status: 'paused'` — YES (line 257)
- [x] File contains `corsHeaders` matching send-test-email pattern — YES (lines 12-15)
- [x] File contains `from('campaign_recipients').insert` — YES (line 232)
- [x] File does NOT contain `import { serve }` — CONFIRMED (grep returns 0)
- [x] `test -f "supabase/functions/send-campaign/index.ts" && grep -c "api.resend.com"` — returns 1
