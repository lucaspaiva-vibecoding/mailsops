---
phase: 04-analytics-dashboard
plan: "03"
subsystem: dashboard-wiring
tags: [dashboard, campaigns, analytics, routing, live-data]
dependency_graph:
  requires: ["04-01"]
  provides: [live-dashboard, analytics-route, campaigns-analytics-nav]
  affects: [src/pages/dashboard/DashboardPage.tsx, src/pages/campaigns/CampaignsPage.tsx, src/App.tsx]
tech_stack:
  added: []
  patterns: [useDashboardStats hook consumption, StatCard reuse, conditional dropdown action]
key_files:
  modified:
    - src/pages/dashboard/DashboardPage.tsx
    - src/pages/campaigns/CampaignsPage.tsx
    - src/App.tsx
decisions:
  - "Used StatCard from Plan 02 directly — interface matched plan spec exactly (label, value, icon, iconColor)"
  - "Kept View all campaigns as a plain <button> element consistent with existing dashboard patterns"
  - "Secondary info line placed between stat cards and Recent Campaigns section for visual flow"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-13"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
---

# Phase 4 Plan 03: Dashboard Wiring and Analytics Route Summary

**One-liner:** Wired DashboardPage to live Supabase data via useDashboardStats, added Recent Campaigns table with analytics navigation, and registered /campaigns/:id/analytics route with CampaignsPage dropdown action.

---

## Commits

| Hash | Task | Files |
|------|------|-------|
| c07ce43 | Task 1: Replace DashboardPage with live data and recent campaigns table | src/pages/dashboard/DashboardPage.tsx |
| 8454492 | Task 2: Add analytics route to App.tsx and View analytics action to CampaignsPage | src/App.tsx, src/pages/campaigns/CampaignsPage.tsx |

---

## Tasks Completed

### Task 1: Replace DashboardPage with live data and recent campaigns table

Rewrote `src/pages/dashboard/DashboardPage.tsx` to replace all static placeholder content with live data from the `useDashboardStats()` hook created in Plan 01.

- Removed the static `stats` array and old placeholder Card
- Added four `StatCard` components (Total Contacts, Campaigns Sent, Avg Open Rate, Avg Click Rate) with proper icon colors matching the UI-SPEC
- Added secondary info line showing contact lists count and unsubscribed contacts count with correct pluralization
- Added Recent Campaigns table with clickable rows navigating to `/campaigns/:id/analytics`
- Added loading spinner, empty state ("No campaigns sent yet"), and error state
- Added "View all campaigns" footer link navigating to `/campaigns`
- Removed unused imports: `BarChart3`, `FileText`

### Task 2: Add analytics route to App.tsx and View analytics action to CampaignsPage

**App.tsx:** Added `CampaignAnalyticsPage` import and registered `<Route path="/campaigns/:id/analytics" element={<CampaignAnalyticsPage />} />` inside the AppLayout block, after the existing `/campaigns/:id/edit` route. The existing `/analytics` PlaceholderPage route was left completely untouched.

**CampaignsPage.tsx:** Added a "View analytics" button before the "Edit" button in the campaign dropdown menu. The button is conditionally rendered only when `campaign.status === 'sent'` and navigates to `/campaigns/${campaign.id}/analytics`. Copy is sentence-case per UI-SPEC copywriting contract.

---

## Deviations from Plan

None — plan executed exactly as written. `StatCard` and `CampaignAnalyticsPage` from Plan 02 were available as expected.

---

## Known Stubs

None. All stat card values are wired to live data from `useDashboardStats()`. The Recent Campaigns table reads real campaign data. The analytics navigation is functional end-to-end.

---

## Threat Flags

No new security surface introduced. All data access remains scoped through `useDashboardStats()` which enforces `workspace_id` filtering per Plan 01 (T-04-07 mitigation in place). Navigation links use campaign IDs already visible to the user (T-04-08 accepted). Route registration is purely declarative (T-04-09 accepted).

---

## Self-Check

Checking created/modified files exist:
- src/pages/dashboard/DashboardPage.tsx — exists (rewritten)
- src/App.tsx — exists (modified)
- src/pages/campaigns/CampaignsPage.tsx — exists (modified)

Checking commits exist:
- c07ce43 — feat(phase-04): Replace DashboardPage with live data and recent campaigns table
- 8454492 — feat(phase-04): Add analytics route to App.tsx and View analytics action to CampaignsPage

TypeScript: `npx tsc --noEmit` — exits 0 (zero errors)
ESLint: all three files — exits 0 (zero warnings or errors)

## Self-Check: PASSED
