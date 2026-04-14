---
phase: 05-a-b-testing
plan: 02
subsystem: ui
tags: [react, typescript, tiptap, a-b-testing, tailwind]

# Dependency graph
requires:
  - phase: 05-a-b-testing-01
    provides: useAbTest hook, useCampaigns createAbTest/sendAbTestVariants/updateCampaign, AbTestSettings type, placeholder AbTestBuilderPage

provides:
  - src/components/campaigns/VariantTabStrip.tsx — accessible tab strip for Variant A / Variant B switching
  - src/components/campaigns/SplitPercentageInput.tsx — test group size input with derived A/B/hold-back breakdown
  - src/pages/campaigns/AbTestBuilderPage.tsx — full A/B test builder page with dual TipTap editors, shared settings, save draft, and send variants

affects:
  - 05-03-PLAN (A/B results page — uses AbTestBuilderPage route for edit navigation)
  - CampaignsPage (navigates to /campaigns/:id/ab-test/edit after create)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Dual TipTap editor instances always mounted, toggled via CSS block/hidden — preserves editor state and undo history across tab switches (per RESEARCH.md Pattern 5)
    - populatedA/populatedB guard flags — onUpdate callbacks return early until population is complete, preventing false dirty state during setContent calls (Pitfall 4 avoidance)
    - AbTestSettings JSONB cast via unknown intermediate — `as unknown as AbTestSettings` resolves TypeScript strict overlap error on Record<string, unknown> casts

key-files:
  created:
    - src/components/campaigns/VariantTabStrip.tsx
    - src/components/campaigns/SplitPercentageInput.tsx
  modified:
    - src/pages/campaigns/AbTestBuilderPage.tsx

key-decisions:
  - "dirtyA/dirtyB tracking state removed — TypeScript noUnusedLocals flag catches state vars that are set but never read in JSX; no beforeunload guard needed on this page (not in plan scope)"
  - "AbTestSettings cast uses unknown intermediate (as unknown as AbTestSettings) — direct cast from Record<string, unknown> fails TS strict overlap check since split_percentage is required but absent from Record type"

patterns-established:
  - "CSS block/hidden toggle for multi-editor pages: both editors always in DOM, parent div gets className={activeTab === 'A' ? 'block' : 'hidden'} — avoids TipTap re-mount cost"
  - "populated guard in onUpdate: if (!populatedX) return — keeps onUpdate callback present (required by TipTap API) without triggering dirty logic during setContent population"

requirements-completed:
  - ABTS-01
  - ABTS-02

# Metrics
duration: 4min
completed: 2026-04-14
---

# Phase 5 Plan 02: A/B Test Builder Page Summary

**VariantTabStrip + SplitPercentageInput components and full AbTestBuilderPage with dual TipTap editors, CSS-toggled variant panels, shared settings, and save draft / send variants flows**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-14T02:10:14Z
- **Completed:** 2026-04-14T02:14:32Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `VariantTabStrip` renders an accessible tab strip with `role="tablist"`, `role="tab"`, `aria-selected`, active state (`text-gray-100 border-indigo-500`), and inactive state (`text-gray-400 border-transparent`) per UI-SPEC exactly
- `SplitPercentageInput` renders a number input (8–90, step 2) with derived breakdown text "Variant A: X% · Variant B: X% · Hold-back: Y%" and a red validation message for out-of-range values
- `AbTestBuilderPage` fully implements D-02 (separate builder flow), D-03 (tab strip with dual TipTap editors), and D-04 (split percentage input with derived display); supports both create mode (`/campaigns/ab-test/new`) and edit mode (`/campaigns/:id/ab-test/edit`) via `useAbTest` hook population

## Task Commits

1. **Task 1: VariantTabStrip + SplitPercentageInput components** - `7171527` (feat)
2. **Task 2: AbTestBuilderPage full implementation** - `59a79d6` (feat)

## Files Created/Modified

- `src/components/campaigns/VariantTabStrip.tsx` — Tab strip component with tablist/tab roles, aria-selected, indigo active state
- `src/components/campaigns/SplitPercentageInput.tsx` — Number input 8–90%, derived Variant A/B/Hold-back breakdown, red validation for invalid range
- `src/pages/campaigns/AbTestBuilderPage.tsx` — Full builder: shared settings card, VariantTabStrip, two TipTap editors (always mounted, CSS-toggled), per-variant subject inputs with variable insertion, save draft, send test variants

## Decisions Made

- **Removed dirtyA/dirtyB tracking state** — TypeScript strict mode (`noUnusedLocals`) flags state variables that are set but never read in rendered output. Since no `beforeunload` guard is in scope for this page, the dirty flags were removed entirely. Population is still guarded by `populatedA`/`populatedB` flags in `onUpdate` callbacks.
- **AbTestSettings cast via `unknown` intermediate** — `parent.settings as unknown as AbTestSettings` resolves TypeScript TS2352 error (direct cast from `Record<string, unknown>` to `AbTestSettings` fails strict overlap check since `split_percentage: number` is required in `AbTestSettings` but absent from the generic record type).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused dirtyA/dirtyB state vars causing TS6133 compile error**
- **Found during:** Task 2 (build verification after AbTestBuilderPage implementation)
- **Issue:** `dirtyA` and `dirtyB` were declared with `useState` but only written to (via setters), never read in JSX output. TypeScript strict `noUnusedLocals` treats this as an error (TS6133).
- **Fix:** Removed `const [dirtyA, setDirtyA]` and `const [dirtyB, setDirtyB]` declarations and all `setDirtyA`/`setDirtyB` call sites. The `populatedA`/`populatedB` guards in `onUpdate` already prevent false dirty detection; no `beforeunload` guard is in scope for this page.
- **Files modified:** `src/pages/campaigns/AbTestBuilderPage.tsx`
- **Verification:** `npm run build` exits 0
- **Committed in:** `59a79d6` (Task 2 commit)

**2. [Rule 1 - Bug] Fixed AbTestSettings type cast via unknown intermediate**
- **Found during:** Task 2 (build verification)
- **Issue:** `parent.settings as AbTestSettings` produced TS2352 — TypeScript strict overlap check fails because `Record<string, unknown>` and `AbTestSettings` (which requires `split_percentage: number`) don't sufficiently overlap.
- **Fix:** Changed to `parent.settings as unknown as AbTestSettings` — the `unknown` intermediate satisfies the type checker for intentional JSONB-to-typed-interface casts.
- **Files modified:** `src/pages/campaigns/AbTestBuilderPage.tsx`
- **Verification:** `npm run build` exits 0
- **Committed in:** `59a79d6` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - Bug, both TypeScript strict mode errors)
**Impact on plan:** Both fixes required for build to pass. No scope changes, no behavioral changes — purely TypeScript type correctness.

## Issues Encountered

None beyond the two auto-fixed TypeScript errors documented above.

## User Setup Required

None - no external service configuration required for this plan.

## Known Stubs

None — AbTestBuilderPage is fully implemented. All form fields wire to real hooks (useCampaigns, useAbTest, useContactLists).

## Next Phase Readiness

- Plan 03 (A/B results page) can proceed — `useAbTest`, `useCampaigns.sendAbTestWinner` are available, route `/campaigns/:id/ab-results` is wired in App.tsx
- AbTestBuilderPage navigates to `/campaigns/:id/ab-results` after send (via `/campaigns` list which shows A/B test rows)
- **Blocker (carried from Plan 01):** Migration 007 must be applied to the live Supabase database before A/B test create/send operations will succeed at runtime

## Self-Check: PASSED

- FOUND: src/components/campaigns/VariantTabStrip.tsx
- FOUND: src/components/campaigns/SplitPercentageInput.tsx
- FOUND: src/pages/campaigns/AbTestBuilderPage.tsx
- FOUND: .planning/phases/05-a-b-testing/05-02-SUMMARY.md
- FOUND commit: 7171527 (Task 1)
- FOUND commit: 59a79d6 (Task 2)

---
*Phase: 05-a-b-testing*
*Completed: 2026-04-14*
