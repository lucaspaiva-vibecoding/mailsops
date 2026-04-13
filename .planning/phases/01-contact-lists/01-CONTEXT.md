# Phase 1: Contact Lists - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can import contacts via CSV, manage individual contacts (create/edit/delete), and organize them into named contact lists. Search and filtering by email, name, tag, status, and custom fields. This phase delivers the complete contact data foundation — no email sending or campaign features.

</domain>

<decisions>
## Implementation Decisions

### Page Architecture
- **D-01:** Single `/contacts` page with two tabs: "All Contacts" and "Lists"
- **D-02:** The "All Contacts" tab shows the full contacts table with search/filter controls
- **D-03:** The "Lists" tab shows named lists with their contact counts and management actions
- **D-04:** Clicking a list in the Lists tab filters the view to show only contacts in that list (inline filtered state, not a separate route)
- **D-05:** URL can use query params (`/contacts?list=<id>`) to enable deep-linking to a list's filtered view

### Contact Detail View
- **D-06:** Clicking a contact opens a slide-in drawer from the right
- **D-07:** The drawer contains: contact fields (edit inline), delete action, and list membership management
- **D-08:** Drawer stays open while the contact list behind it remains visible — user doesn't lose their scroll position or filter context
- **D-09:** Edit, delete, and add-to/remove-from-list all happen within the drawer (no separate page)

### CSV Import UX
- **D-10:** Import is triggered via a button on the contacts page that opens a multi-step wizard modal
- **D-11:** Wizard steps: (1) Upload CSV file → (2) Map columns to contact fields (email, first_name, last_name, company) → (3) Preview first N rows + summary → (4) Confirm import
- **D-12:** Column mapping step shows detected CSV headers with dropdowns to map each to a contact field; email is required, others optional
- **D-13:** User can apply tags to all contacts in the import during the wizard (CONT-03)
- **D-14:** Preview step shows a sample of rows and a summary count (e.g., "142 contacts to import, 3 rows skipped")

### Duplicate Handling (CONT-02)
- **D-15:** Import wizard includes a radio selector: "Skip duplicates" (default) vs "Update existing contacts with new data"
- **D-16:** Duplicate detection is by email (case-insensitive, matching the unique index on the DB)
- **D-17:** The preview step shows how many duplicates were detected given the current duplicate strategy

### Import History (CONT-04)
- **D-18:** Import history is accessible via a "View import history" link/button on the contacts page (not a separate tab)
- **D-19:** Clicking it opens a panel or modal showing past imports: date, total rows, imported, skipped, errors

### Claude's Discretion
- List color picker: use a preset palette of 8–10 colors (chips), not a free color picker
- Contact count on `contact_lists`: maintain via Supabase DB trigger on `contact_list_members` insert/delete
- Custom fields filter (CONT-09): implement as a simple key-value text filter (enter field name + value); not a dynamic dropdown UI
- Number of rows shown in CSV preview: 5 rows
- Empty state designs for contacts list and lists tab

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Database Schema
- `docs/schema-v1.md` §Module 2 — Full DDL for `contacts`, `contact_lists`, `contact_list_members` tables; column types, constraints, RLS policies, indexes

### Requirements
- `.planning/REQUIREMENTS.md` §Contacts (CONT-01 to CONT-09) — All contact management acceptance criteria
- `.planning/REQUIREMENTS.md` §Contact Lists (LIST-01 to LIST-05) — All list management acceptance criteria

### Existing Codebase
- `src/types/database.ts` — TypeScript DB types (may need extending for contacts)
- `src/contexts/AuthContext.tsx` — `profile.workspace_id` is the key for all Supabase queries
- `src/components/ui/` — Button, Input, Card, Badge, Spinner, Toast — all reusable as-is
- `src/App.tsx` — Route `/contacts` already defined as placeholder (replace with real component)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Button` — variant (primary/secondary/ghost/danger), size, loading state — use for import CTA, drawer actions, list create/delete
- `Input` — label, icon, error — use for search bar, contact form fields, list name field
- `Card` — padding variants — use as wrapper for contacts table and lists grid
- `Badge` — variant (success/warning/danger/info/default) — use for contact status display (active=success, unsubscribed=warning, bounced=danger)
- `Spinner` — sm/md/lg — use for table loading states
- `useToast()` — `showToast(message, type)` — use after import success/error, CRUD operations

### Established Patterns
- All Supabase queries MUST include `.eq('workspace_id', profile.workspace_id)` — checked in AuthContext
- Soft deletes: always filter with `.is('deleted_at', null)` on queries; use `.update({ deleted_at: new Date() })` for deletes
- Error handling: extract error from Supabase response, store in component state, display inline
- Loading state: boolean state variable, disable submit button, show Spinner
- Auth access: `const { profile } = useAuth()` — `profile.workspace_id` for all queries

### Integration Points
- `/contacts` route → replace `PlaceholderPage` with the new `ContactsPage` component in `src/App.tsx`
- `src/types/database.ts` → add `Contact`, `ContactList`, `ContactListMember` TypeScript interfaces
- AuthContext provides `profile.workspace_id` — no new auth work needed
- Sidebar already has "Contacts" nav item pointing to `/contacts` — no changes needed

</code_context>

<specifics>
## Specific Ideas

- "Bad imports create bad data" — invest in the multi-step wizard; preview step is critical
- "Slide-in drawer so you don't lose context of the list you're looking at" — drawer should be non-blocking; background list/table stays visible and scrollable
- Duplicate radio defaults to "Skip" — safer default that protects existing data

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-contact-lists*
*Context gathered: 2026-04-13*
