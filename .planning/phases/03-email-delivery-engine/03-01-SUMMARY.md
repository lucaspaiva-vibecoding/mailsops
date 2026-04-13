---
phase: 03-email-delivery-engine
plan: "01"
subsystem: database
tags: [migrations, rls, typescript-types, supabase, tracking]
dependency_graph:
  requires: [campaigns table, contacts table, profiles table]
  provides: [campaign_recipients table, tracking_events table, CampaignRecipient type, TrackingEvent type, JWT bypass config]
  affects: [03-02-send-campaign, 03-03-tracking-edge-functions, 03-04-webhook]
tech_stack:
  added: []
  patterns: [append-only-table (Update: never), RLS via join through parent table, service_role bypass for Edge Functions]
key_files:
  created:
    - supabase/migrations/004_campaign_recipients.sql
    - supabase/migrations/005_tracking_events.sql
    - supabase/config.toml
  modified:
    - src/types/database.ts
decisions:
  - "tracking_events has Update: never in Database interface — append-only log (same pattern as contact_import_logs)"
  - "campaign_recipients RLS SELECT joins through campaigns table (no direct workspace_id) — identical pattern to contact_list_members via contact_lists"
  - "config.toml disables JWT only for t and resend-webhook; send-campaign and send-test-email retain verify_jwt=true"
  - "tracking_events has no user SELECT RLS policy — analytics queries join through campaigns/campaign_recipients; Edge Functions use service_role"
metrics:
  duration: ~10m
  completed_date: "2026-04-13"
  tasks_completed: 1
  tasks_total: 2
  files_modified: 4
---

# Phase 3 Plan 01: Database Schema for Email Delivery Engine Summary

**One-liner:** Campaign recipient delivery tracking and open/click event log tables with RLS, TypeScript types, and JWT bypass config for anonymous tracking Edge Functions.

## Tasks Completed

### Task 1: Create migration files, config.toml, and update TypeScript types

**Status:** COMPLETE — committed at `71847b2`

All four files created/updated:

- `supabase/migrations/004_campaign_recipients.sql` — campaign_recipients table with tracking_id UNIQUE, resend_email_id, delivery_status, link_map JSONB, three indexes, RLS enabled with SELECT policy joining through campaigns table
- `supabase/migrations/005_tracking_events.sql` — tracking_events append-only table with event_type, link_index, link_url, user_agent, ip_address, two indexes, RLS enabled (no user SELECT policy — service_role only)
- `supabase/config.toml` — JWT bypass for `t` and `resend-webhook` Edge Functions; `send-campaign` and `send-test-email` retain default JWT verification
- `src/types/database.ts` — Added `RecipientStatus`, `CampaignRecipient`, `TrackingEvent` interfaces and registered both tables in `Database.public.Tables`

TypeScript compiles cleanly (`npx tsc --noEmit` exits 0).

### Task 2: Push database schema to Supabase

**Status:** BLOCKED — authentication gate

`supabase db push` requires `SUPABASE_ACCESS_TOKEN` (or stored CLI login). No token is present in the environment. The Supabase CLI was installed locally (`/tmp/supabase-cli`) but cannot authenticate without the token.

**Required action:** Set `SUPABASE_ACCESS_TOKEN` and run:
```bash
export SUPABASE_ACCESS_TOKEN=<your-token>
/tmp/supabase-cli/node_modules/.bin/supabase link --project-ref pozqnzhgqmajtaidtpkk
/tmp/supabase-cli/node_modules/.bin/supabase db push
```

The Supabase access token can be obtained from: https://app.supabase.com/account/tokens

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written for Task 1.

### Auth Gates

**Task 2 — Supabase CLI authentication:**
- Attempted: `supabase db push` via locally installed CLI (`/tmp/supabase-cli`)
- Blocked by: No `SUPABASE_ACCESS_TOKEN` in environment, no stored CLI session
- Required: User must provide Supabase access token and run `supabase db push` manually, or set `SUPABASE_ACCESS_TOKEN` for automated execution

## Known Stubs

None — this plan creates data layer infrastructure (migrations + types), not UI components.

## Threat Flags

No new security surface introduced beyond what is documented in the plan's threat model. The `config.toml` JWT bypass is intentionally scoped to `t` and `resend-webhook` functions only.

## Self-Check: PARTIAL

Task 1 artifacts verified:

- [x] `supabase/migrations/004_campaign_recipients.sql` — EXISTS, contains all required columns and RLS
- [x] `supabase/migrations/005_tracking_events.sql` — EXISTS, contains required columns and RLS
- [x] `supabase/config.toml` — EXISTS, contains `[functions.t]` and `[functions.resend-webhook]` with `verify_jwt = false`
- [x] `src/types/database.ts` — EXISTS, contains `CampaignRecipient`, `TrackingEvent`, `RecipientStatus`, both table entries in `Database` interface
- [x] `npx tsc --noEmit` — exits 0
- [x] Commit `71847b2` — EXISTS

Task 2 artifacts:
- [ ] `supabase db push` — NOT RUN (auth gate, requires SUPABASE_ACCESS_TOKEN)
