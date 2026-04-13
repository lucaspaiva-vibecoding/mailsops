---
phase: 04-analytics-dashboard
plan: 01
subsystem: types-and-hooks
tags: [typescript, supabase, hooks, analytics, dashboard, types]
dependency_graph:
  requires: []
  provides:
    - src/types/database.ts (CampaignEvent, CampaignLink, CampaignEventWithContact, CampaignRecipientWithContact, RecipientStatusCounts, fixed CampaignRecipient)
    - src/lib/analyticsUtils.ts (formatRate, formatRateWithCount, relativeTime, EVENT_ICON_MAP, STATUS_BADGE_VARIANT)
    - src/hooks/campaigns/useCampaignAnalytics.ts (useCampaignAnalytics hook)
    - src/hooks/dashboard/useDashboardStats.ts (useDashboardStats hook)
  affects:
    - All subsequent plans in phase 04 (analytics page, dashboard page, campaigns list)
tech_stack:
  added: []
  patterns:
    - useState + useCallback + useEffect hook pattern (matches useCampaigns.ts, useContacts.ts)
    - Promise.all for parallel dashboard queries
    - Two-step event-to-contact resolution (avoids PostgREST multi-hop join)
    - Client-side rate computation with division-by-zero guard
    - Lightweight single-query + client-side count for tab badges
key_files:
  created:
    - src/lib/analyticsUtils.ts
    - src/hooks/campaigns/useCampaignAnalytics.ts
    - src/hooks/dashboard/useDashboardStats.ts
  modified:
    - src/types/database.ts
decisions:
  - "Two-step fetch for event-to-contact resolution: events -> recipient_ids -> contact_ids -> contacts (avoids PostgREST multi-hop join per RESEARCH.md Pitfall 5)"
  - "recipientStatusCounts computed from lightweight .select('status') query client-side (no N+1 queries, counts are campaign-wide totals)"
  - "Division-by-zero guard: denominator === 0 check before all rate computations; returns null/em-dash"
  - "formatRateWithCount includes label parameter for context ('124 opens') per CONTEXT.md Specifics"
metrics:
  duration: "~20 minutes"
  completed: "2026-04-13"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 1
---

# Phase 04 Plan 01: Foundation — Types and Data Hooks Summary

**One-liner:** Fixed stale CampaignRecipient types and added CampaignEvent/CampaignLink/RecipientStatusCounts interfaces; created analyticsUtils helpers (formatRate, relativeTime, EVENT_ICON_MAP) and two data hooks (useCampaignAnalytics with pagination/filtering/tab-counts, useDashboardStats with parallel queries and avg rate computation).

## Commits

| Hash | Task | Files |
|------|------|-------|
| a1c9f48 | Task 1: Fix database.ts types and add analytics interfaces | src/types/database.ts |
| b129ee0 | Task 2: Create analytics utility helpers and both data hooks | src/lib/analyticsUtils.ts, src/hooks/campaigns/useCampaignAnalytics.ts, src/hooks/dashboard/useDashboardStats.ts |

## What Was Built

### Task 1: database.ts type corrections

- **RecipientStatus** expanded from 5 stale values to full 10-value set matching schema-v1.md CHECK constraint: `pending | queued | sent | delivered | opened | clicked | replied | bounced | unsubscribed | failed`
- **CampaignRecipient** fixed: `status` (not `delivery_status`), `resend_message_id` (not `resend_email_id`), `variables` (not `link_map`), added `workspace_id`, `opened_at`, `clicked_at`, `replied_at`, `unsubscribed_at`
- **TrackingEvent** removed entirely — references non-existent `tracking_events` table
- **CampaignEventType** union type added: `sent | delivered | opened | clicked | replied | bounced | unsubscribed | complained`
- **CampaignEvent** interface added with all schema-v1.md columns: event_type, link_url, link_index, ip_address, user_agent, device_type, email_client, country, city, bounce_type, bounce_reason
- **CampaignLink** interface added: original_url, link_index, click_count, unique_clicks
- **CampaignEventWithContact** and **CampaignRecipientWithContact** composite types for joined queries
- **RecipientStatusCounts** interface for D-05 tab count badges: all, opened, clicked, bounced, unsubscribed
- **Database** interface: removed `tracking_events`, updated `campaign_recipients` Insert/Update, added `campaign_events` and `campaign_links`

### Task 2: analyticsUtils.ts + useCampaignAnalytics.ts + useDashboardStats.ts

**analyticsUtils.ts:**
- `formatRate(numerator, denominator)` — division-by-zero guard, returns em dash or `"24.5%"`
- `formatRateWithCount(numerator, denominator, label)` — with count context `"24.5% (124 opens)"`
- `getRateValue(numerator, denominator)` — returns `number | null` for programmatic use
- `relativeTime(isoString)` — uses `Intl.RelativeTimeFormat` for "2 hours ago" etc.
- `EVENT_ICON_MAP` — maps CampaignEventType to Lucide icon name strings
- `EVENT_COLOR_MAP` — maps event types to Tailwind color classes
- `EVENT_LABEL_MAP` — maps event types to display labels
- `STATUS_BADGE_VARIANT` — maps RecipientStatus to Badge variant prop
- `PAGE_SIZE = 50` — shared constant matching useContacts.ts

**useCampaignAnalytics.ts:**
- Accepts `campaignId: string | undefined`
- Campaign fetch: single `.eq('id').eq('workspace_id').single()` query
- Events fetch: paginated (PAGE_SIZE=50, `.range(from, to)`), filtered by `eventTypeFilter` (.eq('event_type')), ordered newest-first; `eventsPage + setEventsPage` state
- Links fetch: all links ordered by `link_index`
- Recipients fetch: paginated, filtered by `recipientStatusFilter`, with embedded `contacts ( email, first_name, last_name )` join; `recipientsPage + setRecipientsPage` state
- `recipientStatusCounts`: lightweight `.select('status')` query for all campaign recipients, counted client-side — runs only on campaignId change, not on filter/page change
- `setEventTypeFilter` / `setRecipientStatusFilter` wrappers that auto-reset their respective page to 1
- `resolveEventContacts` helper for two-step event-to-contact resolution (exposed for consumers)
- All queries include `.eq('workspace_id', profile.workspace_id)` (T-04-01 mitigation)

**useDashboardStats.ts:**
- Single `fetchDashboardStats` runs 6 queries in parallel via `Promise.all`
- contacts count (active, not deleted), sent campaigns count, recent 5 campaigns (full row for stat display), all sent campaigns stats (for avg rate), contact lists count, unsubscribed contacts count
- Avg open/click rate computed client-side: filters `total_sent > 0` first (division-by-zero guard), then averages ratios across all valid sent campaigns
- Returns `null` for rates when no valid campaigns exist (displayed as em dash in UI)
- All queries include `.eq('workspace_id', profile.workspace_id)` (T-04-03 mitigation)

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

**One note:** `formatRateWithCount` in the plan spec had the `label` parameter present in the signature but the implementation body just returned `${rate.toFixed(1)}%` without using it. The actual implementation correctly includes the label in the output `"24.5% (124 opens)"` to match CONTEXT.md Specifics. This was a spec body typo — the function signature and usage intent from context were clear.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Both hooks are pure read hooks using the existing Supabase client with workspace_id scoping (T-04-01, T-04-03 mitigations applied). No new threat surface beyond what the plan's threat model documented.

## Known Stubs

None — this plan creates data layer only (types + hooks). No UI rendering, no placeholder values wired to components.

## Self-Check: PASSED

**Files exist:**
- `/Users/lucaspaiva/vibe coding/dna/mailsops/src/types/database.ts` — FOUND
- `/Users/lucaspaiva/vibe coding/dna/mailsops/src/lib/analyticsUtils.ts` — FOUND
- `/Users/lucaspaiva/vibe coding/dna/mailsops/src/hooks/campaigns/useCampaignAnalytics.ts` — FOUND
- `/Users/lucaspaiva/vibe coding/dna/mailsops/src/hooks/dashboard/useDashboardStats.ts` — FOUND

**Commits exist:**
- `a1c9f48` — FOUND (Task 1: fix database.ts types)
- `b129ee0` — FOUND (Task 2: analytics utilities and hooks)

**TypeScript:** `npx tsc --noEmit` exits 0 — PASSED
**ESLint:** exits 0 on all four files — PASSED
**Stale identifiers removed:** TrackingEvent, tracking_events, resend_email_id, delivery_status, link_map — all ABSENT from database.ts
