---
phase: 09-csv-personalized-campaigns
plan: "03"
subsystem: campaigns-ui
tags: [csv, campaigns, routing, review-page]
dependency_graph:
  requires: [09-01, 09-02]
  provides: [csv-review-page, campaigns-dropdown, csv-badge]
  affects: [CampaignsPage, App.tsx, routing]
tech_stack:
  added: []
  patterns: [dropdown-with-click-outside, guard-redirect, recipient-table]
key_files:
  created:
    - src/pages/campaigns/CsvReviewPage.tsx
  modified:
    - src/pages/campaigns/CampaignsPage.tsx
    - src/App.tsx
decisions:
  - "Removed FlaskConical import when collapsing A/B Test into unified dropdown — unused imports cause lint noise"
  - "Used CampaignRecipientWithContact type from database.ts (already existed at line 259) — no inline type needed"
  - "sent_at displayed in already-sent banner with analytics link — matches CampaignAnalyticsPage pattern"
metrics:
  duration: "5min"
  completed_date: "2026-04-15"
  tasks: 2
  files: 3
---

# Phase 09 Plan 03: CsvReviewPage + CampaignsPage dropdown + CSV badge — Summary

**One-liner:** Unified New Campaign dropdown (Standard / A/B Test / CSV Personalized), purple CSV badge in list, CsvReviewPage with recipient table and send/schedule controls wired to sendCsvCampaign Edge Function.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | CampaignsPage dropdown + CSV badge + row click routing | c021f3b | src/pages/campaigns/CampaignsPage.tsx |
| 2 | CsvReviewPage + route wiring | c021f3b | src/pages/campaigns/CsvReviewPage.tsx, src/App.tsx |

## What Was Built

### Task 1 — CampaignsPage (6 changes)

1. **Unified dropdown**: Replaced separate "New A/B test" and "New Campaign" buttons with a single "New Campaign" primary button that opens a dropdown with Standard, A/B Test, and CSV Personalized options. Click-outside handler added via `newCampaignMenuRef`.

2. **CSV badge**: Purple `bg-purple-900/50 text-purple-400` badge shown for `csv_personalized` campaigns alongside the status badge.

3. **handleRowClick routing**: `csv_personalized` campaigns route to `/campaigns/:id/csv-review` (checked first, before `ab_test` and standard branches).

4. **Row menu**: Edit button shows "Review" text and routes to csv-review for csv_personalized. Duplicate button hidden for csv_personalized (wrapped in `campaign_type !== 'csv_personalized'` guard).

5. **Target list column**: Shows `N recipients` for csv_personalized campaigns (since they have no `contact_list_id`).

6. **Import cleanup**: Removed unused `FlaskConical` import after collapsing the A/B Test button into the dropdown.

### Task 2 — CsvReviewPage

- Loads campaign via `useCampaign(id)` — filters by workspace_id (T-09-09 mitigation)
- Loads recipients via direct Supabase query with `contacts(email, first_name, last_name)` join
- Guard: redirects non-csv_personalized campaigns to `/campaigns/:id/edit`
- Recipient table: #, Name, Email, Subject, Body Preview (truncated to 80 chars via `truncateBody`), Status
- Reuses `SchedulingSection` for send-now / schedule-later controls
- Send Now: calls `sendCsvCampaign(id)` with confirmation dialog; T-09-08 mitigated by session check inside hook + Edge Function workspace validation
- Schedule: updates `status='scheduled'` and `scheduled_at` directly on campaigns table
- Already-sent state: shows sent date + analytics link instead of send controls
- Route `/campaigns/:id/csv-review` added to App.tsx between `/:id/ab-results` and `/:id/edit`

## Deviations from Plan

None — plan executed exactly as written.

The `CampaignRecipientWithContact` type referenced in the plan already existed in `src/types/database.ts` (line 259), so no inline type was needed. The `FlaskConical` import removal was a minor cleanup deviation (Rule 2: missing critical functionality — unused import would cause lint noise) that was handled inline.

## Verification

- `npx tsc --noEmit`: 0 errors
- `npm run lint`: 0 errors (5 pre-existing warnings, none introduced by this plan)
- Task 1 grep check: PASS
- Task 2 grep check: PASS

## Self-Check

### Files exist
- src/pages/campaigns/CsvReviewPage.tsx: FOUND
- src/pages/campaigns/CampaignsPage.tsx: FOUND (modified)
- src/App.tsx: FOUND (modified)

### Commits exist
- c021f3b: FOUND

## Self-Check: PASSED
