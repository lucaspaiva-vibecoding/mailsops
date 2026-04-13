# Phase 5: A/B Testing - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can create A/B test campaigns with two email variants, send each variant to a portion of the contact list (hold-back group preserved for the winner), compare open rate and click rate side-by-side, and manually pick a winning variant to send to the remaining contacts.

</domain>

<decisions>
## Implementation Decisions

### D-01: Variant Data Model — Sibling Campaigns
- A/B test is represented as a **parent campaign** (`campaign_type = 'ab_test'`) + **two child campaign rows** (`campaign_type = 'ab_variant'`, linked via `parent_campaign_id`)
- Each variant is a full campaigns row with its own `subject`, `body_html`, `body_json`, `campaign_recipients`, `campaign_events`, and `campaign_links`
- Reuses all existing delivery machinery (send-campaign Edge Function, tracking pixel, click redirect) per variant — no changes to Phase 3 infrastructure
- New migration required: add `campaign_type TEXT CHECK (campaign_type IN ('regular', 'ab_test', 'ab_variant'))` and `parent_campaign_id UUID REFERENCES campaigns(id)` to the campaigns table
- Default `campaign_type` for existing campaigns: `'regular'`

### D-02: UX Entry Point — Separate Flow
- A **"New A/B Test" button** on `CampaignsPage` (distinct from the existing "New campaign" button)
- Opens a dedicated A/B test builder at a new route (e.g., `/campaigns/ab-test/new` or `/campaigns/:id/ab-test/edit`)
- A/B tests appear in the campaigns list alongside regular campaigns with a distinct badge (e.g., "A/B Test")
- The existing `CampaignBuilderPage` remains unchanged — it is not extended or modified

### D-03: Variant Editor — Tab Strip Layout
- Shared settings sit at the top: from name, from email, reply-to, contact list, split percentage
- A **tab strip (Variant A / Variant B)** sits below shared settings
- Each tab has its own: `subject` input + TipTap body editor (full rich text, identical to existing CampaignBuilderPage editor)
- Both subject line AND body can differ independently between variants (fulfills ABTS-01: "different subject lines and/or bodies")

### D-04: Split Model — Three-Group with Hold-Back
- User sets a **single "test group size" input/slider** (e.g., 40%)
- The UI derives and displays the breakdown: "Variant A: 20% · Variant B: 20% · Hold-back: 60%"
- Default test group size: 40% (20/20/60 split)
- Contact assignment is random within each group
- Hold-back group contacts receive NO email until the winner is sent

### D-05: Results View — Dedicated Route
- A/B test results live at `/campaigns/:id/ab-results` (new dedicated page)
- Shows: split breakdown summary, variant A vs variant B stat cards side-by-side (open rate %, click rate %, total sent, total opened, total clicked)
- The existing `CampaignAnalyticsPage` is not modified — it remains for regular campaigns

### D-06: Winner Send Flow
- Results page has a **"Send winner" button** per variant (or a selector + confirm button)
- Clicking triggers a confirm prompt: "Send Variant [A/B] to the remaining [N] contacts?"
- Winner sends immediately (no scheduling option) — sends to the hold-back group only
- After winner is sent, the A/B test is considered complete (parent status → 'sent')

### Claude's Discretion
- Exact route structure for A/B test builder (whether to reuse `/campaigns/:id/edit` with type detection or use a dedicated `/campaigns/:id/ab-test` route)
- How hold-back group contacts are stored/tracked (e.g., a `campaign_recipients` row with `status='pending_winner'` or just not yet inserted until winner is chosen)
- RLS policy approach for the new `campaign_type` and `parent_campaign_id` columns
- Loading skeletons, empty states, and error handling on the A/B builder and results pages
- Whether to show A/B results in `CampaignsPage` list row (e.g., "Variant A 42% vs Variant B 38%") as a quick summary
- Icon choice for A/B test badge in campaign list

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Database Schema
- `docs/schema-v1.md` — Full DDL for `campaigns`, `campaign_recipients`, `campaign_events`, `campaign_links` tables; denormalized stats columns; RLS patterns

### Requirements
- `.planning/REQUIREMENTS.md` §A/B Testing (ABTS-01 to ABTS-04) — All four acceptance criteria for this phase

### Project Foundation
- `.planning/ROADMAP.md` — Phase 5 scope, success criteria, and dependency on Phase 3
- `CLAUDE.md` — Naming conventions, Tailwind patterns, dark theme, component structure

### Existing Codebase
- `src/pages/campaigns/CampaignsPage.tsx` — Campaign list page; A/B test button and list badge added here
- `src/pages/campaigns/CampaignBuilderPage.tsx` — Reference for TipTap editor setup, form patterns, scheduling section — reuse patterns, do NOT modify this file
- `src/pages/campaigns/CampaignAnalyticsPage.tsx` — Reference for analytics layout patterns; do NOT modify (A/B results get their own page)
- `src/components/ui/` — Card, Badge, Button, Spinner, Toast — all reusable as-is
- `src/hooks/campaigns/useCampaigns.ts` — Campaigns hook; extend with A/B test create/send operations
- `src/hooks/campaigns/useCampaign.ts` — Single-campaign hook; extend for A/B test variant fetch
- `src/lib/supabase.ts` — Supabase client patterns
- `src/types/database.ts` — TypeScript DB types (will need extension for new campaign_type, parent_campaign_id)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TipTap` editor setup in `CampaignBuilderPage.tsx` — copy extensions config (StarterKit, Link, Image, Placeholder, VariableChipNode, VariableSlashCommand) for each variant editor tab
- `SchedulingSection` and `TestSendSection` components — reference for shared settings section patterns (NOT reused in A/B builder, but useful as structural reference)
- `Card`, `Badge`, `Button`, `Spinner`, `useToast()` — all usable without modification
- `useCampaigns` hook — extend to add `createAbTest`, `sendAbTestVariants`, `sendAbTestWinner` operations
- `CampaignStatus` type — will need `'ab_test'` added as a display status (or use parent campaign status)

### Established Patterns
- All Supabase queries MUST include `.eq('workspace_id', profile.workspace_id)` — checked via AuthContext
- Error handling: extract from Supabase response, store in state, display inline
- `data-no-list-click` attribute pattern for row click guards
- Two-step resolve pattern for joins (events → recipients → contacts) from Phase 4

### Integration Points
- `CampaignsPage.tsx` — add "New A/B Test" button and A/B test type badge in the campaigns list
- React Router routes in `src/App.tsx` or `src/routes/index.tsx` — add routes for A/B builder and results page
- `campaigns` DB table — add `campaign_type` and `parent_campaign_id` via new migration
- `send-campaign` Edge Function — invoke per variant (not per parent), same as regular send

</code_context>

<specifics>
## Specific Ideas

- Split UI wording: "Send test to [X]% of list" → shows breakdown "Variant A: X/2% · Variant B: X/2% · Hold-back: (100-X)%"
- Results page stat cards: two columns, each labeled "Variant A" / "Variant B" with open rate, click rate, sent count — same stat card component from Phase 4 analytics
- "Send winner" confirm prompt: "Send Variant [A/B] to the remaining [N] contacts? This cannot be undone."
- A/B test badge in campaign list: distinct from regular campaign status badges (e.g., "A/B Test" in a neutral or teal variant)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-a-b-testing*
*Context gathered: 2026-04-13*
