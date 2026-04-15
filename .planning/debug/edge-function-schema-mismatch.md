---
status: awaiting_human_verify
trigger: "Investigate and fix Edge Function schema mismatches"
created: 2026-04-13T00:00:00Z
updated: 2026-04-13T00:05:00Z
---

## Current Focus

hypothesis: CONFIRMED — all three functions had stale pre-Phase-4 column/table names
test: Read and rewrote all three functions with correct schema
expecting: Functions now write to correct tables/columns; deploy and verify in Supabase dashboard
next_action: Human verification — deploy functions and test each tracking flow

## Symptoms

expected: Edge Functions t, resend-webhook, and send-campaign correctly read/write the live Supabase schema columns
actual:
- Function `t` writes events to `tracking_events` table (does not exist — correct table is `campaign_events`)
- Function `resend-webhook` looks up recipients by `resend_email_id` (column does not exist — correct is `resend_message_id`) and updates `delivery_status` (column does not exist — correct is `status`)
- Function `send-campaign` may not be populating `campaign_links` with link data — this is required for click redirects
- All functions wrap logic in try/catch returning 200 on error — failures are completely silent

errors: No runtime errors visible (all swallowed). Silent failures: tracking events not recorded, webhook status updates dropped, click redirects may 404.

reproduction:
- Send a campaign → check if campaign_links rows are created
- Open tracking pixel URL → check if campaign_events row is inserted with event_type='opened'
- Click tracked link → check if campaign_events row is inserted with event_type='clicked'
- Trigger a Resend webhook delivery event → check if campaign_recipients status is updated

started: Functions deployed before Phase 4 updated database.ts types

## Eliminated

- hypothesis: Functions might have been updated after Phase 4
  evidence: Read all three function files — stale names confirmed throughout
  timestamp: 2026-04-13T00:01:00Z

## Evidence

- timestamp: 2026-04-13T00:01:00Z
  checked: supabase/functions/t/index.ts
  found: |
    Line 65: `supabase.from('tracking_events').insert(...)` — wrong table (should be campaign_events)
    Line 75: `supabase.from('tracking_events').select(...)` — wrong table
    Line 123: `supabase.from('tracking_events').insert(...)` — wrong table (click route)
    Line 171: `supabase.from('tracking_events').insert(...)` — wrong table (unsub route)
    Line 26: `getRecipient` selects `link_map` — column does not exist (correct: `variables`)
    Line 114: `recipient?.link_map?.[linkIndex]` — reads non-existent column
    Events insert uses `tracking_id` field — campaign_events has no tracking_id; needs recipient_id, campaign_id, workspace_id
    Events insert uses `occurred_at` field — campaign_events has no occurred_at; uses created_at (auto)
    event_type 'open' used but schema requires 'opened'; 'click' used but schema requires 'clicked'; 'unsubscribe' used but schema requires 'unsubscribed'
    No opened_at / clicked_at update on campaign_recipients after events
  implication: tracking pixel and click redirects both fail silently; link redirect logic broken because link_map doesn't exist

- timestamp: 2026-04-13T00:01:30Z
  checked: supabase/functions/resend-webhook/index.ts
  found: |
    Line 78: `.eq('resend_email_id', event.data.email_id)` — wrong column (correct: resend_message_id)
    Line 77: `.select('id, campaign_id, contact_id, delivery_status')` — delivery_status doesn't exist (correct: status)
    Line 89: `delivery_status: newStatus` in update payload — wrong column (correct: status)
    Line 88: updatePayload typed as Record<string,string> — blocks adding non-string fields
    Missing: insert into campaign_events for delivered/bounced/complained events
    Missing: workspace_id in delivered_at/bounced_at update is fine (update by id, no insert needed)
    statusMap maps to lowercase 'delivered', 'bounced', 'complained' — these match RecipientStatus enum correctly
  implication: All webhook status updates are silently dropped because resend_email_id lookup finds nothing

- timestamp: 2026-04-13T00:02:00Z
  checked: supabase/functions/send-campaign/index.ts
  found: |
    Line 229: `delivery_status: 'queued'` in recipientRows — wrong column (correct: status)
    Line 229: `link_map: email.linkMap` in recipientRows — wrong column (correct: variables)
    Line 229: Missing `workspace_id` in recipientRows insert — required NOT NULL column
    Line 284: `resend_email_id: resendData[j].id` in update — wrong column (correct: resend_message_id)
    Line 285: `delivery_status: 'sent'` in update — wrong column (correct: status)
    No `campaign_links` rows inserted after building linkMap — t function cannot look up original URLs for redirects
    getRecipient in t function tries to read link_map from variables JSONB — but send-campaign never stores links there either
  implication: campaign_recipients insert fails (workspace_id NOT NULL violation); even if it succeeded, click redirects would fail because campaign_links table is never populated

## Resolution

root_cause: |
  Three Edge Functions were written using pre-Phase-4 column names. After schema migration:
  1. `t`: wrong table (tracking_events→campaign_events), wrong event_types (open→opened, click→clicked, unsubscribe→unsubscribed), wrong column (link_map→campaign_links lookup), wrong insert shape (tracking_id/occurred_at→recipient_id/campaign_id/workspace_id)
  2. `resend-webhook`: wrong column names (resend_email_id→resend_message_id, delivery_status→status)
  3. `send-campaign`: wrong column names in insert/update (delivery_status→status, link_map→variables, resend_email_id→resend_message_id), missing workspace_id in insert, missing campaign_links population
fix: Rewrite all three functions with correct column names, correct table names, correct insert shapes, and add console.error() logging
verification: pending
files_changed:
  - supabase/functions/t/index.ts
  - supabase/functions/resend-webhook/index.ts
  - supabase/functions/send-campaign/index.ts
