# Phase 9: CSV-Personalized Campaigns - Research

**Researched:** 2026-04-15
**Domain:** CSV upload, campaign_type extension, Edge Function branching, React Router + Supabase
**Confidence:** HIGH

## Summary

Phase 9 adds a new campaign creation path: upload a CSV where each row is a fully pre-composed email. The implementation touches four distinct layers — DB migration, a new frontend page + route, the existing send-campaign Edge Function (branch only), and the CampaignsPage dropdown. All decisions are locked in CONTEXT.md; this research maps exact insertion points and surface-level details the planner needs.

The key technical finding is that the send-campaign Edge Function currently hard-codes `campaign.body_html` as the email body and performs signature injection unconditionally. The personalized_body branch must be inserted at the per-recipient preparation step (step 12a in the function), and must bypass `injectSignature` when personalized_body is set, because the CSV body is already final. Additionally, the existing `campaign.contact_list_id` guard (step 8) must be conditioned on `campaign_type !== 'csv_personalized'`, since CSV campaigns have no contact list.

The existing papaparse integration (`Papa.parse<string[]>(file, { skipEmptyLines: true })`) is already used in two modals and can be copied verbatim. The header-object mode (`header: true`) should be used for Phase 9 because CSV columns are fixed and named — this is simpler than the array-index approach used in the contacts wizard.

**Primary recommendation:** Follow the A/B test pattern for campaign_type constraint extension (DROP + re-ADD CHECK), use `Papa.parse` with `header: true` for named-column access, and insert the personalized_body branch at lines 265-275 of send-campaign/index.ts — one conditional block before the signature injection call.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**DB Schema (Migration 011)**
- Extend `campaigns.campaign_type` check constraint to include `'csv_personalized'` (alongside existing `'standard'`, `'ab_test'`)
- Add `personalized_subject TEXT NULL` to `campaign_recipients` — NULL for standard/A-B campaigns
- Add `personalized_body TEXT NULL` to `campaign_recipients` — NULL for standard/A-B campaigns
- Migration file: `supabase/migrations/011_csv_personalized.sql`

**CSV Schema** — exact column names, case-sensitive validation required:
- `first_name`, `last_name`, `email`, `subject`, `body`

**Contact Upsert**
- Upsert into `contacts` by `(workspace_id, email)` — `onConflict: 'workspace_id,email'` with update of first_name/last_name

**Campaign Creation**
- `campaign_type = 'csv_personalized'`
- Sender name + email from `profiles.default_sender_name` / `profiles.default_sender_email`
- No `contact_list_id` selection
- `body_html` and `body_json` on campaigns table remain NULL

**Edge Function Branch**
- If `recipient.personalized_body IS NOT NULL`: use it as html and `recipient.personalized_subject` as subject
- Tracking pipeline unchanged (pixel, link wrapping, unsub footer)
- No signature injection for csv_personalized
- No `{{variable}}` substitution

**UI Flow**
1. CampaignsPage "New campaign" button becomes a dropdown: Standard / A/B Test / CSV Personalized
2. Route `/campaigns/new/csv`: dropzone → papaparse → column validation → 5-row preview → create campaign + recipients
3. Post-create: redirect to review page with send-now / schedule controls
4. Campaign list: CSV campaigns show a "CSV" badge
5. Analytics: reuses existing `CampaignAnalyticsPage`

### Claude's Discretion

None specified — all decisions are locked.

### Deferred Ideas (OUT OF SCOPE)
- Variable substitution inside CSV body
- Per-row sender override
- Scheduling individual rows at different times
- CSV re-run/resume on partial failure
- Attachment support per row
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CSV-01 | User can upload a CSV with columns first_name, last_name, email, subject, body (HTML) and see a preview of the first 5 rows before sending | papaparse `header: true` mode; preview renders `.slice(0, 5)` with body truncated to 100 chars of plain text |
| CSV-02 | CSV rows are upserted into contacts table and campaign_recipients row is created per row with personalized_subject and personalized_body populated | Supabase `.upsert()` with `onConflict: 'workspace_id,email'`; bulk insert into campaign_recipients with new columns from migration 011 |
| CSV-03 | send-campaign Edge Function detects personalized_body IS NOT NULL and uses it; tracking pipeline unchanged | Branch inserted at lines 265-275 of index.ts; injectSignature skipped when personalized_body present |
| CSV-04 | Sender name and email come from workspace defaults (profiles.default_sender_name / default_sender_email) | Profile already fetched in Edge Function step 4; frontend reads from `profile.default_sender_name` / `profile.default_sender_email` via useAuth |
| CSV-05 | Post-create review page shows recipient list with send-now or schedule controls | New page `/campaigns/new/csv/review/:id` (or `/campaigns/:id/csv-review`); reuses SchedulingSection component |
</phase_requirements>

---

## Standard Stack

### Core (no new installs required)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| papaparse | ^5.5.3 | CSV parsing | Already installed — used in ImportWizardModal and ImportCampaignsModal |
| @supabase/supabase-js | 2.49.4 | DB upsert, campaign insert, recipient bulk insert | Already installed |
| react-router-dom | 7.5.3 | New route `/campaigns/new/csv` + review route | Already installed |
| lucide-react | 0.511.0 | Icons (UploadCloud, X, Check already used in import modals) | Already installed |

**Installation:** No new packages required. [VERIFIED: package.json]

---

## Architecture Patterns

### Recommended Project Structure (new files only)

```
src/
├── pages/campaigns/
│   ├── CsvUploadPage.tsx         # dropzone → parse → validate → preview → create
│   └── CsvReviewPage.tsx         # recipient list + send/schedule controls
├── hooks/campaigns/
│   └── useCsvCampaign.ts         # createCsvCampaign, sendCsvCampaign
supabase/
└── migrations/
    └── 011_csv_personalized.sql
supabase/functions/send-campaign/
└── index.ts                      # branch added — not a new file
```

### Pattern 1: campaign_type CHECK Constraint Extension

The 007 migration added the constraint inline with the column. To extend it, the pattern is DROP the existing constraint by name and re-ADD with the expanded value list. [VERIFIED: supabase/migrations/007_ab_test_columns.sql]

```sql
-- Source: migrations/007_ab_test_columns.sql — constraint name pattern
-- The constraint was created inline as CHECK (campaign_type IN ('regular', 'ab_test', 'ab_variant'))
-- Postgres constraint name is auto-generated as: campaigns_campaign_type_check
ALTER TABLE public.campaigns
  DROP CONSTRAINT campaigns_campaign_type_check,
  ADD CONSTRAINT campaigns_campaign_type_check
    CHECK (campaign_type IN ('regular', 'ab_test', 'ab_variant', 'csv_personalized'));
```

**CRITICAL NOTE:** The 007 migration uses `DEFAULT 'regular'`, but `database.ts` line 70 shows `CampaignType = 'regular' | 'ab_test' | 'ab_variant'`. The migration 011 must add `'csv_personalized'` to the check constraint. The TypeScript type alias must also be extended to include `'csv_personalized'`.

### Pattern 2: papaparse header:true Mode

The existing import modals use array-mode (`Papa.parse<string[]>`). For Phase 9, header-mode is cleaner because column names are fixed. [VERIFIED: src/components/contacts/ImportWizardModal.tsx, src/components/campaigns/ImportCampaignsModal.tsx]

```typescript
// Source: existing ImportWizardModal.tsx pattern — adapted for header:true
Papa.parse<Record<string, string>>(file, {
  header: true,
  skipEmptyLines: true,
  complete: (results) => {
    const rows = results.data
    const headers = results.meta.fields ?? []
    // Validate required columns
    const required = ['first_name', 'last_name', 'email', 'subject', 'body']
    const missing = required.filter(col => !headers.includes(col))
    if (missing.length > 0) {
      setParseError(`Missing required columns: ${missing.join(', ')}`)
      return
    }
    setCsvRows(rows)
  },
  error: (err) => setParseError(err.message),
})
```

### Pattern 3: send-campaign Edge Function Branch (exact insertion point)

The current pipeline in `send-campaign/index.ts` at step 12a (lines 265-275):

```typescript
// CURRENT (lines 265-275):
const personalizedBody = personalizeHtml(campaign.body_html, contact)
const personalizedSig = signatureHtml ? personalizeHtml(signatureHtml, contact) : null
const bodyWithSignature = injectSignature(personalizedBody, personalizedSig)
const { html: wrappedHtml, linkMap } = wrapLinks(bodyWithSignature, trackingId, TRACKING_BASE)
const htmlWithUnsub = addUnsubscribeFooter(wrappedHtml, trackingId, TRACKING_BASE)
const finalHtml = injectPixel(htmlWithUnsub, trackingId, TRACKING_BASE)
const personalizedSubject = personalizeText(campaign.subject, contact)
```

```typescript
// REPLACEMENT — branch on recipient.personalized_body:
// recipient now has personalized_subject and personalized_body from the DB query

let rawBody: string
let finalSubject: string

if (recipient.personalized_body != null) {
  // csv_personalized path: body and subject are already final, no variable substitution, no signature
  rawBody = recipient.personalized_body
  finalSubject = recipient.personalized_subject ?? campaign.subject
} else {
  // standard / ab_variant path: existing logic
  const personalizedBody = personalizeHtml(campaign.body_html, contact)
  const personalizedSig = signatureHtml ? personalizeHtml(signatureHtml, contact) : null
  rawBody = injectSignature(personalizedBody, personalizedSig)
  finalSubject = personalizeText(campaign.subject, contact)
}

const { html: wrappedHtml, linkMap } = wrapLinks(rawBody, trackingId, TRACKING_BASE)
const htmlWithUnsub = addUnsubscribeFooter(wrappedHtml, trackingId, TRACKING_BASE)
const finalHtml = injectPixel(htmlWithUnsub, trackingId, TRACKING_BASE)
```

**IMPORTANT:** The Edge Function currently fetches contacts from `contact_list_members` (step 8-9). For `csv_personalized`, recipients are already in `campaign_recipients` with personalized content. The send path must be different: instead of loading contacts and building recipients, it loads the pre-built recipients directly. See the "CSV send flow" pattern below.

### Pattern 4: CSV Campaign Send Flow (different from standard)

For `csv_personalized`, the contact loading + recipient building done at steps 8-12 is replaced:

```typescript
// After step 7 (status validation), check campaign_type:
if (campaign.campaign_type === 'csv_personalized') {
  // Load pre-built recipients from campaign_recipients
  const { data: recipients, error: recipientsError } = await adminClient
    .from('campaign_recipients')
    .select('*, contacts(*)')
    .eq('campaign_id', campaign_id)
    .eq('status', 'queued')  // Only unsent

  // recipients[i].personalized_body / personalized_subject are populated
  // Skip: contact list check (no contact_list_id), contact loading, wrapLinks for campaign_links
  // Apply: wrapLinks per-recipient (links differ per row), pixel, unsub footer
  // ...batch send loop uses recipient.personalized_body directly
}
```

**ALSO:** Step 8 currently hard-errors on missing `contact_list_id`:
```typescript
// Current line 166-171:
if (!campaign.contact_list_id) {
  return new Response(JSON.stringify({ error: 'Campaign has no target contact list' }), ...)
}
```
This guard must be conditioned to skip for `csv_personalized`. [VERIFIED: supabase/functions/send-campaign/index.ts lines 165-170]

### Pattern 5: contact_list_id guard bypass

```typescript
// Modified guard:
if (!campaign.contact_list_id && campaign.campaign_type !== 'csv_personalized') {
  return new Response(JSON.stringify({ error: 'Campaign has no target contact list' }), {
    status: 400,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
```

### Pattern 6: campaign_links table for csv_personalized

The current step 11 builds `campaign_links` from `campaign.body_html` as the source of truth for click redirects. For `csv_personalized`, `body_html` is NULL and each recipient has a different body. Two options:
- **Option A (recommended):** Skip `campaign_links` for `csv_personalized` — the `variables` JSONB on each `campaign_recipient` already stores the per-recipient link map, and the `t` function redirect uses `variables` (not `campaign_links`). Confirm by checking `t` function behavior. [ASSUMED — need to verify `t` Edge Function uses `campaign_recipient.variables` not `campaign_links` for click redirect]
- **Option B:** Build per-recipient `campaign_links` rows with a `recipient_id` discriminator — more complex, not needed for MVP.

### Pattern 7: CampaignsPage dropdown (exact current state)

Current header has three separate buttons [VERIFIED: src/pages/campaigns/CampaignsPage.tsx lines 121-133]:
```tsx
<Button variant="secondary" onClick={() => setShowImportModal(true)}>Import Campaigns</Button>
<Button variant="secondary" onClick={() => navigate('/campaigns/ab-test/new')}>New A/B test</Button>
<Button variant="primary" onClick={() => navigate('/campaigns/new')}>New Campaign</Button>
```

The "New A/B test" button becomes one of three items in a dropdown triggered by the primary "New Campaign" button. The `openMenuId` / `menuRef` pattern already exists in CampaignsPage for row menus — the same pattern can be reused for the header dropdown.

```tsx
// New dropdown structure (replaces the two separate "New" buttons):
<div className="relative" ref={newCampaignMenuRef}>
  <Button variant="primary" size="md" onClick={() => setNewCampaignMenuOpen(prev => !prev)}>
    <Plus size={16} />
    New Campaign
    <ChevronDown size={14} />
  </Button>
  {newCampaignMenuOpen && (
    <div className="absolute right-0 top-full mt-1 z-20 bg-gray-800 border border-gray-700 rounded-lg shadow-lg py-1 min-w-[180px]">
      <button onClick={() => { navigate('/campaigns/new'); setNewCampaignMenuOpen(false) }}>
        Standard
      </button>
      <button onClick={() => { navigate('/campaigns/ab-test/new'); setNewCampaignMenuOpen(false) }}>
        A/B Test
      </button>
      <button onClick={() => { navigate('/campaigns/new/csv'); setNewCampaignMenuOpen(false) }}>
        CSV Personalized
      </button>
    </div>
  )}
</div>
```

### Pattern 8: CSV badge in campaign list

Current badge logic [VERIFIED: CampaignsPage.tsx lines 204-208]:
```tsx
{campaign.campaign_type === 'ab_test' && (
  <Badge className="bg-teal-900/50 text-teal-400">A/B Test</Badge>
)}
```

Add alongside:
```tsx
{campaign.campaign_type === 'csv_personalized' && (
  <Badge className="bg-purple-900/50 text-purple-400">CSV</Badge>
)}
```

### Pattern 9: handleRowClick routing for csv_personalized

Current logic [VERIFIED: CampaignsPage.tsx lines 86-93]:
```tsx
const handleRowClick = (e, campaign) => {
  if (campaign.campaign_type === 'ab_test') {
    navigate(`/campaigns/${campaign.id}/ab-test/edit`)
  } else {
    navigate(`/campaigns/${campaign.id}/edit`)
  }
}
```

Must add a third branch:
```tsx
if (campaign.campaign_type === 'csv_personalized') {
  navigate(`/campaigns/${campaign.id}/csv-review`)
}
```

### Pattern 10: Contact upsert in useCsvCampaign hook

```typescript
// Source: CONTEXT.md decision + Phase 1 pattern (ImportWizardModal.tsx)
const { data: upsertedContacts, error } = await supabase
  .from('contacts')
  .upsert(
    rows.map(row => ({
      workspace_id: profile.workspace_id,
      email: row.email.toLowerCase().trim(),
      first_name: row.first_name || null,
      last_name: row.last_name || null,
      company: null,
      tags: [],
      custom_fields: {},
      status: 'active' as const,
    })),
    { onConflict: 'workspace_id,email', ignoreDuplicates: false }
  )
  .select('id, email')
```

**NOTE:** The contacts table has a unique constraint on `(workspace_id, email)` — confirmed by the Phase 1 decision log which states "Application-level duplicate detection over onConflict — partial functional index prevents PostgREST ON CONFLICT targeting." [ASSUMED — this decision may have applied to the old wizard; the new CONTEXT.md explicitly specifies `onConflict: 'workspace_id,email'` so the constraint must now exist. Planner should verify the unique constraint exists in the live schema before building the upsert.]

### Pattern 11: useCsvCampaign hook structure

Following `useCampaigns.ts` pattern [VERIFIED: src/hooks/campaigns/useCampaigns.ts]:

```typescript
// src/hooks/campaigns/useCsvCampaign.ts
export function useCsvCampaign() {
  const { profile } = useAuth()

  const createCsvCampaign = async (payload: {
    name: string
    rows: CsvRow[]  // { first_name, last_name, email, subject, body }
  }): Promise<{ data: { campaignId: string; recipientCount: number } | null; error: string | null }> => {
    // 1. Upsert contacts → get contact id map
    // 2. Create campaign (campaign_type='csv_personalized', body_html=null)
    // 3. Bulk insert campaign_recipients with personalized_subject + personalized_body
    // Returns campaignId for redirect to review page
  }

  const sendCsvCampaign = async (campaignId: string): Promise<{ error: string | null; sent?: number }> => {
    // Invoke send-campaign Edge Function — same invocation as standard
    const { data: { session } } = await supabase.auth.getSession()
    const { data, error } = await supabase.functions.invoke('send-campaign', {
      body: { campaign_id: campaignId },
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
    return error ? { error: error.message } : { error: null, sent: data?.sent }
  }

  return { createCsvCampaign, sendCsvCampaign }
}
```

### Pattern 12: 5-row preview with body truncation

Per CONTEXT.md specifics: body preview must show first 100 chars of HTML stripped to plain text.

```typescript
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim()
}

function truncateBody(html: string, maxChars = 100): string {
  const plain = stripHtml(html)
  return plain.length > maxChars ? plain.slice(0, maxChars) + '…' : plain
}
```

### Anti-Patterns to Avoid

- **Rendering raw HTML in the preview table:** The body column contains HTML. Always strip and truncate before displaying in a `<td>`.
- **Injecting signature for csv_personalized:** The `injectSignature` call must be skipped for the personalized path. Body is final as-is.
- **Using campaign.body_html in step 11 (campaign_links) for csv_personalized:** body_html is NULL — this will crash with `.replace()` on null. Must branch before that block.
- **Missing the contact_list_id guard:** Step 8 will reject the campaign before reaching the personalized branch. Guard must be conditioned first.
- **Using array-mode papaparse then mapping by index:** Header-mode is cleaner for fixed-schema CSVs and avoids off-by-one errors when columns are reordered.
- **`useCampaigns.fetchCampaigns` excludes `ab_variant` but not `csv_personalized`:** The fetch filter `.not('campaign_type', 'eq', 'ab_variant')` will correctly include `csv_personalized` campaigns in the list — no change needed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV parsing | Custom split/regex parser | `Papa.parse` (already installed) | Handles quoted fields, escaped commas, encoding edge cases |
| HTML-to-plaintext for preview | DOMParser or regex | Simple tag-strip regex `html.replace(/<[^>]+>/g, '')` | Sufficient for 100-char preview; no dependency needed |
| Dropzone | Custom drag-and-drop logic | Copy from `ImportWizardModal.tsx` | Pattern already exists and tested |
| Contact dedup on upsert | Fetch-then-insert | Supabase `.upsert()` with `onConflict` | Single round-trip |

---

## Runtime State Inventory

> This is a greenfield addition (new campaign_type, new columns, new pages). No existing runtime state is renamed or migrated.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | None — new columns added with NULL default | None |
| Live service config | None | None |
| OS-registered state | None | None |
| Secrets/env vars | None — existing RESEND_API_KEY used | None |
| Build artifacts | None | None |

---

## Common Pitfalls

### Pitfall 1: campaign.body_html is NULL in send-campaign step 11
**What goes wrong:** Step 11 calls `campaign.body_html.replace(...)` to build campaign_links. For `csv_personalized`, `body_html` is NULL — this throws `Cannot read properties of null (reading 'replace')`.
**Why it happens:** The step assumes body_html is always a string (it is for standard campaigns).
**How to avoid:** Add an early branch: `if (campaign.campaign_type === 'csv_personalized') { /* skip campaign_links building, proceed to step 12 */ }`.
**Warning signs:** Edge Function returns 500 immediately on send.

### Pitfall 2: contact_list_id guard blocks csv_personalized campaigns
**What goes wrong:** Step 8 returns 400 "Campaign has no target contact list" before any personalized logic runs.
**Why it happens:** Hard guard with no campaign_type exception.
**How to avoid:** Modify guard to `if (!campaign.contact_list_id && campaign.campaign_type !== 'csv_personalized')`.
**Warning signs:** send-campaign returns `{ error: 'Campaign has no target contact list' }` immediately.

### Pitfall 3: Signature injected into csv_personalized body
**What goes wrong:** User's workspace signature is appended to the already-final CSV body, producing garbled output.
**Why it happens:** `injectSignature` is called unconditionally in the standard path.
**How to avoid:** The branch replaces the entire standard path for csv_personalized — `injectSignature` is never called in the csv branch.

### Pitfall 4: campaign_recipients INSERT missing new columns
**What goes wrong:** TypeScript type `CampaignRecipient` does not include `personalized_subject`/`personalized_body` until database.ts is updated. Insert succeeds at runtime (Supabase is permissive) but TypeScript compile fails.
**Why it happens:** Types lag behind the migration.
**How to avoid:** Update `CampaignRecipient` interface and its `Insert`/`Update` types in database.ts as part of Plan 01.

### Pitfall 5: CSV column name case mismatch
**What goes wrong:** User's CSV has `First_Name` or `EMAIL` — validation reports them as missing.
**Why it happens:** CONTEXT.md specifies case-sensitive validation for exact names.
**How to avoid:** The validation must check `results.meta.fields` against the exact list `['first_name', 'last_name', 'email', 'subject', 'body']`. Document this requirement clearly in the upload UI.

### Pitfall 6: Recipient query in Edge Function for csv_personalized doesn't fetch personalized columns
**What goes wrong:** The existing recipient query `select('*')` will include the new columns once migration is applied — but the TypeScript types in the Deno function won't know about them until the function is updated.
**Why it happens:** Edge Functions use `any` casts for Supabase responses — this is actually fine here since the function accesses fields by property access.
**How to avoid:** Use `(recipient as any).personalized_body` or update the local type declaration in the function.

### Pitfall 7: useCampaigns.duplicateCampaign copies csv_personalized as standard
**What goes wrong:** `duplicateCampaign` copies `body_html` (which is null) and doesn't copy `campaign_type`. The duplicate would be a broken standard campaign.
**How to avoid:** For MVP, the CampaignsPage row menu "Duplicate" option should be hidden for `csv_personalized` campaigns (same pattern as A/B variants are hidden from the list). Alternatively, disable duplicate for this type.

### Pitfall 8: wrapLinks builds per-recipient link maps but campaign_links table expects per-campaign rows
**What goes wrong:** The `t` function uses campaign_links for analytics (unique_clicks, click_count). For csv_personalized, each recipient has different links, so campaign-level link analytics won't be accurate.
**Why it happens:** campaign_links was designed for standard campaigns with shared body.
**How to avoid:** For MVP, skip campaign_links insert for csv_personalized. Per-recipient click tracking still works via `campaign_recipient.variables` JSONB. Link analytics tab in CampaignAnalyticsPage may show empty for CSV campaigns — acceptable for MVP.

---

## Code Examples

### Migration 011 exact SQL

```sql
-- Migration 011: CSV Personalized Campaigns
-- Phase 9

-- 1. Extend campaign_type check constraint
ALTER TABLE public.campaigns
  DROP CONSTRAINT campaigns_campaign_type_check,
  ADD CONSTRAINT campaigns_campaign_type_check
    CHECK (campaign_type IN ('regular', 'ab_test', 'ab_variant', 'csv_personalized'));

-- 2. Add personalized columns to campaign_recipients
ALTER TABLE public.campaign_recipients
  ADD COLUMN IF NOT EXISTS personalized_subject TEXT,
  ADD COLUMN IF NOT EXISTS personalized_body    TEXT;

-- Index for efficient lookup of recipients by campaign when sending
-- (existing idx_campaign_recipients_campaign covers this)
-- No new RLS policies needed — existing workspace_id check via campaigns JOIN covers new rows
```

**VERIFIED constraint name assumption:** The 007 migration does not name the constraint explicitly (`ADD COLUMN ... CHECK (...)`). PostgreSQL auto-names it `campaigns_campaign_type_check`. [ASSUMED — verify the actual constraint name in Supabase SQL Editor with `\d campaigns` before running 011.]

### TypeScript types to add/update (database.ts)

```typescript
// Update CampaignType (line 70):
export type CampaignType = 'regular' | 'ab_test' | 'ab_variant' | 'csv_personalized'

// Add CsvRow interface:
export interface CsvRow {
  first_name: string
  last_name: string
  email: string
  subject: string
  body: string
}

// Update CampaignRecipient to include new columns (after line 208):
export interface CampaignRecipient {
  // ... existing fields ...
  personalized_subject: string | null   // ADD
  personalized_body: string | null      // ADD
}

// Update Database.campaign_recipients Insert type to allow new columns:
// The Insert type is Omit<CampaignRecipient, 'id' | 'created_at' | 'tracking_id'>
// — new columns are included automatically since they're on CampaignRecipient
```

### New routes to add in App.tsx

```tsx
// Import new pages
import { CsvUploadPage } from './pages/campaigns/CsvUploadPage'
import { CsvReviewPage } from './pages/campaigns/CsvReviewPage'

// Add inside <Route element={<AppLayout />}>:
<Route path="/campaigns/new/csv" element={<CsvUploadPage />} />
<Route path="/campaigns/:id/csv-review" element={<CsvReviewPage />} />
```

**Route ordering:** `/campaigns/new/csv` must be placed BEFORE `/campaigns/:id/edit` to avoid `:id` matching `new`. The current route order already has `/campaigns/new` before `/:id/edit` — follow same pattern. [VERIFIED: src/App.tsx lines 42-47]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| contacts import: app-level dedup | onConflict upsert (specified in CONTEXT.md) | Phase 9 | Simpler, single round-trip |
| single "New Campaign" button | dropdown with 3 campaign types | Phase 9 | UI change needed |
| send-campaign: always uses campaign.body_html | branch on personalized_body | Phase 9 | Edge Function change |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | PostgreSQL auto-names the check constraint `campaigns_campaign_type_check` | Migration 011 SQL | Migration fails with "constraint not found" — fix: query actual name with `\d campaigns` first |
| A2 | `(workspace_id, email)` unique constraint exists on contacts table for upsert | Pattern 10 | `.upsert()` with `onConflict` will error if constraint missing — may need to add it in 011 |
| A3 | The `t` Edge Function uses `campaign_recipient.variables` JSONB (not `campaign_links`) for click redirect | Pitfall 8 | If `t` uses campaign_links, CSV clicks will fail to redirect — need to read `t/index.ts` |
| A4 | `CampaignRecipient` Insert type auto-includes new columns (Omit passes them through) | TypeScript types | Compile error if Insert type was hand-defined without the new fields |
| A5 | `useCampaigns.fetchCampaigns` `.not('campaign_type', 'eq', 'ab_variant')` will show csv_personalized in list | Standard Stack | CSV campaigns would be hidden from list if filter incorrectly excluded them |

---

## Open Questions

1. **t Edge Function click redirect mechanism**
   - What we know: `campaign_recipient.variables` stores the link map; `campaign_links` stores per-campaign link stats
   - What's unclear: Does the `t` function redirect using `variables` or `campaign_links`? (File `supabase/functions/t/index.ts` was not read in this research pass)
   - Recommendation: Planner should read `t/index.ts` before Plan 04 to confirm whether campaign_links insert must be adapted for csv_personalized or can be safely skipped.

2. **contacts unique constraint for upsert**
   - What we know: Phase 1 notes say "Application-level duplicate detection over onConflict — partial functional index prevents PostgREST ON CONFLICT targeting"
   - What's unclear: Whether a true unique constraint on `(workspace_id, email)` exists or only a partial index
   - Recommendation: Migration 011 should add `CREATE UNIQUE INDEX IF NOT EXISTS contacts_workspace_email_unique ON contacts(workspace_id, email) WHERE deleted_at IS NULL` if not already present. Confirm in Supabase.

3. **Review page design: dedicated route vs modal**
   - What we know: CONTEXT.md says "review page showing recipient list + send-now / schedule controls"
   - What's unclear: Should this be a full page (like CampaignBuilderPage) or a modal overlay?
   - Recommendation: Full page at `/campaigns/:id/csv-review` — consistent with existing pattern; allows direct linking.

---

## Environment Availability

> Step 2.6: No new external dependencies. All tools are already installed and configured. SKIPPED for enumeration — papaparse, Supabase, React Router all confirmed present.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — no pytest.ini, jest.config.*, vitest.config.* found |
| Config file | None |
| Quick run command | `npm run build && npm run lint` (type-check + lint as proxy) |
| Full suite command | `npm run build && npm run lint` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CSV-01 | CSV upload + column validation + 5-row preview renders | manual-only | — | N/A |
| CSV-02 | Contact upsert + campaign_recipients bulk insert | manual-only (smoke test) | — | N/A |
| CSV-03 | send-campaign branches on personalized_body | manual-only (smoke test) | — | N/A |
| CSV-04 | Sender defaults from profile used in campaign | manual-only | — | N/A |
| CSV-05 | Review page shows recipients + send controls | manual-only | — | N/A |

### Sampling Rate
- **Per task commit:** `npm run build && npm run lint`
- **Per wave merge:** `npm run build && npm run lint`
- **Phase gate:** Full build green + manual smoke test before `/gsd-verify-work`

### Wave 0 Gaps
- None — no test framework to set up. Build + lint is the automated gate.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing JWT guard in send-campaign unchanged |
| V3 Session Management | yes | `supabase.auth.getSession()` before Edge Function invoke |
| V4 Access Control | yes | workspace_id isolation: campaign insert uses profile.workspace_id; Edge Function checks campaign.workspace_id === workspaceId |
| V5 Input Validation | yes | CSV column presence validated before processing; email format not validated beyond trim+lowercase (same as existing import) |
| V6 Cryptography | no | No new crypto |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Workspace_id injection via CSV row | Tampering | Hook always uses `profile.workspace_id` from auth context, never from CSV data |
| HTML injection in personalized_body | Tampering | Body is pre-composed by the account owner — same trust level as TipTap body_html; no additional sanitization needed for MVP |
| Mass recipient send via crafted CSV | Elevation of Privilege | Contacts are upserted into requester's workspace only; send-campaign workspace check unchanged |
| Session expiry mid-upload | Denial of Service | Check `if (!session)` before invoking Edge Function — same guard as CampaignBuilderPage |

---

## Sources

### Primary (HIGH confidence)
- `supabase/functions/send-campaign/index.ts` — full pipeline read, exact line numbers documented
- `supabase/migrations/007_ab_test_columns.sql` — campaign_type constraint pattern
- `supabase/migrations/010_signature.sql` — confirms 010 is latest, 011 is next
- `supabase/migrations/004_campaign_recipients.sql` — original schema (pre-live columns differ per MEMORY.md)
- `src/hooks/campaigns/useCampaigns.ts` — hook pattern, fetchCampaigns filter
- `src/pages/campaigns/CampaignsPage.tsx` — exact button layout, badge pattern, handleRowClick
- `src/pages/campaigns/CampaignBuilderPage.tsx` — form patterns, sendCampaign invocation
- `src/types/database.ts` — CampaignType, CampaignRecipient, CampaignInsert exact definitions
- `src/App.tsx` — existing route order
- `src/components/contacts/ImportWizardModal.tsx` — papaparse usage pattern
- `src/components/campaigns/ImportCampaignsModal.tsx` — second papaparse usage pattern
- `package.json` — papaparse ^5.5.3 confirmed installed

### Secondary (MEDIUM confidence)
- MEMORY.md — confirms live `campaign_recipients` columns differ from 004 migration (status/resend_message_id/variables/workspace_id are live columns)

### Tertiary (LOW confidence — see Assumptions Log)
- A1, A2, A3: PostgreSQL constraint name, contacts unique index, t function redirect mechanism — not verified from source

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages confirmed in package.json
- Architecture: HIGH — all insertion points verified from source files
- Pitfalls: HIGH — derived directly from reading the actual Edge Function pipeline
- Migration SQL: MEDIUM — constraint name is assumed (A1), contacts unique index is assumed (A2)

**Research date:** 2026-04-15
**Valid until:** 2026-05-15 (stable codebase, no fast-moving dependencies)
