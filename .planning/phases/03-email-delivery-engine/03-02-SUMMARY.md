---
phase: 03-email-delivery-engine
plan: "02"
subsystem: edge-functions
tags: [tracking, hono, edge-functions, supabase, pixel, click, unsubscribe, security]
dependency_graph:
  requires: [campaign_recipients table, tracking_events table, campaigns table, contacts table, supabase/config.toml JWT bypass]
  provides: [t Edge Function, open pixel endpoint, click redirect endpoint, unsubscribe endpoint]
  affects: [03-03-send-campaign, analytics aggregation, contact unsubscribe flow]
tech_stack:
  added: [jsr:@hono/hono]
  patterns: [Hono basePath router, service_role bypass for anonymous hits, UUID validation guard, fire-and-forget DB writes before pixel response]
key_files:
  created:
    - supabase/functions/t/index.ts
  modified: []
decisions:
  - "UUID validation on all routes returns safe generic responses (pixel PNG or 'Invalid' HTML) — no internal state leaked (T-03-06 mitigate)"
  - "Click redirect only uses URLs from DB link_map — never from query params or request body (T-03-08 open-redirect mitigate)"
  - "DB errors in pixel route are caught and suppressed — email rendering must never break due to tracking write failures"
  - "First-open detection via post-insert count query (count === 1) — simple, avoids transactions"
  - "Unsubscribe DB write (contact update) is awaited before returning HTML — contact_id must be written before confirmation shown"
metrics:
  duration: ~2m
  completed_date: "2026-04-13"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 1
---

# Phase 3 Plan 02: Tracking Router Edge Function Summary

**One-liner:** Hono-based `t` Edge Function with three anonymous-access tracking routes (open pixel, click redirect, unsubscribe) using service_role client to log events and increment campaign aggregate counters.

## Tasks Completed

### Task 1: Create tracking router Edge Function with pixel, click, and unsub routes

**Status:** COMPLETE — committed at `4897fde`

Created `supabase/functions/t/index.ts` (196 lines) with:

- **Imports:** `jsr:@hono/hono` (Hono router) + `https://esm.sh/@supabase/supabase-js@2` (Supabase client)
- **Service-role client:** Module-level `createClient` using `SUPABASE_SERVICE_ROLE_KEY` (not anon key)
- **Pixel constant:** `PIXEL_BYTES` — 68-byte 1x1 transparent PNG decoded from base64
- **`GET /t/pixel/:trackingId`:** Inserts open event into `tracking_events`, checks count to detect first open, increments `campaigns.total_opened` on first open, returns PNG with `Content-Type: image/png` and `no-store, no-cache` headers. DB errors are swallowed — pixel always returned.
- **`GET /t/click/:trackingId/:linkIndex`:** Looks up `link_map` from `campaign_recipients`, inserts click event into `tracking_events`, increments `campaigns.total_clicked`, returns `Response.redirect(originalUrl, 302)`. URL always comes from DB link_map only (open redirect prevention).
- **`GET /t/unsub/:trackingId`:** Updates `contacts.status = 'unsubscribed'`, inserts unsubscribe event, increments `campaigns.total_unsubscribed`, returns styled HTML confirmation page.
- **Helpers:** `getRecipient(trackingId)` and `incrementCampaignCounter(campaignId, field)` shared across routes.
- **Entry point:** `Deno.serve(app.fetch)` (not deprecated `import { serve }` pattern).

All acceptance criteria verified:
- File has exactly 3 `app.get` routes
- Uses `jsr:@hono/hono` and `https://esm.sh/@supabase/supabase-js@2`
- Uses `SUPABASE_SERVICE_ROLE_KEY` (no `SUPABASE_ANON_KEY` anywhere)
- `const app = new Hono().basePath('/t')`
- All three routes present
- `Deno.serve(app.fetch)` (no `import { serve }`)
- `Content-Type: image/png` and `Cache-Control: no-store, no-cache, must-revalidate` in pixel route
- `Response.redirect(originalUrl, 302)` in click route
- `status: 'unsubscribed'` in unsub route
- `from('tracking_events').insert` in all three routes
- `from('contacts').update` in unsub route

## Deviations from Plan

None — plan executed exactly as written. All routes implemented per D-02, D-03, D-04, and D-06 decisions. All STRIDE mitigations from the threat register applied as specified.

## Known Stubs

None — this plan creates backend Edge Function logic only. No UI components.

## Threat Flags

No new security surface beyond what is documented in the plan's threat model. All T-03-04 through T-03-08 threats addressed per their dispositions (accept or mitigate as specified).

## Self-Check: PASSED

- [x] `supabase/functions/t/index.ts` — EXISTS (196 lines, min_lines: 100 satisfied)
- [x] Commit `4897fde` — EXISTS (`git log --oneline | grep 4897fde`)
- [x] `grep -c "app.get" supabase/functions/t/index.ts` — returns 3
- [x] File contains `import { Hono } from 'jsr:@hono/hono'`
- [x] File contains `import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'`
- [x] File contains `SUPABASE_SERVICE_ROLE_KEY`
- [x] File does NOT contain `SUPABASE_ANON_KEY`
- [x] File does NOT contain `import { serve }`
- [x] File contains `const app = new Hono().basePath('/t')`
- [x] File contains `app.get('/pixel/:trackingId'`
- [x] File contains `app.get('/click/:trackingId/:linkIndex'`
- [x] File contains `app.get('/unsub/:trackingId'`
- [x] File contains `Deno.serve(app.fetch)`
- [x] File contains `'Content-Type': 'image/png'`
- [x] File contains `'Cache-Control': 'no-store, no-cache, must-revalidate'`
- [x] File contains `Response.redirect(`
- [x] File contains `status: 'unsubscribed'`
- [x] File contains `from('tracking_events').insert`
- [x] File contains `from('contacts').update`
