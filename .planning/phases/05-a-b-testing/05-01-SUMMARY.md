---
phase: 05-a-b-testing
plan: 01
subsystem: database, api, ui
tags: [supabase, react, typescript, a-b-testing, edge-functions, react-router]

# Dependency graph
requires:
  - phase: 03-email-delivery-engine
    provides: send-campaign Edge Function that A/B test hooks invoke with contact_ids override
  - phase: 02-campaign-builder
    provides: Campaign interface and useCampaigns hook extended in this plan

provides:
  - supabase/migrations/007_ab_test_columns.sql — campaign_type and parent_campaign_id columns on campaigns table
  - CampaignType union type and AbTestSettings interface in src/types/database.ts
  - useAbTest hook for fetching parent + both variants in one OR query
  - useCampaigns A/B extensions: createAbTest, sendAbTestVariants, sendAbTestWinner
  - send-campaign Edge Function enhanced with optional contact_ids array override
  - App.tsx routes: /campaigns/ab-test/new, /campaigns/:id/ab-test/edit, /campaigns/:id/ab-results
  - AbTestBuilderPage and AbTestResultsPage placeholder components

affects:
  - 05-02-PLAN (A/B builder page — imports useAbTest, useCampaigns A/B functions)
  - 05-03-PLAN (A/B results page — imports useAbTest, uses sendAbTestWinner)
  - CampaignsPage (will show A/B test rows filtered by campaign_type != ab_variant)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Sibling-campaign A/B model — parent (ab_test) + two children (ab_variant) linked via parent_campaign_id
    - contact_ids override on send-campaign Edge Function for subset-send without Edge Function refactor
    - Fisher-Yates shuffle for random contact assignment client-side before Edge Function invocation
    - Hold-back group stored as hold_back_contact_ids array in parent campaign settings JSONB
    - .not('campaign_type', 'eq', 'ab_variant') filter in fetchCampaigns to hide variant rows from list

key-files:
  created:
    - supabase/migrations/007_ab_test_columns.sql
    - src/hooks/campaigns/useAbTest.ts
    - src/pages/campaigns/AbTestBuilderPage.tsx
    - src/pages/campaigns/AbTestResultsPage.tsx
  modified:
    - src/types/database.ts
    - src/hooks/campaigns/useCampaigns.ts
    - supabase/functions/send-campaign/index.ts
    - src/App.tsx
    - src/components/campaigns/VariableSlashCommand.ts

key-decisions:
  - "Hold-back contacts stored in parent campaign settings JSONB (hold_back_contact_ids array) — avoids new RecipientStatus value, acceptable since UUIDs only and read once at winner-send time"
  - "contact_ids override added to send-campaign Edge Function body param — surgical 1-branch change, avoids complex client-side recipient pre-insertion"
  - "CampaignInsert excludes campaign_type and parent_campaign_id from Omit then adds them as optional — preserves backward compat for all existing createCampaign callers"
  - "supabase db push skipped — CLI not linked (requires supabase login); migration 007 SQL file ready for manual apply via Supabase dashboard"

patterns-established:
  - "useAbTest pattern: single .or() query fetches parent + both variants in one round-trip; sorts variants by created_at ascending for deterministic A/B ordering"
  - "A/B test cascade soft-delete: deleteCampaign checks campaign_type === 'ab_test' and soft-deletes child variants via parent_campaign_id"

requirements-completed:
  - ABTS-01
  - ABTS-02
  - ABTS-04

# Metrics
duration: 25min
completed: 2026-04-14
---

# Phase 5 Plan 01: A/B Testing Foundation Summary

**Sibling-campaign A/B model with DB migration 007, CampaignType types, useAbTest hook, useCampaigns extensions (createAbTest/sendAbTestVariants/sendAbTestWinner), contact_ids override on send-campaign Edge Function, and three new App.tsx routes**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-14T01:42:00Z
- **Completed:** 2026-04-14T02:07:42Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Database migration 007 creates `campaign_type` (CHECK constraint: regular/ab_test/ab_variant) and `parent_campaign_id` (FK with ON DELETE CASCADE) on the campaigns table, with a partial index for variant lookups
- TypeScript types extended: `CampaignType` union, `AbTestSettings` interface, `Campaign` interface fields, and `CampaignInsert` with optional A/B fields preserving backward compatibility for all existing callers
- `useAbTest` hook fetches parent + both variants in a single `.or()` query, workspace-scoped, sorts variants by `created_at` for deterministic A/B ordering; `useCampaigns` extended with three A/B operations plus `ab_variant` filter in `fetchCampaigns`
- `send-campaign` Edge Function enhanced with optional `contact_ids` array override — when provided, loads contacts via `.in('id', contact_ids)` instead of full contact_list query (A/B subset-send)
- App.tsx wires `/campaigns/ab-test/new`, `/campaigns/:id/ab-test/edit`, `/campaigns/:id/ab-results` routes in correct static-before-parameterized order; placeholder page components created for Plans 02/03

## Task Commits

1. **Task 1: DB migration + TypeScript type extensions** - `5dd9806` (feat)
2. **Task 2: useAbTest hook + useCampaigns A/B extensions** - `d13f223` (feat)
3. **Task 3: Edge Function contact_ids + App.tsx routes + schema push** - `da79e4b` (feat)

## Files Created/Modified

- `supabase/migrations/007_ab_test_columns.sql` — ALTER TABLE campaigns; adds campaign_type, parent_campaign_id, idx_campaigns_parent index
- `src/types/database.ts` — CampaignType, AbTestSettings, Campaign (2 new fields), CampaignInsert (optional A/B fields)
- `src/hooks/campaigns/useAbTest.ts` — New hook: single OR query for parent+variants, workspace-scoped, sorted by created_at
- `src/hooks/campaigns/useCampaigns.ts` — createAbTest (3-row insert), sendAbTestVariants (Fisher-Yates + contact_ids), sendAbTestWinner (hold-back send), ab_variant filter, cascade soft-delete
- `supabase/functions/send-campaign/index.ts` — contact_ids override branch in step 9 contact loading
- `src/App.tsx` — Imports + 3 new routes for A/B builder and results pages
- `src/pages/campaigns/AbTestBuilderPage.tsx` — Placeholder (Plans 02 will implement)
- `src/pages/campaigns/AbTestResultsPage.tsx` — Placeholder (Plan 03 will implement)
- `src/components/campaigns/VariableSlashCommand.ts` — Pre-existing TS bug fixed (commandFn closure)

## Decisions Made

- **Hold-back storage via settings JSONB** — `hold_back_contact_ids` array stored in parent campaign's settings column at variant-send time, read once at winner-send time. Chosen over `pending_winner` status approach to avoid new migration scope. No PII stored — UUIDs only.
- **contact_ids override pattern** — Minimal Edge Function change (one conditional branch) vs. client-side pre-insertion or `skip_recipient_insert` flag approach. Keeps all delivery logic in the Edge Function.
- **CampaignInsert backward compat** — Excludes `campaign_type` and `parent_campaign_id` from the base Omit, adds them back as optional via intersection. All 10+ existing `createCampaign` callers in the codebase continue to work without changes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing VariableSlashCommand.ts TypeScript error**
- **Found during:** Task 1 (build verification)
- **Issue:** `SuggestionKeyDownProps` type from TipTap 2.x does not expose a `command` property on `onKeyDown` callback. The `onKeyDown` handler was calling `props.command(items[selectedIndex])` which fails type checking.
- **Fix:** Added `commandFn` closure variable initialized in `onStart` (where `props.command` is available on render props), updated `onKeyDown` to call `commandFn(items[selectedIndex])` instead.
- **Files modified:** `src/components/campaigns/VariableSlashCommand.ts`
- **Verification:** `npm run build` exits 0 (error was the only TS error blocking the build)
- **Committed in:** `5dd9806` (Task 1 commit)

**2. Authentication Gate: supabase db push skipped**
- **Found during:** Task 3 (schema push step)
- **Issue:** `npx supabase db push` and `npx supabase link --project-ref pozqnzhgqmajtaidtpkk` both fail — CLI requires `supabase login` or `SUPABASE_ACCESS_TOKEN` env var which is not configured in this environment.
- **Action:** Noted per plan instructions ("if it fails due to auth, flag for manual intervention"). Migration 007 SQL file is complete and ready to apply manually via the Supabase dashboard SQL editor.
- **Impact:** A/B test features will not function until migration 007 is applied to the live database. All frontend code is complete and build-verified.

---

**Total deviations:** 1 auto-fixed (Rule 1 - pre-existing bug), 1 auth gate (supabase db push)
**Impact on plan:** VariableSlashCommand fix was required for build to pass (pre-existing error blocked all task verification). Schema push auth gate is documented — migration file is ready for manual apply.

## Known Stubs

- `src/pages/campaigns/AbTestBuilderPage.tsx` — renders static placeholder text "A/B Test Builder — loading...". Full implementation planned in Plan 02.
- `src/pages/campaigns/AbTestResultsPage.tsx` — renders static placeholder text "A/B Test Results — loading...". Full implementation planned in Plan 03.

These stubs are intentional — they exist to satisfy the App.tsx import/route wiring in this plan while the actual page implementations are built in subsequent plans.

## Issues Encountered

- Pre-existing TypeScript build error in `VariableSlashCommand.ts` required fixing before any build verification could succeed. Fixed under Rule 1 (bug).

## User Setup Required

**Manual database step required:** Apply migration 007 to the live Supabase project:

1. Open Supabase dashboard → Project `pozqnzhgqmajtaidtpkk` → SQL Editor
2. Copy and run the contents of `supabase/migrations/007_ab_test_columns.sql`
3. Verify: `SELECT column_name FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name IN ('campaign_type', 'parent_campaign_id');`

Alternatively, run: `npx supabase login && npx supabase link --project-ref pozqnzhgqmajtaidtpkk && npx supabase db push`

## Next Phase Readiness

- Plan 02 (A/B builder page) can proceed — `useAbTest`, `useCampaigns.createAbTest/sendAbTestVariants` are available, route `/campaigns/ab-test/new` is wired, placeholder replaced by full component
- Plan 03 (A/B results page) can proceed — `useAbTest`, `useCampaigns.sendAbTestWinner` are available, route `/campaigns/:id/ab-results` is wired
- **Blocker:** Migration 007 must be applied to the live Supabase database before A/B test create/send operations will succeed at runtime (DB columns don't exist yet in production)

---
*Phase: 05-a-b-testing*
*Completed: 2026-04-14*
