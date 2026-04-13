# Phase 1: Contact Lists - Research

**Researched:** 2026-04-13
**Domain:** React 19 + Supabase JS v2 — Contact CRUD, CSV Import, List Management
**Confidence:** HIGH (primary findings verified against official docs and live npm registry)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Page Architecture**
- D-01: Single `/contacts` page with two tabs: "All Contacts" and "Lists"
- D-02: The "All Contacts" tab shows the full contacts table with search/filter controls
- D-03: The "Lists" tab shows named lists with their contact counts and management actions
- D-04: Clicking a list in the Lists tab filters the view to show only contacts in that list (inline filtered state, not a separate route)
- D-05: URL can use query params (`/contacts?list=<id>`) to enable deep-linking to a list's filtered view

**Contact Detail View**
- D-06: Clicking a contact opens a slide-in drawer from the right
- D-07: The drawer contains: contact fields (edit inline), delete action, and list membership management
- D-08: Drawer stays open while the contact list behind it remains visible
- D-09: Edit, delete, and add-to/remove-from-list all happen within the drawer

**CSV Import UX**
- D-10: Import triggered via button that opens a multi-step wizard modal
- D-11: Wizard steps: Upload CSV → Map columns → Preview (5 rows) + summary → Confirm
- D-12: Column mapping: dropdowns to map CSV headers to contact fields; email required
- D-13: User can apply tags to all contacts during import
- D-14: Preview step shows 5 sample rows and summary count ("142 contacts to import, 3 skipped")

**Duplicate Handling (CONT-02)**
- D-15: Radio selector: "Skip duplicates" (default) vs "Update existing contacts"
- D-16: Duplicate detection by email (case-insensitive)
- D-17: Preview step shows detected duplicate count for current strategy

**Import History (CONT-04)**
- D-18: "View import history" link opens a panel/modal (not a separate tab)
- D-19: Panel shows past imports: date, total rows, imported, skipped, errors

### Claude's Discretion
- List color picker: preset palette of 8-10 colors (chips), not a free color picker
- Contact count on `contact_lists`: maintain via Supabase DB trigger on `contact_list_members` insert/delete
- Custom fields filter (CONT-09): simple key-value text filter (enter field name + value); not a dynamic dropdown
- Number of rows in CSV preview: 5 rows
- Empty state designs for contacts list and lists tab

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CONT-01 | User can upload a CSV file and map columns to contact fields (email, first name, last name, company) | PapaParse 5.5.3 for browser CSV parsing; multi-step wizard modal pattern |
| CONT-02 | CSV import handles duplicates — skip or update existing contacts by email | Application-level duplicate handling required (see critical pitfall on partial functional index) |
| CONT-03 | User can apply tags to all contacts during CSV import | Tags as TEXT[] in DB; wizard step to enter tag strings before confirm |
| CONT-04 | User can view import history with row counts and error details | Requires new `contact_import_logs` table (NOT in schema-v1.md); migration needed |
| CONT-05 | User can manually create, edit, and delete individual contacts | Supabase CRUD via drawer; soft delete via `deleted_at` update |
| CONT-06 | User can search contacts by email or name | `.or('email.ilike.%q%,first_name.ilike.%q%,last_name.ilike.%q%')` |
| CONT-07 | User can filter contacts by tag | `.contains('tags', ['tag'])` using GIN index |
| CONT-08 | User can filter contacts by status | `.eq('status', value)` — status CHECK constraint enforces valid values |
| CONT-09 | User can filter contacts by custom field values | `.contains('custom_fields', { key: value })` on JSONB column |
| LIST-01 | User can create a contact list with name, description, and color | Insert into `contact_lists` with preset color value |
| LIST-02 | User can rename and delete contact lists | Update/soft-delete `contact_lists`; cascade deletes `contact_list_members` |
| LIST-03 | User can add and remove contacts from a list | Insert/delete `contact_list_members`; trigger updates `contact_count` |
| LIST-04 | User can view contacts within a specific list | Join `contact_list_members` → `contacts` or filter by list ID |
| LIST-05 | Contact lists display contact count | `contact_count` denormalized column maintained by DB trigger |
</phase_requirements>

---

## Summary

Phase 1 builds the entire contact data layer for MailOps: CSV import with wizard UX, individual contact CRUD via a slide-in drawer, search/filter across multiple dimensions, and named contact list management. The tech stack is fully established (React 19, Supabase JS 2.103.0, Tailwind CSS 4.1.4) — no new framework dependencies are needed except PapaParse for CSV parsing.

The most critical finding is about duplicate detection during CSV import: the `contacts` table uses a **partial functional unique index** (`ON contacts(workspace_id, lower(email)) WHERE deleted_at IS NULL`). PostgreSQL's `ON CONFLICT` clause cannot target this index type via Supabase JS's `upsert()` `onConflict` parameter. The plan must implement duplicate handling at the application level: query existing emails in the workspace first, then decide to insert or update each row individually in the batch.

A second critical finding is that the schema (schema-v1.md) has no table for import history. The `contact_import_logs` table must be created as a migration task before import history can be displayed.

**Primary recommendation:** Use PapaParse for CSV parsing; handle all duplicate logic in application code (not via Supabase upsert onConflict); batch inserts in chunks of 500 rows; create the `contact_import_logs` table as the first Wave task.

## Project Constraints (from CLAUDE.md)

| Directive | Implication for This Phase |
|-----------|---------------------------|
| Tech Stack: React 19 + TypeScript + Supabase + no custom backend | All Supabase queries direct from client; RLS enforces workspace isolation |
| Database: Schema for Modules 1-4 is live | `contacts`, `contact_lists`, `contact_list_members` tables already exist; triggers/functions must be added via SQL migration |
| Frontend only | No server-side CSV processing; PapaParse runs in the browser |
| Supabase + Resend — no changes to stack | Cannot add a new backend service for import; must use Supabase Edge Function only if needed (not needed for this phase) |
| All Supabase queries MUST include `.eq('workspace_id', profile.workspace_id)` | Every read/write scoped by workspace |
| Soft deletes: always filter `.is('deleted_at', null)` and update with `{ deleted_at: new Date() }` | Applies to contacts and contact_lists |
| Error handling: extract from Supabase response, store in state, display inline | All import errors, CRUD errors displayed in UI |
| Components: Button, Input, Card, Badge, Spinner, useToast already exist as-is | Do not rebuild these |
| PascalCase for components, camelCase for hooks, 2-space indent, single quotes | All new files follow these conventions |

---

## Standard Stack

### Core (no new installs needed)

| Library | Installed Version | Purpose | Why Standard |
|---------|------------------|---------|--------------|
| `@supabase/supabase-js` | 2.49.4 (latest: 2.103.0) | All DB reads/writes/upserts | Already in project; provides `.from().select/insert/update/upsert/delete` |
| `react-router-dom` | 7.5.3 | `useSearchParams` for `?list=<id>` deep-link | Already in project; v7 hook API stable |
| `lucide-react` | 0.511.0 | Icons (Upload, X, ChevronDown, Check, Trash2, Plus) | Already in project; used throughout codebase |
| `tailwindcss` | 4.1.4 | All UI styling (drawer, modal, table, tabs) | Already in project; dark theme established |

### New Dependency Required

| Library | Version | Purpose | Why This One |
|---------|---------|---------|--------------|
| `papaparse` | 5.5.3 | Browser CSV file parsing | Most widely used JS CSV parser; supports worker threads, streaming, auto-detection of delimiter; no server needed |

**Note:** `react-papaparse` (4.4.0) wraps PapaParse with React-specific components (CSVReader with drag-drop). However, the wizard UX requires a controlled file input — use raw `papaparse` with `FileReader` to maintain full control of the wizard step state. [VERIFIED: npm registry]

**Version verification:**
- `papaparse`: 5.5.3 (published 2025-05-19) [VERIFIED: npm registry]
- `@supabase/supabase-js` latest: 2.103.0 (published 2026-04-09) — project uses 2.49.4, which is behind. All API patterns documented here work in 2.49.4. [VERIFIED: npm registry]

**Installation:**
```bash
npm install papaparse
npm install --save-dev @types/papaparse
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `papaparse` | Native `File.text()` + manual parsing | PapaParse handles quoting, multi-line values, encoding edge cases; hand-rolling misses them |
| Application-level duplicate check | `supabase.upsert(onConflict: 'email')` | Partial functional index prevents ON CONFLICT from working — see Critical Pitfall #1 |
| Tailwind drawer (custom) | `shadcn/ui Sheet` or `headlessui Dialog` | No component library is in the project; custom drawer is ~30 lines of Tailwind |

---

## Architecture Patterns

### Recommended File Structure

```
src/
├── pages/
│   └── contacts/
│       └── ContactsPage.tsx           # Main page; tab state + URL param handling
├── components/
│   └── contacts/
│       ├── ContactsTable.tsx          # All Contacts tab — table with search/filter
│       ├── ContactsFilters.tsx        # Search bar + filter dropdowns (status, tag, custom)
│       ├── ContactDrawer.tsx          # Slide-in drawer — view/edit/delete contact
│       ├── ListsGrid.tsx              # Lists tab — grid of list cards
│       ├── CreateListModal.tsx        # Modal for creating a new list
│       ├── ImportWizardModal.tsx      # Multi-step CSV import wizard
│       ├── ImportHistoryModal.tsx     # Import history panel/modal
│       └── ColorPicker.tsx            # Preset color chip selector (8-10 colors)
└── hooks/
    └── contacts/
        ├── useContacts.ts             # Fetch contacts with filters; returns { contacts, loading, error, refetch }
        └── useContactLists.ts         # Fetch contact lists; returns { lists, loading, error, refetch }
```

**Rationale:** One page component keeps URL/tab state. Sub-components are pure (receive props/callbacks). Custom hooks encapsulate Supabase queries and keep components thin.

### Pattern 1: Tab + URL State with useSearchParams

**What:** Two tabs controlled by `?list=<id>` query param. No param = All Contacts. Param present = Lists tab focused on that list.
**When to use:** Whenever a page has deep-linkable tabbed state.

```typescript
// Source: react-router-dom v7 useSearchParams hook
import { useSearchParams } from 'react-router-dom'

export function ContactsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeListId = searchParams.get('list') // null = All Contacts tab

  const handleListClick = (listId: string) => {
    setSearchParams({ list: listId })
  }

  const handleClearList = () => {
    setSearchParams({})
  }

  const activeTab = activeListId ? 'lists' : 'all'
  // ...
}
```

[CITED: https://reactrouter.com/api/hooks/useSearchParams]

### Pattern 2: Slide-In Drawer (No Library)

**What:** Fixed right-side panel that overlays the content without covering the full screen. Background table stays visible and interactive.
**When to use:** Detail view where context preservation matters.

```typescript
// Source: Tailwind CSS utility pattern — ASSUMED pattern, verified structure against Tailwind docs
interface ContactDrawerProps {
  contact: Contact | null
  onClose: () => void
}

export function ContactDrawer({ contact, onClose }: ContactDrawerProps) {
  if (!contact) return null

  return (
    <>
      {/* Translucent backdrop — does NOT cover sidebar */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />
      {/* Drawer panel */}
      <div className="fixed right-0 top-0 h-full w-96 bg-gray-900 border-l border-gray-800 z-50 overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-gray-100 font-semibold">Contact</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        {/* Content */}
        <div className="p-4 flex flex-col gap-4">
          {/* fields, actions */}
        </div>
      </div>
    </>
  )
}
```

**Note:** Use `z-40` on backdrop and `z-50` on drawer panel. The AppLayout uses `overflow-hidden` on the shell, so the drawer must be `position: fixed` (not absolute) to escape the overflow context. [VERIFIED: AppLayout.tsx read directly]

### Pattern 3: Supabase Contact Query with Filters

**What:** Build a filtered contacts query using Supabase JS chain.
**When to use:** All Contacts tab — apply search text + status + tag + custom field filters together.

```typescript
// Source: Supabase JS v2 docs — ilike, or, eq, contains
// [CITED: https://supabase.com/docs/reference/javascript/ilike]
// [CITED: https://supabase.com/docs/reference/javascript/contains]

async function fetchContacts({
  workspaceId,
  search,
  status,
  tag,
  customFieldKey,
  customFieldValue,
  listId,
}: ContactFilters) {
  let query = supabase
    .from('contacts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (search) {
    query = query.or(
      `email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`
    )
  }

  if (status) {
    query = query.eq('status', status)
  }

  if (tag) {
    query = query.contains('tags', [tag])
  }

  if (customFieldKey && customFieldValue) {
    // Filter JSONB key-value: custom_fields->>'key' = 'value'
    query = query.contains('custom_fields', { [customFieldKey]: customFieldValue })
  }

  // If viewing a specific list, join through contact_list_members
  if (listId) {
    // Use a subquery approach: fetch member contact_ids first, then filter
    const { data: members } = await supabase
      .from('contact_list_members')
      .select('contact_id')
      .eq('contact_list_id', listId)

    const contactIds = (members ?? []).map((m) => m.contact_id)
    if (contactIds.length === 0) return []
    query = query.in('id', contactIds)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}
```

**Note on list filtering:** An alternative is to use `.select('*, contact_list_members!inner(contact_list_id)')` with `.eq('contact_list_members.contact_list_id', listId)` — but the two-step approach is simpler and avoids issues with RLS on the join table. [ASSUMED — verify which approach Supabase RLS supports cleanly]

### Pattern 4: CSV Import — Application-Level Duplicate Handling

**What:** Because the contacts unique index is a partial functional index (`lower(email) WHERE deleted_at IS NULL`), `supabase.upsert({ onConflict: 'email' })` will NOT resolve conflicts correctly. Use application-level duplicate handling instead.

```typescript
// Source: Pattern derived from Supabase upsert limitations with partial functional indexes
// [CITED: https://github.com/orgs/supabase/discussions/28927]

async function importContacts(
  rows: ParsedRow[],
  workspaceId: string,
  strategy: 'skip' | 'update'
) {
  // 1. Fetch all existing emails in workspace (lowercase)
  const { data: existing } = await supabase
    .from('contacts')
    .select('id, email')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)

  const existingMap = new Map(
    (existing ?? []).map((c) => [c.email.toLowerCase(), c.id])
  )

  const toInsert: ContactInsert[] = []
  const toUpdate: { id: string; data: ContactUpdate }[] = []
  let skipped = 0
  let errors = 0

  for (const row of rows) {
    if (!row.email) { errors++; continue }
    const normalizedEmail = row.email.toLowerCase().trim()
    const existingId = existingMap.get(normalizedEmail)

    if (existingId) {
      if (strategy === 'skip') { skipped++; continue }
      toUpdate.push({ id: existingId, data: { ...row, workspace_id: workspaceId } })
    } else {
      toInsert.push({ ...row, email: normalizedEmail, workspace_id: workspaceId })
    }
  }

  // 2. Batch insert new contacts (500 rows per chunk)
  const CHUNK_SIZE = 500
  for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
    const chunk = toInsert.slice(i, i + CHUNK_SIZE)
    await supabase.from('contacts').insert(chunk)
  }

  // 3. Update existing contacts (also chunked, one at a time or via RPC if large)
  for (const { id, data } of toUpdate) {
    await supabase.from('contacts').update(data).eq('id', id)
  }

  // 4. Log to contact_import_logs
  await supabase.from('contact_import_logs').insert({
    workspace_id: workspaceId,
    total_rows: rows.length,
    imported: toInsert.length,
    updated: toUpdate.length,
    skipped,
    errors,
  })

  return { imported: toInsert.length, updated: toUpdate.length, skipped, errors }
}
```

**Warning:** Fetching all existing emails upfront works well for workspaces with up to ~50K contacts. For larger datasets, a different strategy (e.g., Supabase Edge Function) would be needed — acceptable for MVP. [ASSUMED — based on Supabase REST API limits, not measured]

### Pattern 5: DB Trigger for contact_count

**What:** Maintain the `contact_count` denormalized column on `contact_lists` via PostgreSQL trigger.
**When to use:** CONT-05, LIST-03, LIST-05 — any time contacts are added/removed from a list.

```sql
-- Source: Supabase Postgres Triggers docs
-- [CITED: https://supabase.com/docs/guides/database/postgres/triggers]

CREATE OR REPLACE FUNCTION update_contact_list_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE contact_lists
    SET contact_count = contact_count + 1,
        updated_at = now()
    WHERE id = NEW.contact_list_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE contact_lists
    SET contact_count = GREATEST(contact_count - 1, 0),
        updated_at = now()
    WHERE id = OLD.contact_list_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_contact_list_count_insert
AFTER INSERT ON contact_list_members
FOR EACH ROW EXECUTE FUNCTION update_contact_list_count();

CREATE TRIGGER trg_contact_list_count_delete
AFTER DELETE ON contact_list_members
FOR EACH ROW EXECUTE FUNCTION update_contact_list_count();
```

**Note:** Use `GREATEST(count - 1, 0)` to guard against negative counts from edge cases. [CITED: Supabase triggers docs pattern]

### Pattern 6: PapaParse CSV Parsing in Browser

**What:** Parse a user-provided File object into typed rows for the import wizard.

```typescript
// Source: PapaParse 5.5.3 official docs — papaparse.com
// [CITED: https://www.papaparse.com/docs]
import Papa from 'papaparse'

function parseCSVFile(file: File): Promise<{ headers: string[]; rows: string[][] }> {
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(file, {
      skipEmptyLines: true,
      complete: (results) => {
        const [headers, ...rows] = results.data
        resolve({ headers, rows })
      },
      error: (error) => reject(error),
    })
  })
}
```

**Note:** `skipEmptyLines: true` prevents phantom rows. The first row is treated as headers. Do NOT use `header: true` (which makes PapaParse produce objects) — using raw arrays gives the column mapping step explicit control. [ASSUMED — based on papaparse API documentation]

### Anti-Patterns to Avoid

- **Relying on `supabase.upsert({ onConflict: 'email' })`** for duplicate detection: The partial functional index cannot be targeted by PostgREST's ON CONFLICT. Silent failures or errors will occur. Always use the fetch-then-decide approach. [CITED: https://github.com/orgs/supabase/discussions/28927]
- **Running one Supabase insert per CSV row:** For a 1,000-row CSV this means 1,000 sequential requests. Batch in chunks of 500.
- **Rendering the full contacts table at once without pagination or limit:** Do not fetch all contacts in a single query without a `.limit()`. Apply a default limit (e.g., 100) and add pagination controls.
- **Forgetting `.is('deleted_at', null)`** on every contacts/lists query: Soft-deleted rows will appear in all queries without this filter.
- **Using `position: absolute` for the drawer:** AppLayout has `overflow-hidden` on its container. Absolute positioned children will be clipped. Use `position: fixed`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV file parsing | Manual string split/regex | `papaparse` 5.5.3 | Handles quoted commas, line breaks in fields, BOM characters, various encodings |
| Unique email check per workspace | Raw SQL via RPC | Fetch existing emails into a Map, then set-subtract | Simpler, no extra DB function needed at this scale |
| Contact count maintenance | Manual increment in JS after every list operation | PostgreSQL trigger on `contact_list_members` | Trigger is atomic; JS-level counting drifts on failed requests or concurrent sessions |
| Color picker UI | `<input type="color">` | Preset chip palette (8-10 colors, hard-coded) | Matches D-01 discretion decision; simpler to implement, consistent with dark theme |
| Search debouncing | `setTimeout` + `clearTimeout` manually | Inline `useState` + `useEffect` with cleanup | The existing pattern in codebase uses inline state; add 300ms debounce with useEffect |

**Key insight:** The biggest time-sink risk in this phase is CSV import edge cases. PapaParse handles them all. Invest time instead in the wizard UX and the duplicate-detection logic.

---

## Schema Gap: contact_import_logs Table

The `docs/schema-v1.md` has NO table for import history. CONT-04 requires import history display. This table must be created as a migration.

```sql
-- MUST be created in Wave 0 as a migration
CREATE TABLE public.contact_import_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES public.profiles(workspace_id),
    total_rows      INT NOT NULL DEFAULT 0,
    imported        INT NOT NULL DEFAULT 0,
    updated         INT NOT NULL DEFAULT 0,
    skipped         INT NOT NULL DEFAULT 0,
    errors          INT NOT NULL DEFAULT 0,
    error_details   JSONB DEFAULT '[]',   -- array of { row, reason } for failed rows
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_import_logs_workspace ON public.contact_import_logs(workspace_id);

ALTER TABLE public.contact_import_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workspace import logs"
    ON public.contact_import_logs FOR SELECT
    USING (workspace_id = (SELECT workspace_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own workspace import logs"
    ON public.contact_import_logs FOR INSERT
    WITH CHECK (workspace_id = (SELECT workspace_id FROM public.profiles WHERE id = auth.uid()));
```

[VERIFIED: absence confirmed by reading schema-v1.md — no import_logs table exists]

---

## TypeScript Types Needed

`src/types/database.ts` currently only has `Profile` and `Database` (profiles table only). The following interfaces must be added:

```typescript
// Add to src/types/database.ts

export interface Contact {
  id: string
  workspace_id: string
  email: string
  first_name: string | null
  last_name: string | null
  company: string | null
  tags: string[]
  custom_fields: Record<string, string>
  status: 'active' | 'unsubscribed' | 'bounced' | 'complained'
  unsubscribed_at: string | null
  bounce_type: 'hard' | 'soft' | null
  bounced_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface ContactList {
  id: string
  workspace_id: string
  name: string
  description: string | null
  color: string | null
  contact_count: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface ContactListMember {
  id: string
  contact_list_id: string
  contact_id: string
  added_at: string
}

export interface ContactImportLog {
  id: string
  workspace_id: string
  total_rows: number
  imported: number
  updated: number
  skipped: number
  errors: number
  error_details: Array<{ row: number; reason: string }>
  created_at: string
}

export type ContactInsert = Omit<Contact, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>
export type ContactUpdate = Partial<ContactInsert>
```

[VERIFIED: src/types/database.ts read directly — only profiles table types exist]

---

## Common Pitfalls

### Pitfall 1: Supabase Upsert Cannot Target Partial Functional Index (CRITICAL)

**What goes wrong:** Developer calls `supabase.from('contacts').upsert(rows, { onConflict: 'email' })` expecting duplicate emails to be skipped or updated. Instead, PostgREST throws a `42P10: there is no unique or exclusion constraint matching the ON CONFLICT specification` error (or silently inserts duplicates if the constraint name mismatch is ignored).

**Why it happens:** The unique constraint on `contacts` is a **partial functional index**: `ON contacts(workspace_id, lower(email)) WHERE deleted_at IS NULL`. PostgreSQL's `ON CONFLICT` cannot target partial indexes or functional indexes via column names in PostgREST. [CITED: https://github.com/orgs/supabase/discussions/28927]

**How to avoid:** Use the fetch-then-decide application-level approach (Pattern 4 above). Query existing emails first, build a Map, then route each row to insert, update, or skip.

**Warning signs:** If you see `42P10` errors from Supabase, or if duplicate emails are appearing after import, this is the cause.

### Pitfall 2: Drawer Clipped by AppLayout overflow-hidden

**What goes wrong:** The contact drawer renders but is clipped by the parent container's `overflow: hidden`. The drawer appears but is cut off at the main content area boundary.

**Why it happens:** `AppLayout.tsx` has `overflow-hidden` on the root `div`. Absolute-positioned children cannot escape an `overflow-hidden` ancestor.

**How to avoid:** Use `position: fixed` (Tailwind: `fixed`) for both the backdrop overlay and the drawer panel. Fixed elements are positioned relative to the viewport and bypass overflow clipping. [VERIFIED: AppLayout.tsx read directly]

**Warning signs:** Drawer renders with bottom or right edge cut off, or appears beneath the sidebar.

### Pitfall 3: Missing `.is('deleted_at', null)` Filter

**What goes wrong:** Soft-deleted contacts appear in the contacts table and in search results.

**Why it happens:** The schema uses soft deletes (`deleted_at` column). Supabase does not automatically filter these — unlike some ORMs, there is no global soft-delete scope.

**How to avoid:** Every query against `contacts` and `contact_lists` MUST include `.is('deleted_at', null)`. Add it to the custom hooks so it cannot be forgotten. [VERIFIED: schema-v1.md and CONTEXT.md conventions section]

### Pitfall 4: contact_count Drift Without Trigger

**What goes wrong:** The `contact_count` column on `contact_lists` shows stale values after contacts are added or removed.

**Why it happens:** If count maintenance is done in JavaScript (increment after a successful insert), concurrent requests or network failures leave the count out of sync.

**How to avoid:** Implement the PostgreSQL trigger on `contact_list_members` (Pattern 5 above) rather than maintaining the count in JS. The trigger is atomic with the underlying insert/delete. [CITED: Supabase triggers documentation]

**Warning signs:** List shows "5 contacts" but the filtered view shows 7 contacts.

### Pitfall 5: Sending 1000+ Individual Insert Requests During CSV Import

**What goes wrong:** Importing a 1,000-row CSV triggers 1,000 sequential Supabase network requests. The UI hangs and may show timeout errors.

**Why it happens:** Calling `.insert()` inside a `for...of` loop without batching.

**How to avoid:** Chunk the insert array into 500-row batches (Pattern 4 above). For a 1,000-row CSV, this means 2 insert requests total. [CITED: https://github.com/orgs/supabase/discussions/11349]

### Pitfall 6: PapaParse Treating First Row as Data

**What goes wrong:** The column mapping step shows an extra row (the header row) in the data preview, and the contact count is off by one.

**Why it happens:** `Papa.parse(file, { header: false })` returns all rows including the header as the first element.

**How to avoid:** Destructure `const [headers, ...rows] = results.data` after parsing with `header: false`. The mapping step uses `headers`, the data step uses `rows`. [ASSUMED — based on PapaParse API behavior]

### Pitfall 7: User Input in `.or()` Filter Causes PostgREST Injection

**What goes wrong:** Passing unsanitized search input directly into `.or('email.ilike.%<user_input>%')` can break the query or cause unexpected results if the input contains PostgREST special characters (commas, dots, parentheses).

**Why it happens:** The `.or()` method takes a raw PostgREST filter string, not parameterized values.

**How to avoid:** Escape user input before interpolating into `.or()`. Strip or encode characters: `const safe = search.replace(/[%_]/g, '\\$&')`. For MVP, a simple `.trim()` and limiting to alphanumeric + space is sufficient for a search box. [ASSUMED — based on PostgREST docs pattern, not verified against a specific PostgREST version]

---

## Code Examples

### Verified: Supabase ilike Search Across Multiple Columns

```typescript
// Source: Supabase JS docs [CITED: https://supabase.com/docs/reference/javascript/ilike]
const { data, error } = await supabase
  .from('contacts')
  .select('*')
  .eq('workspace_id', workspaceId)
  .is('deleted_at', null)
  .or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`)
  .limit(100)
```

### Verified: Supabase Array Contains for Tag Filter

```typescript
// Source: Supabase JS docs [CITED: https://supabase.com/docs/reference/javascript/contains]
const { data, error } = await supabase
  .from('contacts')
  .select('*')
  .eq('workspace_id', workspaceId)
  .is('deleted_at', null)
  .contains('tags', [selectedTag])
```

### Verified: Supabase JSONB Contains for Custom Field Filter

```typescript
// Source: Supabase JS contains() for JSONB [CITED: https://supabase.com/docs/reference/javascript/contains]
const { data, error } = await supabase
  .from('contacts')
  .select('*')
  .eq('workspace_id', workspaceId)
  .is('deleted_at', null)
  .contains('custom_fields', { [fieldName]: fieldValue })
```

### Verified: Soft Delete Pattern (from CONTEXT.md conventions)

```typescript
// Source: CONTEXT.md established patterns [VERIFIED: 01-CONTEXT.md read directly]
const { error } = await supabase
  .from('contacts')
  .update({ deleted_at: new Date().toISOString() })
  .eq('id', contactId)
  .eq('workspace_id', workspaceId)
```

### Verified: useSearchParams for List Deep-Link

```typescript
// Source: React Router v7 [CITED: https://reactrouter.com/api/hooks/useSearchParams]
import { useSearchParams } from 'react-router-dom'

const [searchParams, setSearchParams] = useSearchParams()
const listId = searchParams.get('list')

// Navigate to list view:
setSearchParams({ list: listId })

// Clear back to all contacts:
setSearchParams({})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| React Router v5 `useHistory` + `location.search` | React Router v7 `useSearchParams` | v6+ | Cleaner API, stable reference, works like useState |
| PapaParse `Papa.parse(file, { header: true })` returns objects | `header: false` + manual destructure | Always supported | More control over column mapping step |
| Supabase upsert with `onConflict` for partial indexes | Application-level duplicate detection | Ongoing limitation in PostgREST | Must fetch existing emails first |

**Deprecated/outdated:**
- `react-papaparse` CSVReader component: Overkill for a wizard that needs full step control; use raw `papaparse` directly.
- Supabase JS v1 `.insert([], { returning: 'minimal' })`: v2 default is no return; chain `.select()` explicitly when you need the inserted rows back.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Fetching all existing emails upfront (for duplicate check) is acceptable for MVP workspace sizes | Pattern 4 | If workspace has 100K+ contacts, initial fetch may be slow or hit Supabase response size limits. Mitigation: add `.limit(10000)` and warn user if exceeded. |
| A2 | Two-step list member query (fetch IDs then `.in()`) works correctly with RLS on `contact_list_members` | Pattern 3 | RESOLVED: Plan 01 migration 003 creates explicit SELECT/INSERT/DELETE RLS policies on contact_list_members, scoped through contact_lists.workspace_id. The two-step query will work correctly. |
| A3 | `Papa.parse(file, { header: false, skipEmptyLines: true })` returns first row as headers | Pattern 6 | If file has BOM or encoding issues, results.data[0] may not be headers. PapaParse handles BOM automatically, but test with real CSVs. |
| A4 | `.contains('custom_fields', { key: value })` works for all JSONB value types | Pattern 3 | JSONB contains checks for exact value match including type. Numeric values stored as strings will not match integer searches. For MVP, document that custom field values are compared as strings. |
| A5 | User input in `.or()` PostgREST filter string needs minimal escaping for MVP | Pitfall 7 | Special characters in search box could break queries. Safe for alphanumeric search; add trim() guard. |

---

## Open Questions (RESOLVED)

1. **contact_list_members RLS policy scope** -- RESOLVED
   - What we know: RLS is enabled on `contact_list_members` (per schema-v1.md) but schema-v1.md only shows the policy pattern for tables with `workspace_id` columns. `contact_list_members` has no `workspace_id` column.
   - Resolution: Plan 01 now includes `supabase/migrations/003_contact_list_members_rls.sql` which creates explicit SELECT, INSERT, and DELETE policies on `contact_list_members`. These policies scope access by joining through `contact_lists.workspace_id` using a subquery: `contact_list_id IN (SELECT id FROM contact_lists WHERE workspace_id = (SELECT workspace_id FROM profiles WHERE id = auth.uid()))`. This ensures LIST-03 (add/remove) and LIST-04 (view list members) work correctly through RLS.

2. **Supabase project version / email fetch limit** -- RESOLVED (no action needed)
   - Resolution: The APIs used (`.from().select/insert/update/upsert/contains/or/ilike`) are stable across 2.49.4 to 2.103.0. No upgrade required for this phase. Verified via npm registry and Supabase changelog.

3. **Pagination strategy for contacts table** -- RESOLVED (deferred to implementation)
   - Resolution: Use simple `.range(from, to)` offset pagination for MVP. Display 50 contacts per page with Previous/Next controls. This is handled at the component level in Plan 03 (ContactsTable) and does not require a research decision.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|---------|
| Node.js | Build tooling | Yes | v24.12.0 | — |
| npm | Package install | Yes | 11.6.2 | — |
| TypeScript | Type checking | Yes | 5.7.3 | — |
| Supabase project | DB queries | Assumed (live per STATE.md) | 2.49.4 client | — |
| `papaparse` | CSV import | Not yet installed | 5.5.3 (npm) | — needs install |
| `@types/papaparse` | TypeScript for papaparse | Not yet installed | Latest on npm | — needs install |

**Missing dependencies with no fallback:**
- `papaparse` — must be installed before implementing CSV import (CONT-01 through CONT-04)

**Missing dependencies with fallback:**
- None

---

## Validation Architecture

nyquist_validation is enabled (config.json `workflow.nyquist_validation: true`).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — no vitest/jest config found |
| Config file | None — Wave 0 must create |
| Quick run command | `npx vitest run --reporter=verbose` (after setup) |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONT-01 | CSV parsed and columns mapped correctly | unit | `npx vitest run tests/contacts/csvParsing.test.ts` | Wave 0 |
| CONT-02 | Duplicate skip/update logic routes correctly | unit | `npx vitest run tests/contacts/duplicateHandling.test.ts` | Wave 0 |
| CONT-03 | Tags applied to all import rows | unit | `npx vitest run tests/contacts/importTags.test.ts` | Wave 0 |
| CONT-04 | Import log written with correct counts | manual-only | Inspect Supabase dashboard after import | — |
| CONT-05 | Contact CRUD round-trips | manual-only | Test via UI; Supabase is external dependency | — |
| CONT-06 | Search returns correct contacts | manual-only | Test via UI search box | — |
| CONT-07 | Tag filter returns only tagged contacts | manual-only | Test via UI filter | — |
| CONT-08 | Status filter returns correct contacts | manual-only | Test via UI filter | — |
| CONT-09 | Custom field filter returns correct contacts | manual-only | Test via UI filter | — |
| LIST-01 | List creation succeeds | manual-only | Test via UI | — |
| LIST-02 | Rename/delete list | manual-only | Test via UI | — |
| LIST-03 | Add/remove contact from list | manual-only | Test via UI | — |
| LIST-04 | List-filtered view shows only list members | manual-only | Test via URL `?list=<id>` | — |
| LIST-05 | Contact count matches actual members | manual-only | Compare count display vs filtered view | — |

**Note:** Most requirements are UI-level and Supabase-dependent, making full automation impractical without a test Supabase instance. Automated tests should focus on pure business logic (CSV parsing, duplicate detection algorithm, tag application).

### Sampling Rate
- **Per task commit:** `npx vitest run tests/contacts/` (logic tests only)
- **Per wave merge:** Manual smoke test of full import wizard + CRUD + list management
- **Phase gate:** Full manual test checklist before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/contacts/csvParsing.test.ts` — covers CONT-01 (parse, header extraction)
- [ ] `tests/contacts/duplicateHandling.test.ts` — covers CONT-02 (skip/update logic)
- [ ] `tests/contacts/importTags.test.ts` — covers CONT-03 (tag merge on rows)
- [ ] `vitest.config.ts` — project has no test runner config; install vitest
- [ ] Framework install: `npm install --save-dev vitest @testing-library/react jsdom`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Auth already implemented in Module 1 |
| V3 Session Management | No | Supabase session management already in AuthContext |
| V4 Access Control | Yes | RLS policies on all tables; `workspace_id` scope on every query |
| V5 Input Validation | Yes | Email validation before insert; CSV row validation before batch |
| V6 Cryptography | No | No new cryptographic operations in this phase |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Missing workspace_id scope on query | Elevation of privilege | Always chain `.eq('workspace_id', profile.workspace_id)` — enforced by RLS + app code |
| PostgREST filter injection via `.or()` | Tampering | Sanitize search input before interpolation; strip PostgREST special chars |
| CSV file with malicious content (formula injection) | Tampering | Never execute CSV cell values; treat all imported data as strings only |
| Importing contacts from another workspace's CSV | Information Disclosure | workspace_id is set server-side from auth context, not from CSV content |
| Soft-deleted contact re-creation reveals history | Information Disclosure | Acceptable for MVP — audit trail is a feature, not a bug |

---

## Sources

### Primary (HIGH confidence)
- Schema-v1.md (read directly) — Module 2 DDL: contacts, contact_lists, contact_list_members tables
- src/types/database.ts (read directly) — Current TypeScript types
- src/contexts/AuthContext.tsx (read directly) — workspace_id access pattern
- src/App.tsx (read directly) — /contacts route, PlaceholderPage to replace
- src/components/ui/*.tsx (read directly) — Button, Input, Card, Badge, Spinner, Toast APIs
- src/components/layout/AppLayout.tsx (read directly) — overflow-hidden constraint
- package.json (read directly) — Installed dependencies and versions
- npm registry (verified via `npm view`) — papaparse 5.5.3, @supabase/supabase-js 2.103.0

### Secondary (MEDIUM confidence)
- [Supabase JS upsert docs](https://supabase.com/docs/reference/javascript/upsert) — ignoreDuplicates, onConflict behavior
- [Supabase ilike docs](https://supabase.com/docs/reference/javascript/ilike) — multi-column search pattern
- [Supabase contains docs](https://supabase.com/docs/reference/javascript/contains) — array and JSONB filtering
- [Supabase or docs](https://supabase.com/docs/reference/javascript/or) — combining filters
- [Supabase Postgres triggers docs](https://supabase.com/docs/guides/database/postgres/triggers) — counter trigger pattern
- [React Router useSearchParams](https://reactrouter.com/api/hooks/useSearchParams) — URL param state
- [Supabase discussion #28927](https://github.com/orgs/supabase/discussions/28927) — partial functional index upsert limitation
- [Supabase discussion #11349](https://github.com/orgs/supabase/discussions/11349) — batch insert 500-row chunks

### Tertiary (LOW confidence)
- PapaParse `header: false` behavior for header extraction — [ASSUMED] based on API docs, not tested in this codebase

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all libraries verified via npm registry and existing project files
- Architecture: HIGH — patterns derived from live codebase reading + Supabase official docs
- Pitfalls: HIGH for index/upsert (cited GitHub discussions); MEDIUM for PapaParse edge cases (ASSUMED)
- Schema gap: HIGH — absence of `contact_import_logs` verified by direct file read

**Research date:** 2026-04-13
**Valid until:** 2026-07-13 (stable APIs — 90 days; verify supabase-js version if upgrading)
