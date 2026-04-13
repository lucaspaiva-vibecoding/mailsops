# Phase 4: Analytics & Dashboard - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can see exactly how each campaign performed via a dedicated analytics page (per-campaign summary stats, chronological event timeline, link click breakdown, recipient engagement with expandable detail) — and get an account-wide overview on the dashboard (live stat cards, recent sent campaigns list).

</domain>

<decisions>
## Implementation Decisions

### D-01: Campaign Analytics Entry Point
- Dedicated route `/campaigns/:id/analytics` — separate from the campaign builder (`/campaigns/:id/edit`)
- Accessed via a "View analytics" action from the campaign list page
- Page layout: stat cards row at top, then scrollable sections below: Event Timeline, Link Breakdown, Recipient Engagement

### D-02: Analytics Page Stat Cards
- Top row shows 4-6 summary stat cards computed from the campaign's denormalized stats columns
- Key metrics: Sent, Open Rate (%), Click Rate (%), Bounce Rate (%), Unsubscribes
- Stats read directly from `campaigns.total_*` columns (no aggregation queries needed — already denormalized)

### D-03: Event Timeline
- Table format: columns are Event (icon + label), Contact (email), Time (relative timestamp, absolute on hover)
- Sorted newest-first by default
- Filter chips above the table: All / Opened / Clicked / Bounced / Unsubscribed
- Data source: `campaign_events` table joined with `contacts` for email display

### D-04: Link Breakdown Section
- Shows per-link click breakdown for the campaign
- Columns: URL (truncated), Total Clicks, Unique Clicks
- Data source: `campaign_links` table (already has `click_count` and `unique_clicks` denormalized)

### D-05: Recipient Engagement Table
- Tab strip above table: All / Opened / Clicked / Bounced / Unsubscribed (with count badge per tab)
- Default compact row: Contact email + Status badge
- Click to expand row: shows all timestamps (sent_at, opened_at, clicked_at, bounced_at, unsubscribed_at) + device/client info from `campaign_events`
- Data source: `campaign_recipients` joined with `contacts`

### D-06: Dashboard — Stat Cards
- Replaces existing 4 placeholder cards in `DashboardPage.tsx` with live data
- Cards: **Total Contacts** (from contacts table count), **Campaigns Sent** (campaigns with status='sent'), **Avg Open Rate** (average of total_opened/total_sent across sent campaigns), **Avg Click Rate** (average of total_clicked/total_sent)

### D-07: Dashboard — Recent Campaigns
- Shows last 5 campaigns with status = 'sent', ordered by `sent_at` DESC
- Columns: Campaign name, Sent date, Open Rate %, Click Rate %
- Clicking a row navigates to `/campaigns/:id/analytics`
- "View all campaigns" link at the bottom of the section → `/campaigns`

### Claude's Discretion
- Pagination vs load-more for event timeline and recipient table (likely pagination for simplicity)
- Empty state designs for analytics page when campaign has no events yet
- Exact icon choices for event type badges in timeline (Lucide icons)
- How to compute Avg Open Rate for dashboard (guard against division by zero when total_sent = 0)
- Loading skeleton vs spinner for analytics page sections

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Database Schema
- `docs/schema-v1.md` — Full DDL for `campaigns`, `campaign_recipients`, `campaign_events`, `campaign_links` tables; denormalized stats columns on campaigns; RLS policies

### Requirements
- `.planning/REQUIREMENTS.md` §Analytics (ANLX-01 to ANLX-04) — All per-campaign analytics acceptance criteria
- `.planning/REQUIREMENTS.md` §Dashboard (DASH-01 to DASH-03) — All dashboard acceptance criteria

### Project Foundation
- `.planning/ROADMAP.md` — Phase 4 scope, success criteria, and dependencies
- `CLAUDE.md` — Naming conventions, Tailwind patterns, dark theme, component structure

### Existing Code
- `src/pages/dashboard/DashboardPage.tsx` — Existing placeholder dashboard to replace with live data
- `src/components/ui/` — Card, Badge, Button, Spinner, Toast — all reusable as-is
- `src/hooks/useAuth.ts` — `profile.workspace_id` for all Supabase queries
- `src/lib/supabase.ts` — Supabase client patterns in use
- `src/types/database.ts` — TypeScript DB types (will need extension for analytics types)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Card` — padding variants — use as section wrappers (stat cards, timeline section, recipient table)
- `Badge` — variant (success/warning/danger/info/default) — use for recipient status display and event type chips
- `Button` — variant, loading state — use for filter actions, "View all" link
- `Spinner` — sm/md/lg — loading state for data fetches
- `useToast()` — error feedback if data fetch fails
- `DashboardPage.tsx` — existing file to be extended with live Supabase queries (not replaced from scratch)

### Established Patterns
- All Supabase queries MUST include `.eq('workspace_id', profile.workspace_id)` — checked in AuthContext
- Error handling: extract from Supabase response, store in state, display inline
- Loading state: boolean flag, show Spinner while fetching
- Auth access: `const { profile } = useAuth()` → `profile.workspace_id`
- Dark theme: `bg-gray-950` / `bg-gray-900` base, `text-gray-100` for primary text, `text-gray-400` for secondary

### Integration Points
- Add `/campaigns/:id/analytics` route in `src/App.tsx` (new route alongside existing campaign routes)
- `CampaignAnalyticsPage` component in `src/pages/campaigns/`
- `DashboardPage.tsx` — wire up live Supabase queries to replace placeholder `'—'` values
- Campaign list page (`/campaigns`) — add "View analytics" action per row linking to the analytics route

</code_context>

<specifics>
## Specific Ideas

- Stat cards on the analytics page should show rate as percentages (e.g., "24.5%") not raw counts where applicable; raw counts shown alongside for context (e.g., "24.5% (124 opens)")
- Avg Open Rate on dashboard should guard against division by zero (campaigns with total_sent = 0 excluded from average)
- Recent campaigns "View all" link at the bottom of the dashboard section → `/campaigns`

</specifics>

<deferred>
## Deferred Ideas

- Unsubscribe count stat card on dashboard (user chose Avg Click Rate instead — DASH-03 is partially deferred; unsubscribes visible per-campaign)
- GeoIP breakdown (opens/clicks by country) — ANLX-V2-01 in requirements, explicitly deferred to v2
- Email client breakdown — ANLX-V2-02, deferred to v2
- Engagement over time chart — ANLX-V2-03, deferred to v2
- Visual timeline component (dot on vertical line) — kept simple with table for MVP

</deferred>

---

*Phase: 04-analytics-dashboard*
*Context gathered: 2026-04-13*
