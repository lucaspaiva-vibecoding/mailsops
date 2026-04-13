# Phase 4: Analytics & Dashboard - Research

**Researched:** 2026-04-13
**Domain:** React data-display UI — Supabase read-only queries, stat computation, tabbed tables, campaign analytics page
**Confidence:** HIGH

## Summary

Phase 4 is a pure read/display phase. No new database tables are required. All data sources (campaigns, campaign_recipients, campaign_events, campaign_links, contacts, contact_lists) already exist with RLS applied. The analytics page (`/campaigns/:id/analytics`) reads from four existing tables; the dashboard reads from three. Every stat displayed can be computed either from denormalized columns on `campaigns` (open rate, click rate, bounce rate) or from straightforward Supabase `.select()` queries with filters.

The architecture follows the project's established hook-per-feature pattern: one new hook per data concern (`useCampaignAnalytics`, `useDashboardStats`), pages composed from existing `Card`, `Badge`, `Button`, `Spinner` components. No third-party libraries are needed beyond what is already installed. TypeScript types for `CampaignRecipient` and `CampaignEvent` must be added to `src/types/database.ts` — the current file has placeholders (`TrackingEvent`) that don't match the actual schema columns documented in `schema-v1.md` and the MEMORY.md notes.

**Primary recommendation:** Keep all data-fetching in dedicated hooks, compute rates in TypeScript (not SQL), and use pagination (page/pageSize pattern matching `useContacts`) for both the event timeline and recipient table to avoid unbounded query results.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01: Campaign Analytics Entry Point**
- Dedicated route `/campaigns/:id/analytics` — separate from the campaign builder (`/campaigns/:id/edit`)
- Accessed via a "View analytics" action from the campaign list page
- Page layout: stat cards row at top, then scrollable sections below: Event Timeline, Link Breakdown, Recipient Engagement

**D-02: Analytics Page Stat Cards**
- Top row shows 4-6 summary stat cards computed from the campaign's denormalized stats columns
- Key metrics: Sent, Open Rate (%), Click Rate (%), Bounce Rate (%), Unsubscribes
- Stats read directly from `campaigns.total_*` columns (no aggregation queries needed — already denormalized)

**D-03: Event Timeline**
- Table format: columns are Event (icon + label), Contact (email), Time (relative timestamp, absolute on hover)
- Sorted newest-first by default
- Filter chips above the table: All / Opened / Clicked / Bounced / Unsubscribed
- Data source: `campaign_events` table joined with `contacts` for email display

**D-04: Link Breakdown Section**
- Shows per-link click breakdown for the campaign
- Columns: URL (truncated), Total Clicks, Unique Clicks
- Data source: `campaign_links` table (already has `click_count` and `unique_clicks` denormalized)

**D-05: Recipient Engagement Table**
- Tab strip above table: All / Opened / Clicked / Bounced / Unsubscribed (with count badge per tab)
- Default compact row: Contact email + Status badge
- Click to expand row: shows all timestamps (sent_at, opened_at, clicked_at, bounced_at, unsubscribed_at) + device/client info from `campaign_events`
- Data source: `campaign_recipients` joined with `contacts`

**D-06: Dashboard — Stat Cards**
- Replaces existing 4 placeholder cards in `DashboardPage.tsx` with live data
- Cards: **Total Contacts** (from contacts table count), **Campaigns Sent** (campaigns with status='sent'), **Avg Open Rate** (average of total_opened/total_sent across sent campaigns), **Avg Click Rate** (average of total_clicked/total_sent)

**D-07: Dashboard — Recent Campaigns**
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

### Deferred Ideas (OUT OF SCOPE)
- Unsubscribe count stat card on dashboard (user chose Avg Click Rate instead — DASH-03 is partially deferred; unsubscribes visible per-campaign)
- GeoIP breakdown (opens/clicks by country) — ANLX-V2-01 in requirements, explicitly deferred to v2
- Email client breakdown — ANLX-V2-02, deferred to v2
- Engagement over time chart — ANLX-V2-03, deferred to v2
- Visual timeline component (dot on vertical line) — kept simple with table for MVP
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ANLX-01 | User can view per-campaign summary stats (sent, delivered, open rate, click rate, bounce rate, unsubscribe rate) | D-02: Read directly from `campaigns.total_*` columns; compute rates as percentage in TypeScript |
| ANLX-02 | User can see a chronological event timeline for a campaign | D-03: Query `campaign_events` joined with `contacts`, paginated, filter by event_type |
| ANLX-03 | User can see per-link click breakdown with click count and unique clicks | D-04: Query `campaign_links` for the campaign; `click_count` and `unique_clicks` are already denormalized |
| ANLX-04 | User can see per-recipient engagement — who opened, clicked, bounced, or unsubscribed | D-05: Query `campaign_recipients` joined with `contacts`; expand row to show timestamps + device info from `campaign_events` |
| DASH-01 | User sees account-wide summary stats: total contacts, total campaigns sent, average open rate | D-06: Three Supabase queries — contacts count, campaigns count, avg rate computed client-side |
| DASH-02 | User sees a list of recent campaigns with name, status, sent date, and open/click rates | D-07: Query last 5 sent campaigns; compute rates from `total_opened / total_sent` |
| DASH-03 | User sees total number of contact lists and unsubscribe count | D-06: Contact lists count from `contact_lists` table; unsubscribed contacts from `contacts` table filtered by status='unsubscribed' |
</phase_requirements>

---

## Standard Stack

### Core (all already installed) [VERIFIED: codebase grep]

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | 2.49.4 | Data fetching from all analytics tables | Already used; established `.from().select().eq()` pattern |
| react | 19.0.0 | Component rendering | Project foundation |
| react-router-dom | 7.5.3 | New `/campaigns/:id/analytics` route | Already used for campaign routes |
| lucide-react | 0.511.0 | Event type icons in timeline (Mail, MousePointer, AlertCircle, etc.) | Already used throughout app |
| tailwindcss | 4.1.4 | All layout and styling | Project-wide convention |

### Supporting (already installed, reused as-is)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Card | project component | Section wrappers for stat cards, timeline, tables | All analytics sections |
| Badge | project component | Status badges, event type chips, tab count badges | Recipient status, event filter chips |
| Button | project component | Filter chip buttons, "View all" link | Tab strip, pagination, nav link |
| Spinner | project component | Loading states during data fetch | Per-section fetch loading |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Client-side rate computation | Supabase RPC/aggregate query | Client-side is simpler for this data volume; denormalized columns exist exactly for this purpose |
| Pagination | Infinite scroll / load-more | Pagination matches existing `useContacts` pattern and is simpler to implement and test |
| Spinner for loading | Skeleton screens | Both valid (Claude's discretion); Spinner matches existing page patterns |

**Installation:** No new packages required. All dependencies already in `package-lock.json`. [VERIFIED: package.json inspection]

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── hooks/
│   ├── campaigns/
│   │   ├── useCampaigns.ts          # existing
│   │   ├── useCampaign.ts           # existing
│   │   └── useCampaignAnalytics.ts  # NEW — events, links, recipients for analytics page
│   └── dashboard/
│       └── useDashboardStats.ts     # NEW — stat cards + recent campaigns for dashboard
├── pages/
│   ├── campaigns/
│   │   ├── CampaignsPage.tsx        # existing — add "View analytics" menu item
│   │   ├── CampaignBuilderPage.tsx  # existing — untouched
│   │   └── CampaignAnalyticsPage.tsx # NEW
│   └── dashboard/
│       └── DashboardPage.tsx        # existing — replace placeholder stats with live data
└── types/
    └── database.ts                  # existing — add CampaignEvent, fix CampaignRecipient
```

### Pattern 1: Hook-Per-Feature (established project pattern)

**What:** Each data concern gets its own hook with `useState` + `useCallback` + `useEffect` pattern.

**When to use:** Any new data-fetching concern. Matches `useCampaigns`, `useCampaign`, `useContacts`, `useContactLists`.

**Example — useCampaignAnalytics shape:**
```typescript
// Source: modeled on src/hooks/campaigns/useCampaigns.ts [VERIFIED: codebase]
export function useCampaignAnalytics(campaignId: string | undefined) {
  const { profile } = useAuth()
  const [events, setEvents] = useState<CampaignEventWithContact[]>([])
  const [links, setLinks] = useState<CampaignLink[]>([])
  const [recipients, setRecipients] = useState<CampaignRecipientWithContact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // pagination state for events and recipients
  const [eventsPage, setEventsPage] = useState(1)
  const [recipientsPage, setRecipientsPage] = useState(1)
  // filter state
  const [eventTypeFilter, setEventTypeFilter] = useState<string | null>(null)
  const [recipientStatusFilter, setRecipientStatusFilter] = useState<string | null>(null)
  // ...fetch logic...
  return { events, links, recipients, loading, error, /* pagination/filter controls */ }
}
```

### Pattern 2: Supabase Join via `.select()` with embedded relation

**What:** Fetch related data in a single query using Supabase PostgREST foreign key embedding.

**When to use:** Event timeline needs contact email; recipient table needs contact email — both joinable in one query.

**Example — campaign_events joined with contacts:**
```typescript
// Source: Supabase PostgREST docs [CITED: supabase.com/docs/guides/api/joins-and-nesting]
const { data, error } = await supabase
  .from('campaign_events')
  .select(`
    id,
    event_type,
    link_url,
    device_type,
    email_client,
    created_at,
    contacts ( email, first_name, last_name )
  `)
  .eq('campaign_id', campaignId)
  .eq('workspace_id', profile.workspace_id)
  .order('created_at', { ascending: false })
  .range(from, to)
```

**Note:** The join goes through `campaign_events.recipient_id -> campaign_recipients.contact_id -> contacts.id`. Since PostgREST foreign key embedding follows the direct FK path, the event-to-contact join requires going through `campaign_recipients`. Alternatively, a two-step fetch (events first, then contacts by IDs) is safer if the FK path is indirect. [ASSUMED — join path depends on how FKs are set up in Supabase; verify against actual Supabase schema before implementing]

### Pattern 3: Client-Side Rate Computation with Division-by-Zero Guard

**What:** Compute percentage rates from denormalized `total_*` columns in TypeScript.

**When to use:** Analytics stat cards, dashboard avg open rate.

```typescript
// Source: standard TypeScript pattern [ASSUMED — simple arithmetic, no library needed]
function computeRate(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null
  return Math.round((numerator / denominator) * 1000) / 10  // one decimal, e.g. 24.5
}

// Dashboard avg open rate — exclude campaigns where total_sent = 0
const validCampaigns = sentCampaigns.filter(c => c.total_sent > 0)
const avgOpenRate = validCampaigns.length === 0
  ? null
  : validCampaigns.reduce((sum, c) => sum + c.total_opened / c.total_sent, 0) / validCampaigns.length * 100
```

### Pattern 4: Pagination matching useContacts

**What:** Page/pageSize state in the hook; `query.range(from, to)` on the Supabase query.

**When to use:** Event timeline and recipient engagement table — both can have many rows.

```typescript
// Source: src/hooks/contacts/useContacts.ts [VERIFIED: codebase]
const PAGE_SIZE = 50
const from = (page - 1) * PAGE_SIZE
const to = from + PAGE_SIZE - 1
query = query.range(from, to)
```

### Pattern 5: Tab Strip Filter UI

**What:** State variable holding active tab; filter applied to query or to already-loaded data.

**When to use:** Event timeline filter chips (All/Opened/Clicked/Bounced/Unsubscribed) and Recipient Engagement tabs.

**Two approaches:**
1. **Server-side filter:** Pass `eventTypeFilter` into the hook, re-fetch on change. Correct for large datasets.
2. **Client-side filter:** Fetch all events once, filter in memory. Acceptable if paginated fetch is small.

Recommended: server-side filter for events (can be many); client-side acceptable for recipients if tab counts are pre-computed in a single query.

### Pattern 6: Expandable Table Row

**What:** `useState<string | null>` tracking which row id is expanded; conditional rendering of detail section inside the `<tr>` using an additional `<tr>` with `colSpan`.

**When to use:** Recipient engagement table expand-to-see-timestamps pattern (D-05).

```typescript
// Source: standard React pattern [ASSUMED]
const [expandedId, setExpandedId] = useState<string | null>(null)

// In the table:
<tr onClick={() => setExpandedId(r.id === expandedId ? null : r.id)}>...</tr>
{expandedId === r.id && (
  <tr>
    <td colSpan={3}>
      {/* timestamp grid, device info */}
    </td>
  </tr>
)}
```

### Anti-Patterns to Avoid

- **Aggregating in SQL via `.rpc()`:** Unnecessary — denormalized `total_*` columns exist specifically for this. Don't hand-roll aggregate functions.
- **Fetching all events without pagination:** `campaign_events` can have hundreds of rows per campaign recipient. Always paginate.
- **Computing rates in SQL:** Keep rate math in TypeScript where division-by-zero guard is simpler to reason about and test.
- **Skipping `workspace_id` filter:** Every query MUST include `.eq('workspace_id', profile.workspace_id)`. Without it, RLS still protects data, but the query is unnecessarily broad. Established project rule.
- **Using the wrong column names:** `database.ts` currently has stale `CampaignRecipient` interface (uses `delivery_status`, `resend_email_id`, `link_map`). Actual schema columns per `schema-v1.md` and MEMORY.md are `status`, `resend_message_id`, `variables`. Must fix before implementing.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Relative timestamps ("2 hours ago") | Custom date math function | `Intl.RelativeTimeFormat` or a simple helper | Standard browser API; edge cases (just now, yesterday, etc.) are tricky |
| URL truncation for link breakdown | Manual string slice | CSS `truncate` class (Tailwind) | Visual truncation with title tooltip is simpler and responsive |
| Tab count badges | Separate count query per tab | Single query with all recipients, count client-side by status | Avoids N+1 queries; counts are cheap to compute from a full page load |
| Stat rate computation | SQL aggregate RPCs | TypeScript helper using `total_*` columns | Denormalized columns exist for this exact purpose |
| Supabase join for contacts | Separate contacts query + manual merge | PostgREST embedded select or two-step fetch with `.in('id', contactIds)` | Single round-trip; matches existing patterns |

**Key insight:** The entire analytics page is a pure read display. Every number either already lives in a denormalized column or can be derived from a simple filtered query. No custom aggregation, no RPCs, no edge functions needed for Phase 4.

---

## Type System Gap (Critical)

**The `CampaignRecipient` and `TrackingEvent` interfaces in `src/types/database.ts` are stale and must be replaced.** [VERIFIED: cross-reference of database.ts vs schema-v1.md vs MEMORY.md]

Current `database.ts` has:
```typescript
// WRONG — stale placeholders
export interface CampaignRecipient {
  resend_email_id: string | null      // actual column: resend_message_id
  delivery_status: RecipientStatus    // actual column: status
  link_map: Record<string, string> | null  // actual column: variables (jsonb)
}
```

Must be updated to match actual schema:
```typescript
export type RecipientStatus =
  | 'pending' | 'queued' | 'sent' | 'delivered' | 'opened'
  | 'clicked' | 'replied' | 'bounced' | 'unsubscribed' | 'failed'

export interface CampaignRecipient {
  id: string
  campaign_id: string
  contact_id: string
  workspace_id: string
  status: RecipientStatus
  resend_message_id: string | null
  variables: Record<string, string>
  sent_at: string | null
  delivered_at: string | null
  opened_at: string | null
  clicked_at: string | null
  replied_at: string | null
  bounced_at: string | null
  unsubscribed_at: string | null
  tracking_id: string
  created_at: string
}

export type CampaignEventType =
  | 'sent' | 'delivered' | 'opened' | 'clicked'
  | 'replied' | 'bounced' | 'unsubscribed' | 'complained'

export interface CampaignEvent {
  id: string
  campaign_id: string
  recipient_id: string
  workspace_id: string
  event_type: CampaignEventType
  link_url: string | null
  link_index: number | null
  ip_address: string | null
  user_agent: string | null
  device_type: string | null
  email_client: string | null
  country: string | null
  city: string | null
  bounce_type: 'hard' | 'soft' | null
  bounce_reason: string | null
  created_at: string
}

export interface CampaignLink {
  id: string
  campaign_id: string
  original_url: string
  link_index: number
  click_count: number
  unique_clicks: number
  created_at: string
}
```

New composite types for joined queries:
```typescript
export interface CampaignEventWithContact extends CampaignEvent {
  contacts: Pick<Contact, 'email' | 'first_name' | 'last_name'> | null
}

export interface CampaignRecipientWithContact extends CampaignRecipient {
  contacts: Pick<Contact, 'email' | 'first_name' | 'last_name'> | null
}
```

The `TrackingEvent` interface and `RecipientStatus` type alias should be removed from `database.ts` as they reference non-existent tables/columns.

---

## Common Pitfalls

### Pitfall 1: Stale Type Interface for CampaignRecipient
**What goes wrong:** TypeScript code compiles (no type errors) because the interface matches what you wrote, but Supabase returns runtime data with different column names — `status` not `delivery_status`, `resend_message_id` not `resend_email_id`.
**Why it happens:** `database.ts` was scaffolded before the actual migration was applied. MEMORY.md documents the discrepancy.
**How to avoid:** Fix the interface in Wave 0 (first task of the plan) before writing any analytics query code.
**Warning signs:** Supabase query returns data but TypeScript casts show `undefined` for fields you expect.

### Pitfall 2: Division by Zero in Rate Computation
**What goes wrong:** Open rate displays `NaN%` or `Infinity%` for campaigns with `total_sent = 0` (e.g., a campaign that was created but the send failed partway through).
**Why it happens:** `total_opened / total_sent` with `total_sent = 0`.
**How to avoid:** Always guard: `total_sent > 0 ? (total_opened / total_sent * 100) : null`. Display `—` when null.
**Warning signs:** Stat card shows "NaN%" or "Infinity%".

### Pitfall 3: Missing workspace_id on Joined Tables
**What goes wrong:** Supabase query on `campaign_events` or `campaign_recipients` succeeds but returns empty or unexpected data.
**Why it happens:** RLS on these tables uses `workspace_id = ...` — if you forget `.eq('workspace_id', profile.workspace_id)`, the query is valid but may return 0 rows under some RLS configurations or all rows under permissive policies.
**How to avoid:** Every `.from()` query in this phase MUST include `.eq('workspace_id', profile.workspace_id)`.
**Warning signs:** Empty results even when you know data exists.

### Pitfall 4: Unbounded Event Timeline Query
**What goes wrong:** A campaign with many recipients (500+) could generate thousands of events. Fetching all without pagination causes slow page load and large data transfer.
**Why it happens:** No `.range()` applied to the query.
**How to avoid:** Always apply `.range(from, to)` on `campaign_events` and `campaign_recipients` queries. Use `PAGE_SIZE = 50` matching `useContacts` pattern.
**Warning signs:** Timeline section takes several seconds to load for large campaigns.

### Pitfall 5: PostgREST Join Path for campaign_events → contacts
**What goes wrong:** Supabase embedded select `contacts ( email )` on `campaign_events` fails or returns null because `campaign_events` has no direct FK to `contacts` — the path is `campaign_events.recipient_id -> campaign_recipients.id -> campaign_recipients.contact_id -> contacts.id`.
**Why it happens:** PostgREST follows FK chains; an indirect join (two hops) may not auto-resolve.
**How to avoid:** Either (a) use a two-step fetch: get events, extract `recipient_id`s, then fetch `campaign_recipients` to get `contact_id`s, then fetch contacts; or (b) add a `contact_id` denormalized column to `campaign_events` if this proves necessary. For MVP, the two-step approach is safest.
**Warning signs:** Supabase returns `null` for the embedded `contacts` relation on events.

### Pitfall 6: Route Conflict with Existing `/analytics` Placeholder
**What goes wrong:** The existing `/analytics` route in `App.tsx` (line 38: `<Route path="/analytics" element={<PlaceholderPage title="Analytics" />} />`) conflicts conceptually but not technically with `/campaigns/:id/analytics`. They are separate routes. The placeholder should remain until a future phase replaces it.
**Why it happens:** Developer tries to reuse the existing `/analytics` route for campaign-level analytics.
**How to avoid:** Add the new route `/campaigns/:id/analytics` as a sibling to the existing campaign routes in `App.tsx`, leaving `/analytics` untouched.

### Pitfall 7: Sidebar Navigation Does Not Link to Analytics
**What goes wrong:** The new analytics page is reachable only from the campaign list — there is no top-level sidebar navigation item for it, and that is correct per D-01. A developer might try to add a sidebar nav item for `/analytics` that points to campaign analytics, which would be confusing.
**How to avoid:** The analytics page is entered via the campaign list "View analytics" action, not via sidebar navigation. Sidebar `/analytics` remains a placeholder.

---

## Code Examples

Verified patterns from project codebase:

### Dashboard Stats Query — Contacts Count
```typescript
// Source: modeled on useContacts.ts pattern [VERIFIED: codebase]
const { count: contactCount, error } = await supabase
  .from('contacts')
  .select('id', { count: 'exact', head: true })
  .eq('workspace_id', profile.workspace_id)
  .is('deleted_at', null)
  .eq('status', 'active')  // or omit to count all non-deleted
```

### Dashboard Stats Query — Campaigns Sent Count
```typescript
// Source: modeled on useCampaigns.ts pattern [VERIFIED: codebase]
const { count: sentCount, error } = await supabase
  .from('campaigns')
  .select('id', { count: 'exact', head: true })
  .eq('workspace_id', profile.workspace_id)
  .eq('status', 'sent')
  .is('deleted_at', null)
```

### Dashboard Stats Query — Recent Campaigns (last 5 sent)
```typescript
// Source: modeled on useCampaigns.ts pattern [VERIFIED: codebase]
const { data, error } = await supabase
  .from('campaigns')
  .select('id, name, sent_at, total_sent, total_opened, total_clicked')
  .eq('workspace_id', profile.workspace_id)
  .eq('status', 'sent')
  .is('deleted_at', null)
  .order('sent_at', { ascending: false })
  .limit(5)
```

### Analytics Page — Link Breakdown
```typescript
// Source: schema-v1.md [VERIFIED: codebase]
const { data: links, error } = await supabase
  .from('campaign_links')
  .select('id, original_url, link_index, click_count, unique_clicks')
  .eq('campaign_id', campaignId)
  .order('link_index', { ascending: true })
```

### Analytics Page — Campaign Events (paginated, filtered)
```typescript
// Source: modeled on useContacts.ts pagination [VERIFIED: codebase]
let query = supabase
  .from('campaign_events')
  .select('id, event_type, link_url, device_type, email_client, created_at, recipient_id', { count: 'exact' })
  .eq('campaign_id', campaignId)
  .eq('workspace_id', profile.workspace_id)
  .order('created_at', { ascending: false })
  .range(from, to)

if (eventTypeFilter) {
  query = query.eq('event_type', eventTypeFilter)
}
```

### Rate Display Helper
```typescript
// Source: standard TypeScript [ASSUMED — simple arithmetic]
function formatRate(numerator: number, denominator: number): string {
  if (denominator === 0) return '—'
  const rate = (numerator / denominator) * 100
  return `${rate.toFixed(1)}%`
}

function formatRateWithCount(numerator: number, denominator: number): string {
  if (denominator === 0) return '—'
  const rate = (numerator / denominator) * 100
  return `${rate.toFixed(1)}% (${numerator.toLocaleString()})`
}
```

### Relative Timestamp
```typescript
// Source: standard browser Intl API [ASSUMED — standard JS]
function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const seconds = Math.floor(diff / 1000)
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  if (seconds < 60) return rtf.format(-seconds, 'second')
  if (seconds < 3600) return rtf.format(-Math.floor(seconds / 60), 'minute')
  if (seconds < 86400) return rtf.format(-Math.floor(seconds / 3600), 'hour')
  return rtf.format(-Math.floor(seconds / 86400), 'day')
}
```

### Event Type Icon Map (Lucide)
```typescript
// Source: lucide-react 0.511.0 [VERIFIED: package.json — lucide-react installed]
import { Mail, Eye, MousePointer, AlertTriangle, UserMinus, Send } from 'lucide-react'

const eventIconMap: Record<CampaignEventType, React.FC> = {
  sent: Send,
  delivered: Mail,
  opened: Eye,
  clicked: MousePointer,
  replied: Mail,
  bounced: AlertTriangle,
  unsubscribed: UserMinus,
  complained: AlertTriangle,
}
```

### Adding the Analytics Route in App.tsx
```typescript
// Source: src/App.tsx [VERIFIED: codebase]
// Add alongside existing campaign routes:
import { CampaignAnalyticsPage } from './pages/campaigns/CampaignAnalyticsPage'

<Route path="/campaigns/:id/analytics" element={<CampaignAnalyticsPage />} />
```

### Adding "View analytics" to CampaignsPage dropdown
```typescript
// Source: src/pages/campaigns/CampaignsPage.tsx [VERIFIED: codebase]
// Inside the dropdown menu, add before "Edit":
<button
  className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700"
  onClick={(e) => {
    e.stopPropagation()
    setOpenMenuId(null)
    navigate(`/campaigns/${campaign.id}/analytics`)
  }}
>
  View analytics
</button>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `SELECT COUNT(*) ... GROUP BY` on event tables | Denormalized counters (`total_opened`, etc.) | Design decision in schema-v1.md | Phase 4 reads columns, not aggregation queries |
| Separate analytics backend | Supabase RLS + PostgREST direct read | Architecture decision | No Edge Functions needed for Phase 4 |

**Deprecated/outdated in database.ts:**
- `TrackingEvent` interface: references `tracking_events` table which does not exist in schema-v1.md; should be removed or replaced with `CampaignEvent`
- `RecipientStatus` type: includes only `'queued' | 'sent' | 'delivered' | 'bounced' | 'complained'` — missing `'pending' | 'opened' | 'clicked' | 'replied' | 'unsubscribed' | 'failed'` per schema-v1.md CHECK constraint
- `CampaignRecipient.resend_email_id` / `.delivery_status` / `.link_map`: all wrong column names per MEMORY.md

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | PostgREST can resolve `campaign_events -> contacts` join via FK chain through `campaign_recipients` | Architecture Patterns (Pattern 2), Common Pitfalls (Pitfall 5) | Two-step fetch needed; adds one extra query per page load |
| A2 | `Intl.RelativeTimeFormat` is available in the target browser environment | Code Examples (Relative Timestamp) | Need a polyfill or simple manual date diff helper |
| A3 | `campaign_events` table has been created in production Supabase (Phase 3 migration) | Architecture Patterns — event timeline | If Phase 3 migrations not applied, timeline query returns empty; planner should add a conditional empty state |
| A4 | `campaign_links` table is populated by the Phase 3 send-campaign Edge Function | Architecture Patterns — link breakdown | If Phase 3 link tracking not implemented, `campaign_links` will be empty; empty state needed |

**If A3 or A4 are not yet satisfied (Phase 3 not complete):** The analytics page will work functionally but show empty states for timeline and link breakdown — this is correct behavior and should be tested.

---

## Open Questions

1. **PostgREST join path for campaign_events → contacts**
   - What we know: `campaign_events` has `recipient_id` FK to `campaign_recipients`; `campaign_recipients` has `contact_id` FK to `contacts`
   - What's unclear: Whether PostgREST auto-resolves a two-hop join in a single `.select()` call
   - Recommendation: Implement as two-step fetch to be safe (events → recipient IDs → contacts). If profiling shows this is too slow, denormalize `contact_id` onto `campaign_events` as an optimization.

2. **DASH-03 scope**
   - What we know: Requirement says "total contact lists and unsubscribe count"; user deferred unsubscribe count stat card from dashboard in favor of Avg Click Rate (D-06)
   - What's unclear: Should contact list count still appear on the dashboard (D-06 shows 4 specific cards: Contacts, Campaigns Sent, Avg Open Rate, Avg Click Rate — no list count card)
   - Recommendation: The 4 stat cards in D-06 are locked. For DASH-03, the contact list count and unsubscribe count data should be present somewhere visible — consider adding it as secondary text under existing cards, or accept partial requirement satisfaction since DASH-03 deferred unsubscribes to per-campaign view.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 4 is purely frontend code changes and Supabase read queries. No new CLI tools, runtimes, or external services beyond what is already running. Supabase and Node.js are verified operational from previous phases.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — no test directory, no vitest/jest config |
| Config file | None — Wave 0 must add |
| Quick run command | `npm run lint` (only available automated check) |
| Full suite command | `npm run build` (TypeScript compilation + Vite build) |

No automated testing infrastructure exists in this project. [VERIFIED: directory listing, package.json scripts inspection]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ANLX-01 | Stat cards show correct rates from `total_*` columns | manual | `npm run build` (type check) | N/A |
| ANLX-02 | Event timeline renders events, filter chips work | manual | `npm run build` | N/A |
| ANLX-03 | Link breakdown shows click_count and unique_clicks | manual | `npm run build` | N/A |
| ANLX-04 | Recipient table shows per-recipient data, row expand works | manual | `npm run build` | N/A |
| DASH-01 | Dashboard stat cards show live counts | manual | `npm run build` | N/A |
| DASH-02 | Recent campaigns list renders with rates | manual | `npm run build` | N/A |
| DASH-03 | Dashboard shows contact lists / unsubscribe context | manual | `npm run build` | N/A |

### Sampling Rate
- **Per task commit:** `npm run lint && npm run build`
- **Per wave merge:** `npm run lint && npm run build`
- **Phase gate:** `npm run build` green + manual browser verification of each requirement

### Wave 0 Gaps

Since no test framework exists and the project has no testing infrastructure, the only automated gate is TypeScript compilation (`npm run build`). The planner should note:

- [ ] Fix `CampaignRecipient` interface in `src/types/database.ts` — this is a Wave 0 prerequisite; all subsequent tasks depend on correct types
- [ ] Add `CampaignEvent` and `CampaignLink` interfaces to `src/types/database.ts`
- [ ] Remove stale `TrackingEvent` interface and stale `RecipientStatus` values

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Analytics page is protected by existing `ProtectedRoute` — no new auth logic |
| V3 Session Management | no | No session changes — existing `AuthProvider` handles this |
| V4 Access Control | yes | Every Supabase query MUST include `.eq('workspace_id', profile.workspace_id)` — prevents cross-workspace data access |
| V5 Input Validation | low | No user-submitted data in this phase — only read queries; `campaignId` from URL params should be validated as UUID before querying |
| V6 Cryptography | no | No cryptographic operations |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Insecure Direct Object Reference (IDOR) | Elevation of Privilege | `.eq('workspace_id', profile.workspace_id)` on every query + RLS as backstop |
| URL param injection (`/campaigns/INJECTED/analytics`) | Tampering | Validate `id` param is a valid UUID before querying; Supabase will return empty result for non-matching workspace but explicit validation improves error UX |

**Note:** RLS is already applied to all four tables used in this phase (`campaign_events`, `campaign_links`, `campaign_recipients`, `campaigns`). The workspace_id filter is defense-in-depth. [VERIFIED: schema-v1.md RLS section]

---

## Sources

### Primary (HIGH confidence)
- `src/types/database.ts` — existing TypeScript interfaces (with documented discrepancies vs actual schema)
- `docs/schema-v1.md` — canonical DDL for all four analytics tables
- `src/hooks/campaigns/useCampaigns.ts` — hook pattern to replicate
- `src/hooks/contacts/useContacts.ts` — pagination pattern to replicate
- `src/pages/campaigns/CampaignsPage.tsx` — table pattern, dropdown menu pattern to extend
- `src/pages/dashboard/DashboardPage.tsx` — existing file to extend
- `src/App.tsx` — routing pattern to extend
- `.planning/phases/04-analytics-dashboard/04-CONTEXT.md` — locked decisions

### Secondary (MEDIUM confidence)
- `/Users/lucaspaiva/.claude/projects/-Users-lucaspaiva-vibe-coding-dna-mailsops/memory/MEMORY.md` — documents actual `campaign_recipients` column names vs database.ts discrepancy

### Tertiary (LOW confidence / ASSUMED)
- PostgREST foreign key embedding behavior for multi-hop joins — assumed from general Supabase knowledge; verify at implementation
- `Intl.RelativeTimeFormat` browser availability — assumed standard in modern browsers

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified installed in package.json; no new dependencies
- Architecture: HIGH — directly modeled on verified existing patterns in codebase
- Type corrections: HIGH — cross-referenced database.ts against schema-v1.md and MEMORY.md; discrepancies confirmed
- Pitfalls: HIGH — Pitfall 1 (stale types) and Pitfall 5 (join path) verified from codebase inspection; others are standard patterns
- Join resolution (A1): LOW — PostgREST multi-hop join behavior assumed from training knowledge; needs verification at implementation

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (stable tech stack; denormalized schema design won't change within v1)
