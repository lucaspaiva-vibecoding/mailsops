---
phase: "09"
plan: "01"
subsystem: "campaigns"
tags: ["csv", "personalization", "migration", "types", "hook", "parser"]
dependency_graph:
  requires: []
  provides: ["csv_personalized campaign_type", "CsvRow type", "parseCsvFile utility", "useCsvCampaign hook"]
  affects: ["campaign_recipients", "campaigns", "database types"]
tech_stack:
  added: ["papaparse (already installed)"]
  patterns: ["upsert contacts on conflict", "bulk insert campaign_recipients", "cleanup on partial failure"]
key_files:
  created:
    - supabase/migrations/011_csv_personalized.sql
    - src/lib/csvParser.ts
    - src/hooks/campaigns/useCsvCampaign.ts
  modified:
    - src/types/database.ts
decisions:
  - "Used papaparse (already in package.json) for CSV parsing — no new dependency needed"
  - "useCsvCampaign performs a cleanup delete on the campaign if the recipients bulk insert fails"
  - "Contact upsert uses onConflict: 'workspace_id,email' to avoid duplicates"
metrics:
  duration: "~10 minutes"
  completed_date: "2026-04-15"
  tasks_completed: 2
  files_changed: 4
---

# Phase 9 Plan 01: DB Migration 011, Types, csvParser, useCsvCampaign Hook Summary

**One-liner:** Foundation layer for CSV-personalized campaigns — extended CHECK constraint, CsvRow type, Papa.parse-based file parser, and upsert/insert campaign hook.

## What Was Done

### Task 1: Migration 011 + TypeScript Type Updates

Created `supabase/migrations/011_csv_personalized.sql` which:
- Drops the existing `campaigns_campaign_type_check` constraint and re-adds it with `'csv_personalized'` included
- Adds `personalized_subject TEXT` and `personalized_body TEXT` columns to `campaign_recipients` (both nullable, `IF NOT EXISTS` guarded)

Updated `src/types/database.ts` with three changes:
- Extended `CampaignType` union: `'regular' | 'ab_test' | 'ab_variant' | 'csv_personalized'`
- Added `CsvRow` interface (the contract between the CSV parser and the hook): `first_name`, `last_name`, `email`, `subject`, `body`
- Added `personalized_subject: string | null` and `personalized_body: string | null` to `CampaignRecipient` (after `tracking_id`, before `created_at`)

### Task 2: CSV Parser + useCsvCampaign Hook

Created `src/lib/csvParser.ts`:
- `parseCsvFile(file: File): Promise<CsvParseResult>` — wraps Papa.parse with column validation (requires `first_name`, `last_name`, `email`, `subject`, `body`), filters empty-email rows, normalizes emails to lowercase
- `stripHtml(html: string): string` — strips HTML tags for preview rendering
- `truncateBody(html: string, maxChars?: number): string` — strips + truncates for list previews

Created `src/hooks/campaigns/useCsvCampaign.ts`:
- `createCsvCampaign({ name, rows })` — three-step operation:
  1. Upsert contacts (workspace_id + email conflict resolution, preserves first/last name)
  2. Insert campaign row with `campaign_type: 'csv_personalized'`, empty subject/body_html (per-recipient content comes from CSV)
  3. Bulk insert `campaign_recipients` with `personalized_subject` + `personalized_body` per row; rolls back (deletes campaign) if this step fails
- `sendCsvCampaign(campaignId)` — invokes `send-campaign` Edge Function with explicit session token

## Verification Results

```
Task 1 check: PASS
Task 2 check: PASS
Final tsc --noEmit: clean (no errors)
```

## Decisions Made

1. **papaparse already installed** — `package.json` already had `papaparse: ^5.5.3` and `@types/papaparse: ^5.5.2`. No new dependency required.
2. **Cleanup on partial failure** — If `campaign_recipients` bulk insert fails after the campaign row is created, the hook deletes the campaign to avoid orphaned draft campaigns. This matches the A/B test pattern in `useCampaigns.ts`.
3. **`total_recipients` update** — After successful recipient insert, a separate `UPDATE` sets `total_recipients` on the campaign row. This is consistent with the existing `send-campaign` Edge Function flow.
4. **Empty `subject` / `body_html` on campaign row** — For `csv_personalized` campaigns, per-recipient content lives in `campaign_recipients.personalized_subject/body`. The campaign-level fields are intentionally empty strings (matching the A/B parent pattern).

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. The hook and parser are fully wired. The campaign row is created with intentionally empty `subject`/`body_html` fields — this is by design for `csv_personalized` campaigns where content is stored per-recipient in `personalized_subject`/`personalized_body`.

## Self-Check: PASSED

- `supabase/migrations/011_csv_personalized.sql` — FOUND
- `src/lib/csvParser.ts` — FOUND
- `src/hooks/campaigns/useCsvCampaign.ts` — FOUND
- `src/types/database.ts` — modified, FOUND
- Commit `aef6aed` — FOUND
- Commit `1eebf5e` — FOUND
- `tsc --noEmit` — clean
