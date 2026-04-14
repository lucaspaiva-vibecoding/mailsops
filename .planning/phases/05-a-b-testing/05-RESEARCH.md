# Phase 5: A/B Testing - Research

**Researched:** 2026-04-13
**Domain:** React + Supabase A/B test campaign management (frontend-only SaaS)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01: Variant Data Model — Sibling Campaigns**
- A/B test is represented as a **parent campaign** (`campaign_type = 'ab_test'`) + **two child campaign rows** (`campaign_type = 'ab_variant'`, linked via `parent_campaign_id`)
- Each variant is a full campaigns row with its own `subject`, `body_html`, `body_json`, `campaign_recipients`, `campaign_events`, and `campaign_links`
- Reuses all existing delivery machinery (send-campaign Edge Function, tracking pixel, click redirect) per variant — no changes to Phase 3 infrastructure
- New migration required: add `campaign_type TEXT CHECK (campaign_type IN ('regular', 'ab_test', 'ab_variant'))` and `parent_campaign_id UUID REFERENCES campaigns(id)` to the campaigns table
- Default `campaign_type` for existing campaigns: `'regular'`

**D-02: UX Entry Point — Separate Flow**
- A **"New A/B Test" button** on `CampaignsPage` (distinct from the existing "New campaign" button)
- Opens a dedicated A/B test builder at a new route (e.g., `/campaigns/ab-test/new` or `/campaigns/:id/ab-test/edit`)
- A/B tests appear in the campaigns list alongside regular campaigns with a distinct badge (e.g., "A/B Test")
- The existing `CampaignBuilderPage` remains unchanged — it is not extended or modified

**D-03: Variant Editor — Tab Strip Layout**
- Shared settings sit at the top: from name, from email, reply-to, contact list, split percentage
- A **tab strip (Variant A / Variant B)** sits below shared settings
- Each tab has its own: `subject` input + TipTap body editor (full rich text, identical to existing CampaignBuilderPage editor)
- Both subject line AND body can differ independently between variants (fulfills ABTS-01)

**D-04: Split Model — Three-Group with Hold-Back**
- User sets a **single "test group size" input/slider** (e.g., 40%)
- The UI derives and displays the breakdown: "Variant A: 20% · Variant B: 20% · Hold-back: 60%"
- Default test group size: 40% (20/20/60 split)
- Contact assignment is random within each group
- Hold-back group contacts receive NO email until the winner is sent

**D-05: Results View — Dedicated Route**
- A/B test results live at `/campaigns/:id/ab-results` (new dedicated page)
- Shows: split breakdown summary, variant A vs variant B stat cards side-by-side (open rate %, click rate %, total sent, total opened, total clicked)
- The existing `CampaignAnalyticsPage` is not modified — it remains for regular campaigns

**D-06: Winner Send Flow**
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

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ABTS-01 | User can create an A/B test campaign with 2 variants (different subject lines and/or bodies) | D-01 sibling campaign model + D-03 tab strip editor; each variant is a full campaigns row with independent subject + TipTap body |
| ABTS-02 | User can set the test split percentage between variants (e.g., 50/50) | D-04 three-group split model; single "test group size" number input with derived breakdown display |
| ABTS-03 | User can view A/B test results comparing open rate and click rate per variant | D-05 dedicated results page; StatCard reuse from Phase 4 analytics; both variant campaign rows have their own denormalized stats (total_opened, total_clicked, total_sent) |
| ABTS-04 | User can manually select a winning variant and send it to the remaining contacts | D-06 winner send flow; send-campaign Edge Function invoked with winner variant campaign_id; hold-back contacts assigned by migration or client-side random selection |
</phase_requirements>

---

## Summary

Phase 5 adds A/B testing on top of the existing campaign infrastructure. The data model decision (D-01) is the most architecturally significant choice: each variant is a first-class `campaigns` row, which means every existing mechanism — the send-campaign Edge Function, tracking pixel, click redirect, denormalized stats counters, RLS policies — works without modification. The only new database work is a single migration that adds two columns to the existing `campaigns` table.

The frontend work is entirely new surface area: a dedicated A/B test builder page, a results page, and minimal additive changes to `CampaignsPage`. No existing pages are modified. The builder follows the same patterns as `CampaignBuilderPage` (TipTap editor config, Supabase mutation patterns, `useToast` feedback) so the implementation is largely established-pattern application, not novel engineering.

The most nuanced design decision left to Claude's discretion is how hold-back contacts are tracked. The research recommends storing hold-back contacts as `campaign_recipients` rows on the **parent** campaign with `status='pending_winner'` — this makes the hold-back group queryable, auditable, and prevents re-insertion bugs when the winner is later sent.

**Primary recommendation:** Implement as three waves — (1) DB migration + TypeScript type extension, (2) A/B builder page + `useCampaigns` extensions, (3) results page + winner send flow + `CampaignsPage` additions.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | 2.49.4 | DB mutations, RLS-gated queries | Already installed; all data flows through it |
| @tiptap/react | 2.11.5 | Rich text editor per variant tab | Already installed; identical config to CampaignBuilderPage |
| @tiptap/starter-kit | 2.11.5 | TipTap extension bundle | Already installed |
| @tiptap/extension-link | (installed) | Link extension | Already installed |
| @tiptap/extension-image | (installed) | Image extension | Already installed |
| @tiptap/extension-placeholder | (installed) | Placeholder text | Already installed |
| react-router-dom | 7.5.3 | New routes for builder and results pages | Already installed |
| lucide-react | 0.511.0 | Icons (FlaskConical or TestTube for A/B badge) | Already installed |

[VERIFIED: codebase grep of package.json and STACK.md]

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| VariableChipNode | local | Custom TipTap node for `{{variable}}` chips | Required on both variant editors (copied from CampaignBuilderPage) |
| VariableSlashCommand | local | Slash command for variable insertion in TipTap | Required on both variant editors |
| analyticsUtils.ts | local | `formatRate()` for open/click rate display | Results page stat cards |

**No new npm packages required for this phase.** All libraries are already installed.

---

## Architecture Patterns

### Recommended Project Structure

New files this phase creates:

```
src/
├── pages/campaigns/
│   ├── AbTestBuilderPage.tsx      # New — A/B test builder (shared settings + variant tab strip)
│   └── AbTestResultsPage.tsx      # New — results view with side-by-side stat cards + winner send
├── components/campaigns/
│   ├── VariantTabStrip.tsx        # New — tab strip (Variant A / Variant B)
│   ├── SplitPercentageInput.tsx   # New — test group size input with derived breakdown
│   └── SendWinnerModal.tsx        # New — confirmation modal for winner send
├── hooks/campaigns/
│   └── useAbTest.ts               # New — fetches parent campaign + both variant campaigns
supabase/migrations/
└── 007_ab_test_columns.sql        # New — adds campaign_type and parent_campaign_id to campaigns
```

Modified files (additive only):

```
src/App.tsx                        # Add 2 new routes
src/pages/campaigns/CampaignsPage.tsx  # Add "New A/B test" button + A/B badge + row click guard
src/hooks/campaigns/useCampaigns.ts    # Add createAbTest, sendAbTestVariants, sendAbTestWinner
src/types/database.ts                  # Extend Campaign interface + add CampaignType union type
```

### Pattern 1: Sibling Campaign Insert (createAbTest)

**What:** Creating an A/B test inserts three rows atomically — one parent (`campaign_type='ab_test'`) and two children (`campaign_type='ab_variant'`). The parent holds shared settings (from_name, from_email, contact_list_id, settings JSONB for split_percentage). Each child holds its own subject, body_html, body_json.

**When to use:** Triggered by "Send test variants" or "Save draft" on AbTestBuilderPage.

**Example:**
```typescript
// Source: [VERIFIED: codebase pattern from useCampaigns.ts createCampaign]
const createAbTest = async (payload: AbTestCreatePayload) => {
  if (!profile?.workspace_id) return { data: null, error: 'Not authenticated' }

  // 1. Insert parent campaign
  const { data: parent, error: parentError } = await supabase
    .from('campaigns')
    .insert({
      workspace_id: profile.workspace_id,
      name: payload.name,
      status: 'draft',
      campaign_type: 'ab_test',
      from_name: payload.fromName,
      from_email: payload.fromEmail,
      reply_to_email: payload.replyTo || null,
      contact_list_id: payload.contactListId,
      // Store split percentage in settings JSONB
      settings: { split_percentage: payload.splitPercentage },
      subject: '',       // Parent has no subject — variants do
      body_html: '',
      body_json: null,
    })
    .select()
    .single()

  if (parentError || !parent) return { data: null, error: parentError?.message ?? 'Failed to create test' }

  // 2. Insert variant A
  const { data: variantA, error: variantAError } = await supabase
    .from('campaigns')
    .insert({
      workspace_id: profile.workspace_id,
      name: `${payload.name} — Variant A`,
      status: 'draft',
      campaign_type: 'ab_variant',
      parent_campaign_id: parent.id,
      from_name: payload.fromName,
      from_email: payload.fromEmail,
      reply_to_email: payload.replyTo || null,
      contact_list_id: payload.contactListId,
      subject: payload.variantA.subject,
      body_html: payload.variantA.bodyHtml,
      body_json: payload.variantA.bodyJson ?? null,
      settings: {},
    })
    .select()
    .single()

  if (variantAError) {
    // Attempt cleanup of parent (best-effort)
    await supabase.from('campaigns').update({ deleted_at: new Date().toISOString() }).eq('id', parent.id)
    return { data: null, error: variantAError.message }
  }

  // 3. Insert variant B (same pattern as variantA)
  // ...

  return { data: { parent, variantA, variantB }, error: null }
}
```

### Pattern 2: Contact Assignment for Three-Group Split

**What:** When "Send test variants" is clicked, the frontend fetches all active contacts in the target list, shuffles them, and partitions into three groups: first `splitPct/2`% → variant A recipients, next `splitPct/2`% → variant B recipients, remaining → hold-back. Hold-back contacts are stored on the **parent** campaign as `campaign_recipients` rows with `status='pending_winner'`.

**When to use:** `sendAbTestVariants` operation — called once per A/B test send.

**Example:**
```typescript
// Source: [VERIFIED: existing send-campaign Edge Function invocation pattern from useCampaign.ts]
const sendAbTestVariants = async (parentId: string, variantAId: string, variantBId: string) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'Not authenticated' }

  // Invoke send-campaign for variant A (Edge Function handles recipient insertion)
  const { data: resultA, error: errA } = await supabase.functions.invoke('send-campaign', {
    body: { campaign_id: variantAId },
    headers: { Authorization: `Bearer ${session.access_token}` },
  })

  // Invoke send-campaign for variant B
  const { data: resultB, error: errB } = await supabase.functions.invoke('send-campaign', {
    body: { campaign_id: variantBId },
    headers: { Authorization: `Bearer ${session.access_token}` },
  })

  // Update parent status to 'sending' / 'sent'
  // ...
}
```

**Important caveat:** The existing `send-campaign` Edge Function sends to ALL active contacts in `contact_list_id`. For A/B testing, variants must send to a SUBSET of contacts. This requires either:
- (a) Passing a `contact_ids` array override to `send-campaign` (preferred — minimal Edge Function change), or
- (b) Client-side pre-insertion of `campaign_recipients` rows before invoking `send-campaign` with a `skip_recipient_insert` flag

**Recommendation (Claude's discretion):** Pass `contact_ids: string[]` as an optional override body param to `send-campaign`. The Edge Function already builds its recipient list from a query — adding an `IN` filter when `contact_ids` is present is a surgical one-line change. This keeps all delivery logic in the Edge Function and avoids a second round-trip.

### Pattern 3: Hold-Back Storage on Parent Campaign

**What:** Hold-back contacts are stored as `campaign_recipients` rows on the parent campaign (not on either variant). This keeps them queryable and auditable without polluting variant stats.

**Recommended `status` value:** `'pending_winner'` — requires adding this value to the `status` CHECK constraint in the migration (or using the existing `'pending'` status if the planner prefers minimal migration scope).

**When to use:** Inserted at the same time variants are sent. When the winner is chosen, these rows are read to determine the hold-back count, then the winning variant's `send-campaign` is invoked with the hold-back `contact_ids`.

### Pattern 4: useAbTest Hook

**What:** A new hook that fetches the parent campaign + both variant campaigns in parallel. Used by `AbTestBuilderPage` (edit mode) and `AbTestResultsPage`.

```typescript
// Source: [VERIFIED: pattern from useCampaign.ts and useCampaignAnalytics.ts]
export function useAbTest(parentId: string | undefined) {
  const { profile } = useAuth()
  const [parent, setParent] = useState<Campaign | null>(null)
  const [variantA, setVariantA] = useState<Campaign | null>(null)
  const [variantB, setVariantB] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    if (!parentId || !profile?.workspace_id) { setLoading(false); return }
    setLoading(true)

    // Fetch parent + all children in one query
    const { data, error: fetchError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('workspace_id', profile.workspace_id)
      .or(`id.eq.${parentId},parent_campaign_id.eq.${parentId}`)
      .is('deleted_at', null)

    if (fetchError) { setError(fetchError.message); setLoading(false); return }

    const rows = (data as Campaign[]) ?? []
    setParent(rows.find(r => r.id === parentId) ?? null)
    const variants = rows.filter(r => r.parent_campaign_id === parentId)
    setVariantA(variants[0] ?? null)
    setVariantB(variants[1] ?? null)
    setLoading(false)
  }, [parentId, profile?.workspace_id])

  useEffect(() => { fetchAll() }, [fetchAll])

  return { parent, variantA, variantB, loading, error, refetch: fetchAll }
}
```

### Pattern 5: TipTap Dual-Editor (Variant Tab Strip)

**What:** Two TipTap editor instances (one per variant) created upfront; only the active tab's editor is rendered visible. Both instances stay mounted to preserve editor state without losing content on tab switch.

**Why two instances, not one:** TipTap's `setContent` triggers `onUpdate` which sets `dirty=true`. Swapping content on tab switch would falsely mark both variants dirty and lose independent undo history.

```typescript
// Source: [VERIFIED: CampaignBuilderPage.tsx useEditor pattern]
const editorA = useEditor({
  extensions: [
    StarterKit,
    Link.configure({ openOnClick: false }),
    Image,
    Placeholder.configure({ placeholder: 'Write Variant A email content here...' }),
    VariableChipNode,
    VariableSlashCommand,
  ],
  content: '',
  onUpdate: () => setDirtyA(true),
})

const editorB = useEditor({ /* same config, different placeholder */ })
```

**Render pattern:**
```tsx
{/* Both editors always mounted; display toggled via CSS */}
<div className={activeTab === 'A' ? 'block' : 'hidden'}>
  <CampaignEditorToolbar editor={editorA} />
  <EditorContent editor={editorA} className="min-h-[320px] p-4 ..." />
</div>
<div className={activeTab === 'B' ? 'block' : 'hidden'}>
  <CampaignEditorToolbar editor={editorB} className="..." />
  <EditorContent editor={editorB} className="min-h-[320px] p-4 ..." />
</div>
```

### Anti-Patterns to Avoid

- **Modifying CampaignBuilderPage:** The existing builder must not be touched. D-02 is a hard lock. AbTestBuilderPage is a separate file that copies patterns.
- **Storing split config in a separate table:** The `settings` JSONB column on the parent campaign already exists and is designed for this purpose (schema-v1.md comment: "A/B test config, etc. (used in Module 7)"). Use it.
- **Aggregating stats client-side across variant recipients:** Each variant campaign already has denormalized `total_opened`, `total_clicked`, `total_sent` counters updated by the tracking Edge Functions. Use those directly on the results page — no joins needed.
- **Inserting hold-back contacts into a variant's campaign_recipients:** Hold-back contacts must be on the parent campaign (or not inserted at all until winner send). If they appear in a variant's recipients, tracking events would be attributed to the wrong campaign.
- **Single TipTap instance swapping content on tab change:** See Pattern 5 — use two mounted instances.
- **Filtering campaigns list without the `campaign_type` filter:** After migration, `useCampaigns.fetchCampaigns` currently fetches all campaigns. Add `.in('campaign_type', ['regular', 'ab_test'])` (or `.neq('campaign_type', 'ab_variant')`) to hide variant rows from the list — only the parent should appear.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate calculation (open rate, click rate) | Custom division logic | `formatRate()` from `src/lib/analyticsUtils.ts` | Already handles division-by-zero, returns em dash, formats to 1 decimal |
| Stat card layout | New stat display component | `StatCard` from `src/components/analytics/StatCard.tsx` | Already matches design system; used in Phase 4 analytics |
| Confirmation modal | `window.confirm()` or inline state | `SendWinnerModal` component (new, but purpose-built) | `window.confirm()` is synchronous and blocks; a modal allows danger button styling per UI-SPEC |
| Badge for A/B test type label | New badge component | `Badge` from `src/components/ui/Badge.tsx` with `className` override for teal | Badge accepts className — `bg-teal-900/50 text-teal-400` applied directly |
| Toast notifications | Alert elements | `useToast()` from `src/components/ui/Toast.tsx` | Consistent with all existing pages |
| Email delivery | Batch send logic | Existing `send-campaign` Edge Function | Already handles Resend batch API, recipient insertion, tracking setup, status updates |
| Contact random assignment | Seeded shuffle | Fisher-Yates shuffle on contact ID array client-side | Simple, deterministic for a given send; no need for DB-level randomization |

**Key insight:** The Phase 3 delivery engine is the A/B test engine — no new delivery code is required. Variants are just campaigns. This is the entire value of the D-01 sibling-campaign data model.

---

## Database Migration Design

### Migration 007: ab_test_columns

**File:** `supabase/migrations/007_ab_test_columns.sql`

```sql
-- Migration: Add A/B testing columns to campaigns table
-- Adds campaign_type discriminator and parent_campaign_id for sibling-campaign A/B model

ALTER TABLE public.campaigns
  ADD COLUMN campaign_type TEXT NOT NULL DEFAULT 'regular'
    CHECK (campaign_type IN ('regular', 'ab_test', 'ab_variant')),
  ADD COLUMN parent_campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE;

-- Index for fetching variants by parent (used by useAbTest hook)
CREATE INDEX idx_campaigns_parent ON public.campaigns(parent_campaign_id)
  WHERE parent_campaign_id IS NOT NULL;

-- RLS: existing policies cover campaign_type and parent_campaign_id automatically
-- because they gate on workspace_id — no new RLS policies needed
```

**Why ON DELETE CASCADE on parent_campaign_id:** If the parent A/B test campaign is deleted (soft-deleted via `deleted_at`), variants should also be considered deleted. Since soft-delete sets `deleted_at` rather than actually deleting rows, `ON DELETE CASCADE` only fires on hard delete — which is acceptable. Soft-delete handling is done at the application layer (update parent `deleted_at` AND update both variant `deleted_at` in `deleteAbTest`).

**Existing RLS policy compatibility:** The campaigns table RLS policies gate on `workspace_id`. Adding `campaign_type` and `parent_campaign_id` columns does not break or require changes to existing policies — the `workspace_id` check covers all rows regardless of type. [VERIFIED: schema-v1.md RLS section + 006_contact_lists_rls.sql pattern]

### TypeScript Type Extensions

**In `src/types/database.ts`:**

```typescript
// Add to top — new union type
export type CampaignType = 'regular' | 'ab_test' | 'ab_variant'

// Extend Campaign interface
export interface Campaign {
  // ... existing fields ...
  campaign_type: CampaignType      // new
  parent_campaign_id: string | null // new
}

// CampaignInsert already uses Omit<Campaign, ...> — campaign_type needs a default
// Add campaign_type as optional in the Omit override (or let DB default handle it)
```

**Note:** `CampaignInsert` is defined as `Omit<Campaign, 'id' | 'total_recipients' | ...>`. Since `campaign_type` has a DB default of `'regular'`, it should be made optional in the insert type: `Partial<Pick<Campaign, 'campaign_type' | 'parent_campaign_id'>>` merged into `CampaignInsert`, or simply made optional via `campaign_type?: CampaignType` on the interface.

---

## Common Pitfalls

### Pitfall 1: useCampaigns Shows Variant Rows in Campaign List

**What goes wrong:** After migration, `fetchCampaigns` returns ALL campaigns including `ab_variant` rows. Variants appear as separate items in the campaign list table alongside their parent, confusing users.

**Why it happens:** The current query uses `.select('*').eq('workspace_id', ...).is('deleted_at', null)` with no `campaign_type` filter.

**How to avoid:** Add `.not('campaign_type', 'eq', 'ab_variant')` (or `.in('campaign_type', ['regular', 'ab_test'])`) to the `fetchCampaigns` query in `useCampaigns.ts`.

**Warning signs:** Campaign list shows 3 rows for a single A/B test (parent + 2 variants).

### Pitfall 2: CampaignsPage Row Click Navigates Variants to Wrong Route

**What goes wrong:** If variant rows somehow appear in the list, clicking them navigates to `/campaigns/:id/edit` (the regular builder), which renders a broken form because variants have no shared settings.

**Why it happens:** `handleRowClick` in `CampaignsPage` always navigates to `/campaigns/${campaignId}/edit`.

**How to avoid:** After fixing Pitfall 1 (variants filtered from list), the parent `ab_test` row click must navigate to `/campaigns/:id/ab-test/edit`. Guard in `handleRowClick`:
```typescript
const handleRowClick = (e: React.MouseEvent, campaign: Campaign) => {
  if ((e.target as HTMLElement).closest('[data-no-list-click]')) return
  if (campaign.campaign_type === 'ab_test') {
    navigate(`/campaigns/${campaign.id}/ab-test/edit`)
  } else {
    navigate(`/campaigns/${campaign.id}/edit`)
  }
}
```

### Pitfall 3: send-campaign Sends to Full List Instead of Split Subset

**What goes wrong:** Invoking `send-campaign` with a variant campaign_id sends to ALL active contacts in `contact_list_id`, not just the assigned 20%.

**Why it happens:** The existing Edge Function queries all active contacts in `contact_list_id` — it has no concept of a subset.

**How to avoid:** Pass a `contact_ids` array to the Edge Function invocation body. The Edge Function must handle this optional override. This is the only required change to Phase 3 infrastructure. Confirm with the planner whether this is a Wave 0 Edge Function update or part of this phase's plan.

**Warning signs:** `total_sent` on variant A equals the full list count, not ~20% of it.

### Pitfall 4: Two TipTap Editors Both Register onUpdate — False Dirty State

**What goes wrong:** If both editors share a single `dirty` state flag, switching tabs and letting the hidden editor re-render triggers false dirty signals, blocking navigation or showing unsaved-changes prompts incorrectly.

**Why it happens:** TipTap's `onUpdate` fires on programmatic `setContent` calls too (e.g., when populating from DB on edit mode load).

**How to avoid:** Use separate `dirtyA` and `dirtyB` state flags. Use the `populated` guard pattern from `CampaignBuilderPage` — set a `populatedA` / `populatedB` flag after `editor.commands.setContent()` and ignore `onUpdate` calls until after population.

### Pitfall 5: Hold-Back Count Drift Between Send Time and Winner Send

**What goes wrong:** If hold-back contacts are NOT stored at variant-send time and instead re-computed at winner-send time by querying who hasn't received an email, contacts who joined the list between the two sends get included in the winner send unexpectedly.

**Why it happens:** Re-querying "contacts not yet emailed" at winner-send time picks up new list members.

**How to avoid:** Store hold-back contact_ids at the time of variant send. Recommendation: insert `campaign_recipients` rows on the parent campaign with `status='pending_winner'` immediately when variants are sent. The winner-send query reads these rows rather than re-querying the contact list.

### Pitfall 6: statusBadgeVariant Map in CampaignsPage Missing 'ab_test' Key

**What goes wrong:** TypeScript compile error — `CampaignStatus` is a union type used as the Record key for `statusBadgeVariant`. If `campaign_type` is not part of `CampaignStatus`, this is fine — but if the parent campaign's `status` flows through the existing badge map correctly.

**Why it happens:** Parent A/B test campaigns have `status: 'draft' | 'sending' | 'sent'` — these are already in `CampaignStatus`. The badge map handles them correctly without changes.

**How to avoid:** No action needed for status badges. The `campaign_type` badge ("A/B Test") is rendered separately from the status badge — use an inline `if (campaign.campaign_type === 'ab_test')` conditional to render the type badge alongside the status badge.

### Pitfall 7: Parent Campaign Stats Aggregation on Results Page

**What goes wrong:** Results page tries to use `parent.total_opened` / `parent.total_sent` as the overall stats — but the parent campaign never receives emails directly, so these are always 0.

**Why it happens:** The sibling model stores stats on each variant campaign row, not on the parent.

**How to avoid:** Results page reads `variantA.total_opened`, `variantA.total_sent`, `variantB.total_opened`, `variantB.total_sent` directly from the two variant campaign rows fetched by `useAbTest`. Never read aggregate stats from the parent row.

---

## Code Examples

Verified patterns from existing codebase:

### Supabase `OR` Query (Fetch Parent + Variants Together)

```typescript
// Source: [VERIFIED: @supabase/supabase-js 2.x PostgREST filter syntax]
const { data } = await supabase
  .from('campaigns')
  .select('*')
  .eq('workspace_id', profile.workspace_id)
  .or(`id.eq.${parentId},parent_campaign_id.eq.${parentId}`)
  .is('deleted_at', null)
// Returns 3 rows: parent + variantA + variantB
```

### Filtering Variant Rows from Campaign List

```typescript
// Source: [VERIFIED: useCampaigns.ts fetchCampaigns pattern]
const { data } = await supabase
  .from('campaigns')
  .select('*')
  .eq('workspace_id', profile.workspace_id)
  .is('deleted_at', null)
  .not('campaign_type', 'eq', 'ab_variant')   // ← add this line
  .order('created_at', { ascending: false })
```

### Fisher-Yates Shuffle for Contact Assignment

```typescript
// Source: [ASSUMED — standard algorithm, no library needed]
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Usage in sendAbTestVariants:
const allContactIds = activeContacts.map(c => c.id)
const shuffled = shuffleArray(allContactIds)
const splitSize = Math.round((splitPercentage / 2 / 100) * shuffled.length)
const variantAContactIds = shuffled.slice(0, splitSize)
const variantBContactIds = shuffled.slice(splitSize, splitSize * 2)
const holdBackContactIds = shuffled.slice(splitSize * 2)
```

### SplitPercentageInput Derived Display

```typescript
// Source: [VERIFIED: D-04 decision + UI-SPEC Split Percentage Input section]
// splitPercentage = 40 (user input, 8–90 range)
const halfPct = splitPercentage / 2
const holdBackPct = 100 - splitPercentage
const breakdownText = `Variant A: ${halfPct}% · Variant B: ${halfPct}% · Hold-back: ${holdBackPct}%`
```

### Edge Function Invocation with contact_ids Override

```typescript
// Source: [VERIFIED: useCampaign.ts sendCampaign pattern]
const { data, error } = await supabase.functions.invoke('send-campaign', {
  body: {
    campaign_id: variantAId,
    contact_ids: variantAContactIds,  // ← new optional override
  },
  headers: { Authorization: `Bearer ${session.access_token}` },
})
```

### VariantTabStrip Component (UI-SPEC Pattern)

```tsx
// Source: [VERIFIED: UI-SPEC.md VariantTabStrip interaction states]
// Tab container: border-b border-gray-800 flex gap-6 mb-6
// Inactive: text-gray-400 border-b-2 border-transparent hover:text-gray-200
// Active: text-gray-100 border-b-2 border-indigo-500

interface VariantTabStripProps {
  activeTab: 'A' | 'B'
  onTabChange: (tab: 'A' | 'B') => void
}

export function VariantTabStrip({ activeTab, onTabChange }: VariantTabStripProps) {
  return (
    <div className="border-b border-gray-800 flex gap-6 mb-6" role="tablist">
      {(['A', 'B'] as const).map((tab) => (
        <button
          key={tab}
          role="tab"
          aria-selected={activeTab === tab}
          type="button"
          onClick={() => onTabChange(tab)}
          className={`pb-3 text-sm font-medium border-b-2 ${
            activeTab === tab
              ? 'text-gray-100 border-indigo-500'
              : 'text-gray-400 border-transparent hover:text-gray-200'
          }`}
        >
          Variant {tab}
        </button>
      ))}
    </div>
  )
}
```

---

## Route Structure (Claude's Discretion — Recommendation)

Based on the existing route patterns in `App.tsx`:

```tsx
// Recommended new routes in App.tsx (inside ProtectedRoute > AppLayout)
<Route path="/campaigns/ab-test/new" element={<AbTestBuilderPage />} />
<Route path="/campaigns/:id/ab-test/edit" element={<AbTestBuilderPage />} />
<Route path="/campaigns/:id/ab-results" element={<AbTestResultsPage />} />
```

**Why `/campaigns/ab-test/new` rather than `/campaigns/new?type=ab`:** Consistent with existing `/campaigns/new` vs `/campaigns/:id/edit` naming. The `new` vs `edit` distinction is determined by the presence of `:id` in the URL — same pattern as the regular campaign builder.

**Route ordering note:** `/campaigns/ab-test/new` must be declared BEFORE `/campaigns/:id/ab-test/edit` in the Routes tree, and also before `/campaigns/:id/analytics` — React Router matches routes in declaration order. Currently `App.tsx` has `/campaigns/new` before `/campaigns/:id/edit`, which is correct; follow the same pattern.

---

## Hold-Back Storage Recommendation (Claude's Discretion)

**Recommendation: Store hold-back contacts as `campaign_recipients` rows on the parent campaign with `status='pending_winner'`.**

This requires adding `'pending_winner'` to the `RecipientStatus` union in `database.ts` and to the `status` CHECK constraint in the migration.

**Alternative: Use `'pending'` status on parent campaign recipients.** Simpler (no new status value), but `'pending'` is semantically ambiguous — it could be confused with "queued for sending" rather than "waiting for winner selection." The planner should weigh simplicity vs clarity.

**Alternative: Store hold-back contact_ids in parent campaign `settings` JSONB.** Avoids a new `RecipientStatus` value. Simple to implement. Downside: `settings` JSONB is not indexed or queryable at the row level — but for a list of UUIDs only read once (at winner-send time), this is acceptable.

**If `settings` JSONB approach is chosen:**
```typescript
// Store at variant-send time
settings: {
  split_percentage: 40,
  hold_back_contact_ids: ['uuid1', 'uuid2', ...],
}
// Read at winner-send time
const holdBackIds = (parent.settings as any).hold_back_contact_ids as string[]
```

---

## Environment Availability

Step 2.6: SKIPPED — Phase 5 is frontend + Supabase migration only. No new external dependencies. The Supabase project (`pozqnzhgqmajtaidtpkk`) is live and accessible. The `send-campaign` Edge Function is already deployed. No CLI tools beyond npm are required.

---

## Validation Architecture

No automated test framework detected in this codebase (no `jest.config.*`, `vitest.config.*`, `pytest.ini`, or `tests/` directory). [VERIFIED: codebase glob scan]

Testing strategy for this phase is manual verification per acceptance criterion:

| Req ID | Behavior | Test Type | Verification Method |
|--------|----------|-----------|---------------------|
| ABTS-01 | Create A/B test with 2 variants (different subject/body) | Manual | Create test → confirm 3 DB rows in campaigns table (1 ab_test + 2 ab_variant); both variants show correct subject in AbTestBuilderPage edit mode |
| ABTS-02 | Set split percentage; UI shows derived breakdown | Manual | Change test group size input from 40 to 60; confirm display reads "Variant A: 30% · Variant B: 30% · Hold-back: 40%" |
| ABTS-03 | View side-by-side open rate and click rate per variant | Manual | After variants sent: navigate to `/campaigns/:id/ab-results`; confirm StatCards show correct rates from variant campaign rows |
| ABTS-04 | Select winning variant → sends to remaining contacts | Manual | Click "Send Variant A"; confirm modal; confirm hold-back recipients receive email; confirm parent campaign status → 'sent' |

**Wave gate:** All 4 acceptance criteria manually verified before `/gsd-verify-work`.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth JWT — existing pattern; all new hooks check `session` before invoking Edge Functions |
| V3 Session Management | no | No new session handling |
| V4 Access Control | yes | RLS on `campaigns` table gates all variant rows via `workspace_id`; `parent_campaign_id` rows inherit same workspace scope |
| V5 Input Validation | yes | Split percentage: validate 8–90 range client-side; subject line: required non-empty; contact list: required selection |
| V6 Cryptography | no | No new cryptographic operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Accessing another workspace's variant campaigns | Spoofing/Info Disclosure | RLS `workspace_id` check on all `campaigns` queries — inherited automatically; no new policies needed |
| Sending winner to contacts outside the hold-back group | Tampering | Hold-back contact IDs stored at send time; winner-send uses stored IDs, not a live re-query of the list |
| Invoking `send-campaign` Edge Function with a variant_id owned by another workspace | Elevation of Privilege | Edge Function already calls `auth.getUser(token)` → validates workspace ownership of the campaign_id before sending |
| Split percentage outside valid range (e.g., 99%) causing near-empty hold-back | Denial of Service (accidental) | Client-side clamp to 8–90; UX warning if hold-back group would be < 10 contacts |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `send-campaign` Edge Function can accept an optional `contact_ids` array body param to override recipient selection | Pattern 2, Pitfall 3 | If the Edge Function's architecture makes this change non-trivial, the planner must allocate a task for a more significant Edge Function refactor |
| A2 | Adding `'pending_winner'` to `campaign_recipients.status` CHECK constraint is acceptable, or `settings` JSONB is used for hold-back storage | Hold-Back Storage section | If neither approach is chosen, an alternative hold-back mechanism must be designed |
| A3 | The `campaigns` table `settings JSONB` column (already present in schema) can store `split_percentage` and optionally `hold_back_contact_ids` without a schema change | Architecture Patterns | If `settings` is reserved for another purpose, a new column would be needed |

---

## Open Questions

1. **Edge Function modification scope**
   - What we know: The existing `send-campaign` Edge Function sends to all active contacts in a list; A/B variants must send to a subset.
   - What's unclear: Is modifying the Edge Function in scope for this phase, or should Phase 5 plan around it (e.g., pre-insert recipients client-side)?
   - Recommendation: Include a task in Wave 1 to add the `contact_ids` override to `send-campaign`. It's a 5-line change in the Edge Function and avoids complex client-side recipient pre-insertion.

2. **Hold-back contact storage approach**
   - What we know: Three valid approaches exist (new `pending_winner` status, reuse `pending` status, store in `settings` JSONB). See Hold-Back Storage Recommendation section.
   - What's unclear: Which approach the planner prefers for simplicity vs auditability.
   - Recommendation: `settings` JSONB approach minimizes migration scope and avoids a new RecipientStatus value. Use it unless the planner requires auditable hold-back recipient rows.

---

## Sources

### Primary (HIGH confidence)
- Codebase: `src/pages/campaigns/CampaignBuilderPage.tsx` — TipTap editor configuration, form patterns, send-campaign invocation
- Codebase: `src/hooks/campaigns/useCampaigns.ts` — Campaign insert/update/delete patterns
- Codebase: `src/hooks/campaigns/useCampaign.ts` — Single campaign fetch + send-campaign invocation
- Codebase: `src/hooks/campaigns/useCampaignAnalytics.ts` — Multi-query analytics hook pattern
- Codebase: `src/types/database.ts` — Campaign, CampaignRecipient, CampaignStatus interfaces
- Codebase: `docs/schema-v1.md` — Full DDL, RLS patterns, `settings` JSONB design note
- Codebase: `supabase/migrations/004_campaign_recipients.sql` through `006_contact_lists_rls.sql` — Migration naming convention and RLS policy pattern
- Codebase: `src/components/analytics/StatCard.tsx` — Stat card interface for results page reuse
- Codebase: `src/components/ui/Badge.tsx` — Badge variants and className override pattern
- Codebase: `src/lib/analyticsUtils.ts` — `formatRate()` for rate display
- Codebase: `src/App.tsx` — Route structure and declaration order

### Secondary (MEDIUM confidence)
- CONTEXT.md (`05-CONTEXT.md`) — All locked decisions (D-01 through D-06), Claude's Discretion areas
- UI-SPEC.md (`05-UI-SPEC.md`) — Component inventory, interaction states, copywriting contract, layout patterns

### Tertiary (LOW confidence — assumptions flagged)
- A1: Edge Function `contact_ids` override assumed feasible from training knowledge of the function's architecture
- A2: Hold-back storage approach — multiple valid options, recommendation is an inference

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in package.json and STACK.md
- Database migration: HIGH — migration pattern verified from existing migration files; column additions are straightforward ALTER TABLE
- Architecture patterns: HIGH — all patterns derived from existing codebase with direct file verification
- Edge Function modification: MEDIUM — the change is small but the Edge Function source was not read in this session (it is deployed, not in the repo)
- Hold-back storage: MEDIUM — three viable approaches documented; final choice is Claude's discretion

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (stable stack — Supabase, TipTap, React Router versions are not fast-moving)
