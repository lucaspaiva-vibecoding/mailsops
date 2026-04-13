# Phase 4: Analytics & Dashboard - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-13
**Phase:** 04-analytics-dashboard
**Areas discussed:** Campaign analytics entry point, Event timeline format, Recipient engagement view, Dashboard stats & recent campaigns

---

## Campaign Analytics Entry Point

| Option | Description | Selected |
|--------|-------------|----------|
| Separate route /campaigns/:id/analytics | Dedicated analytics page, clean separation from builder | ✓ |
| Tab within campaign detail | Second tab alongside Builder | |
| Modal/sheet over campaign list | Stats sheet from the right | |

**User's choice:** Separate route `/campaigns/:id/analytics`
**Notes:** Clean separation from the builder — users can't accidentally edit while viewing stats.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Summary stat cards at top, sections below | 4-6 stat cards, then timeline / link breakdown / recipient table scrollable below | ✓ |
| Summary stat cards, then tabbed sections | Same top row, but sections in tabs | |
| Stats sidebar + main content area | Stats pinned left, main area scrolls | |

**User's choice:** Stat cards at top, sections below on same scrollable page.

---

## Event Timeline Format

| Option | Description | Selected |
|--------|-------------|----------|
| Table with event type, contact email, timestamp | Simple scannable table, sorted newest-first | ✓ |
| Visual vertical timeline component | Dot-on-line card style | |
| Both with toggle | Table + optional timeline view | |

**User's choice:** Table format.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Filter by event type only | Filter chips: All / Opened / Clicked / Bounced / Unsubscribed | ✓ |
| Filter by event type + date range | Event chips + date picker | |
| No filtering | Show all events | |

**User's choice:** Event type filter chips only.

---

## Recipient Engagement View

| Option | Description | Selected |
|--------|-------------|----------|
| Filter tabs (All / Opened / Clicked / Bounced / Unsubscribed) | Tab strip with count badges | ✓ |
| Single table with status column + filter dropdown | One table, filter above | |
| Separate sections per status | Collapsible cards per status | |

**User's choice:** Filter tabs above the recipient table.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Email + Status badge + key timestamp | 3 columns, minimal | |
| Email + Status + multiple timestamps | All timestamp columns | |
| Email + Status + full detail on row expand | Compact row, click to expand | ✓ |

**User's choice:** Compact row (email + status), click to expand shows all timestamps + device/client info.

---

## Dashboard Stats & Recent Campaigns

| Option | Description | Selected |
|--------|-------------|----------|
| Total Contacts, Campaigns Sent, Avg Open Rate, Unsubscribes | Maps to DASH-01 and DASH-03 | |
| Total Contacts, Campaigns Sent, Avg Open Rate, Avg Click Rate | More performance-focused | ✓ |
| Custom | User describes 4 cards | |

**User's choice:** Total Contacts, Campaigns Sent, Avg Open Rate, Avg Click Rate.
**Notes:** Unsubscribes dropped from dashboard stat cards (visible per-campaign in analytics instead).

---

| Option | Description | Selected |
|--------|-------------|----------|
| Last 5 sent campaigns with name, sent date, open rate, click rate | Only status='sent' | |
| Last 5 campaigns of any status | Drafts + scheduled + sent | |
| Last 5 sent + 'view all' link to /campaigns | Same as first + footer link | ✓ |

**User's choice:** Last 5 sent campaigns + "View all campaigns" link to `/campaigns`.

---

## Claude's Discretion

- Pagination vs load-more for event timeline and recipient table
- Empty state designs for analytics page with no events
- Exact icon choices for event type in timeline
- Division-by-zero guard for Avg Open Rate / Avg Click Rate calculation
- Loading skeleton vs spinner for analytics page sections

## Deferred Ideas

- Unsubscribe count stat card on dashboard
- GeoIP breakdown (ANLX-V2-01)
- Email client breakdown (ANLX-V2-02)
- Engagement over time chart (ANLX-V2-03)
- Visual timeline toggle view
