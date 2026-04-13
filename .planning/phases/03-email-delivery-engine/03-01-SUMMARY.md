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
  - "Migrations applied via Supabase SQL Editor (manual) due to SUPABASE_ACCESS_TOKEN not available in CI environment"
metrics:
  duration: ~20m
  completed_date: "2026-04-13"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 4
---

# Phase 3 Plan 01: Database Schema for Email Delivery Engine Summary

**One-liner:** Campaign recipient delivery tracking and open/click event log tables with RLS, TypeScript types, and JWT bypass config for anonymous tracking Edge Functions — schema live in production Supabase.

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

**Status:** COMPLETE — applied manually via Supabase SQL Editor

Both migrations applied to production Supabase project `pozqnzhgqmajtaidtpkk`:

- `004_campaign_recipients.sql` — `campaign_recipients` table live with all columns, indexes, and RLS policy
- `005_tracking_events.sql` — `tracking_events` table live with indexes and RLS enabled

All subsequent Edge Function plans (03-02 through 03-05) can now reference both tables.

## Deviations from Plan

### Auth Gates

**Task 2 — Supabase CLI not available in execution environment:**
- Attempted: `supabase db push` via locally installed CLI (`/tmp/supabase-cli`)
- Blocked by: No `SUPABASE_ACCESS_TOKEN` in environment, non-TTY prevents interactive login
- Resolved: User applied both migrations manually via the Supabase SQL Editor
- Impact: None — tables are live in production, plan success criteria met

## Known Stubs

None — this plan creates data layer infrastructure (migrations + types), not UI components.

## Threat Flags

No new security surface introduced beyond what is documented in the plan's threat model. The `config.toml` JWT bypass is intentionally scoped to `t` and `resend-webhook` functions only.

## Self-Check: PASSED

- [x] `supabase/migrations/004_campaign_recipients.sql` — EXISTS, contains all required columns and RLS
- [x] `supabase/migrations/005_tracking_events.sql` — EXISTS, contains required columns and RLS
- [x] `supabase/config.toml` — EXISTS, contains `[functions.t]` and `[functions.resend-webhook]` with `verify_jwt = false`
- [x] `src/types/database.ts` — EXISTS, contains `CampaignRecipient`, `TrackingEvent`, `RecipientStatus`, both table entries in `Database` interface
- [x] `npx tsc --noEmit` — exits 0
- [x] Commit `71847b2` — EXISTS
- [x] `campaign_recipients` table — LIVE in production (manually applied)
- [x] `tracking_events` table — LIVE in production (manually applied)
