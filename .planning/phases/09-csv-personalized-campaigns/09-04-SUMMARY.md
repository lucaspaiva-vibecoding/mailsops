---
phase: 09-csv-personalized-campaigns
plan: "04"
subsystem: backend
tags: [edge-functions, csv-personalized, tracking, send-campaign, resend]
dependency_graph:
  requires: [09-01]
  provides: [csv_personalized-send-pipeline, t-function-variables-fallback]
  affects: [send-campaign, t-tracking-function]
tech_stack:
  added: []
  patterns: [early-return-branch, jsonb-variables-fallback, conditional-counter-update]
key_files:
  modified:
    - supabase/functions/send-campaign/index.ts
    - supabase/functions/t/index.ts
decisions:
  - "csv_personalized branch implemented as an early-return block after the contact_list_id guard — standard pipeline completely untouched"
  - "t function fallback reads campaign_recipients.variables JSONB keyed by link_index string — matches linkMap format from wrapLinks()"
  - "campaign_links counter update wrapped in conditional — csv_personalized clicks still tracked in campaign_events and recipient timestamps"
metrics:
  duration: "5min"
  completed: "2026-04-15"
  tasks_completed: 2
  files_modified: 2
---

# Phase 9 Plan 04: send-campaign csv_personalized branch + t function variables fallback Summary

**One-liner:** csv_personalized send pipeline in send-campaign Edge Function with per-recipient variables JSONB link fallback in t tracking function.

## What Was Built

### Task 1: send-campaign csv_personalized branch

Modified `supabase/functions/send-campaign/index.ts` with two targeted changes:

**Change 1 — contact_list_id guard bypass:**
The guard at step 8 now allows `csv_personalized` campaigns to proceed even without a `contact_list_id`:
```typescript
if (!campaign.contact_list_id && campaign.campaign_type !== 'csv_personalized') {
```

**Change 2 — Full csv_personalized execution branch:**
Inserted immediately after the guard and before step 9. The branch:
- Loads pre-built `campaign_recipients` rows (status='queued') with joined contact details
- Filters to active contacts only (`contacts.status === 'active'`)
- Updates campaign to 'sending' with total_recipients count
- Skips campaign_links building entirely (per-recipient links differ)
- Applies full tracking pipeline to `personalized_body`: `wrapLinks` → `addUnsubscribeFooter` → `injectPixel`
- Does NOT inject signature (csv_personalized body is already final)
- Stores per-recipient `linkMap` in `campaign_recipients.variables` JSONB for t function fallback
- Sends via Resend batch API with same BATCH_SIZE (50) and 300ms inter-batch delay
- Updates recipients with `resend_message_id` and status='sent' after send
- Returns `{ ok: true, sent, total }` matching standard response shape

The `return` at end of the branch means the standard pipeline (steps 9-14) is completely skipped for csv_personalized campaigns.

### Task 2: t Edge Function variables fallback for click redirect

Modified `supabase/functions/t/index.ts` click route with two targeted changes:

**Change 1 — variables fallback when campaign_links lookup fails:**
Replaced the hard 400 error when `campaignLink` is null with a two-tier lookup:
1. If `campaignLink` exists: use `campaignLink.original_url` (standard path — unchanged behavior)
2. If `campaignLink` is null: look up `campaign_recipients.variables` JSONB, extract URL by `String(linkIndex)` key

**Change 2 — conditional campaign_links counter update:**
Wrapped the `campaign_links` click_count/unique_clicks increment in `if (campaignLink)` so it only runs when a campaign_links row exists. Click events in `campaign_events` and recipient `clicked_at`/`total_clicked` counters still update for all campaign types.

## Verification Results

```
grep -c 'csv_personalized' supabase/functions/send-campaign/index.ts → 6 (pass, ≥3 required)
grep -q 'fallbackUrl' supabase/functions/t/index.ts → PASS
grep -q 'variables' supabase/functions/t/index.ts → PASS
Standard pipeline steps 9-14: completely unchanged (verified by reading file)
```

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 + 2 | e89229e | feat(phase-9): Plan 04 — send-campaign csv_personalized branch + t function variables fallback |

## Known Stubs

None. Both functions are fully wired with real data paths.

## Threat Surface Scan

No new network endpoints introduced. Both changes are internal logic modifications to existing Edge Functions. Security properties maintained:

| Threat ID | Status |
|-----------|--------|
| T-09-11 | Mitigated — csv_personalized branch reuses existing workspace_id isolation check at step 6 |
| T-09-12 | Mitigated — fallback URL from campaign_recipients.variables (server-written by send-campaign, never from request params) |
| T-09-14 | Mitigated — personalized_body/subject read from DB, not from Edge Function request body |
| T-09-15 | Mitigated — same BATCH_SIZE (50) and 300ms delay applies |

## Self-Check: PASSED

- FOUND: supabase/functions/send-campaign/index.ts
- FOUND: supabase/functions/t/index.ts
- FOUND: .planning/phases/09-csv-personalized-campaigns/09-04-SUMMARY.md
- FOUND commit: e89229e
