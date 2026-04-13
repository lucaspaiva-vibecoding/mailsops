---
phase: 04-analytics-dashboard
plan: 02
subsystem: analytics-ui
tags: [analytics, components, campaign-analytics-page, tailwind, react]
dependency_graph:
  requires:
    - 04-01  # useCampaignAnalytics hook, analyticsUtils, database types
  provides:
    - CampaignAnalyticsPage at /campaigns/:id/analytics
    - StatCard, FilterChips, EventTimeline, LinkBreakdown, RecipientTable reusable components
  affects:
    - src/pages/campaigns/CampaignAnalyticsPage.tsx
    - src/components/analytics/
tech_stack:
  added: []
  patterns:
    - Reusable analytics stat card wrapping existing Card component
    - FilterChips horizontal button strip with indigo active state
    - Expandable table rows with colSpan detail panel
    - Tab strip with inline count badges (D-05)
    - Lucide icon component map keyed by event_type
    - Two-step event-to-contact resolution consumed from hook
key_files:
  created:
    - src/components/analytics/StatCard.tsx
    - src/components/analytics/FilterChips.tsx
    - src/components/analytics/EventTimeline.tsx
    - src/components/analytics/LinkBreakdown.tsx
    - src/components/analytics/RecipientTable.tsx
    - src/pages/campaigns/CampaignAnalyticsPage.tsx
  modified: []
decisions:
  - Built local Lucide icon component map (Record<CampaignEventType, LucideIcon>) in EventTimeline rather than string names from analyticsUtils — avoids dynamic import issues and is type-safe
  - RecipientTable uses React.Fragment wrapper (shorthand <>) to render main row + expanded detail row as sibling pairs inside <tbody> without adding extra DOM elements
  - Used tab.value === statusFilter equality check for null === null "All" tab active state — no special casing needed
  - Kept FilterChips toggle-off behavior: clicking active chip passes null to onChange (resets to All)
  - Pagination hidden when totalCount <= PAGE_SIZE per plan spec
metrics:
  duration: "~20 minutes"
  completed: "2026-04-13"
  tasks_completed: 2
  tasks_total: 2
  files_created: 6
  files_modified: 0
---

# Phase 04 Plan 02: Analytics UI Components — Summary

**One-liner:** Six analytics components — StatCard, FilterChips, EventTimeline, LinkBreakdown, RecipientTable, CampaignAnalyticsPage — composing the full `/campaigns/:id/analytics` experience with tab count badges, expandable rows, paginated event timeline, and link breakdown table.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create StatCard and FilterChips reusable components | `3f9bf57` | StatCard.tsx, FilterChips.tsx |
| 2 | Create EventTimeline, LinkBreakdown, RecipientTable, CampaignAnalyticsPage | `5c4def9` | EventTimeline.tsx, LinkBreakdown.tsx, RecipientTable.tsx, CampaignAnalyticsPage.tsx |

## What Was Built

### StatCard (`src/components/analytics/StatCard.tsx`)
Reusable stat card matching DashboardPage pattern. Accepts `icon: LucideIcon`, `iconColor`, `label`, `value`, optional `subLabel`. Wraps `Card` component with a `w-10 h-10` icon container and `text-2xl font-semibold` value display per UI-SPEC.md typography.

### FilterChips (`src/components/analytics/FilterChips.tsx`)
Horizontal button strip with active indigo tint (`bg-indigo-600/20 text-indigo-400 border border-indigo-600/30`) and inactive gray state. Toggle-off behavior: clicking active chip calls `onChange(null)` to reset to All. Uses `<button>` elements for accessibility.

### EventTimeline (`src/components/analytics/EventTimeline.tsx`)
Event table with FilterChips for event type filtering, Lucide icon component map (`Record<CampaignEventType, LucideIcon>`), relative timestamps via `relativeTime()` with absolute tooltip via `title` attribute, and Prev/Next pagination shown only when `totalCount > PAGE_SIZE`.

### LinkBreakdown (`src/components/analytics/LinkBreakdown.tsx`)
Three-column table (URL, Total Clicks, Unique Clicks) with CSS `truncate max-w-xs` on URL cell and full URL in `title` attribute. Loading spinner and empty state when no links tracked.

### RecipientTable (`src/components/analytics/RecipientTable.tsx`)
Tab strip (All / Opened / Clicked / Bounced / Unsubscribed) with count badges on each tab per D-05, using `statusCounts` from `useCampaignAnalytics`. Expandable rows toggle via `expandedId` state, showing timestamp grid (`grid-cols-2 sm:grid-cols-3`) with `sent_at`, `delivered_at`, `opened_at`, `clicked_at`, `bounced_at`, `unsubscribed_at`. Status badge uses `STATUS_BADGE_VARIANT` from analyticsUtils.

### CampaignAnalyticsPage (`src/pages/campaigns/CampaignAnalyticsPage.tsx`)
Full analytics page at `/campaigns/:id/analytics`. Uses `useParams().id` → `useCampaignAnalytics`. Shows Spinner when `loading && !campaign`. Five-column stat card grid (Sent, Open Rate, Click Rate, Bounce Rate, Unsubscribes) using `formatRate()` with per-card subLabels. Composes EventTimeline, LinkBreakdown, RecipientTable below.

## Decisions Made

1. **Local Lucide icon component map in EventTimeline** — Used `Record<CampaignEventType, LucideIcon>` with direct named imports rather than consuming string names from `EVENT_ICON_MAP` in analyticsUtils. This is type-safe and avoids any dynamic component resolution complexity.

2. **React.Fragment pairs in RecipientTable tbody** — Each recipient renders as `<>` containing the main `<tr>` and an optional expanded `<tr>` as siblings. This is valid HTML and avoids invalid nesting.

3. **Null equality for All tab** — `tab.value === statusFilter` handles `null === null` correctly in JavaScript, so no special casing needed for the "All" tab active state.

4. **Pagination guard** — `totalCount > PAGE_SIZE` hides pagination controls entirely, keeping the UI clean for campaigns with few events/recipients.

## Deviations from Plan

None — plan executed exactly as written. All Tailwind classes, component structure, prop signatures, and UI-SPEC.md contracts followed.

## Known Stubs

None — all components receive live data via `useCampaignAnalytics` hook. No hardcoded values or mock data in any component.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced. All data is scoped to workspace via `useCampaignAnalytics` (T-04-04 mitigated by hook layer from Plan 01).

## Self-Check: PASSED

Files exist:
- FOUND: src/components/analytics/StatCard.tsx
- FOUND: src/components/analytics/FilterChips.tsx
- FOUND: src/components/analytics/EventTimeline.tsx
- FOUND: src/components/analytics/LinkBreakdown.tsx
- FOUND: src/components/analytics/RecipientTable.tsx
- FOUND: src/pages/campaigns/CampaignAnalyticsPage.tsx

Commits exist:
- FOUND: 3f9bf57 (Task 1 — StatCard, FilterChips)
- FOUND: 5c4def9 (Task 2 — EventTimeline, LinkBreakdown, RecipientTable, CampaignAnalyticsPage)

TypeScript: `npx tsc --noEmit` exits 0 — PASSED
ESLint: `npx eslint src/components/analytics/ src/pages/campaigns/CampaignAnalyticsPage.tsx` exits 0 — PASSED
