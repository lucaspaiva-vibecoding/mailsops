---
phase: 01-contact-lists
plan: 04
subsystem: ui/contacts
tags: [react, typescript, contacts, tailwind, supabase, drawer, pagination, filters]

# Dependency graph
requires:
  - phase: 01-02
    provides: useContacts hook, useContactLists hook, Contact type, ContactFilters interface
  - phase: 01-03
    provides: ContactsPage shell with contacts-table-slot placeholder
provides:
  - "ContactsFilters — search/status/tag/custom-field bar with 300ms debounce on all text inputs"
  - "ContactsTable — paginated table with status badges, tag pills, row click handler, empty states"
  - "ContactDrawer — fixed-position slide-in drawer with edit/delete/list-membership and new-contact mode"
  - "ContactsPage (updated) — fully wired All Contacts tab: filters + table + drawer; ?list=<id> support"
affects: [01-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "300ms debounce via useEffect + setTimeout + cleanup return in filter bar inputs"
    - "fixed z-50 drawer + fixed z-40 backdrop pattern to escape AppLayout overflow-hidden clipping"
    - "isNew prop pattern on ContactDrawer to support both new-contact and edit-contact modes from a single component"
    - "Two-step list membership: fetch memberships with contact_lists join, compute availableLists by diffing against member set"
    - "Soft delete via .update({ deleted_at: new Date().toISOString() }) — never hard DELETE"

key-files:
  created:
    - src/components/contacts/ContactsFilters.tsx
    - src/components/contacts/ContactsTable.tsx
    - src/components/contacts/ContactDrawer.tsx
  modified:
    - src/pages/contacts/ContactsPage.tsx

key-decisions:
  - "useToast imported from src/components/ui/Toast.tsx (not a standalone hook file) — deviation corrected at compile time"
  - "isNew prop on ContactDrawer instead of a separate NewContactDrawer component — single component handles both modes cleanly"
  - "ContactsPage passes effectiveFilters (merged filters + page + listId) to useContacts — single source of truth for all contact query state"

patterns-established:
  - "fixed overlay pattern: backdrop at z-40, drawer panel at z-50, both position:fixed to escape overflow-hidden layouts"
  - "Debounce pattern: local useState + useEffect with 300ms setTimeout + cleanup clearTimeout for each debounced input"
  - "Inline delete confirmation: button replaced by warning text + danger/ghost button pair (no modal needed)"

requirements-completed: [CONT-05, CONT-06, CONT-07, CONT-08, CONT-09, LIST-03, LIST-04]

# Metrics
duration: ~4min
completed: 2026-04-13
---

# Phase 01 Plan 04: All Contacts Tab — Table, Filters, and Drawer Summary

**ContactsFilters (debounced search/status/tag/custom-field bar), ContactsTable (paginated with status badges and row-click), and ContactDrawer (fixed slide-in with edit/delete/list-membership) wired into ContactsPage — delivering the complete All Contacts tab (CONT-05 through CONT-09, LIST-03, LIST-04)**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-13T04:35:15Z
- **Completed:** 2026-04-13T04:39:00Z
- **Tasks:** 2 of 2 complete
- **Files modified:** 4

## Accomplishments

- Created `ContactsFilters` with Search (w-64, Search icon), Status native select (styled bg-gray-800), Tag input (w-40), custom field key+value inputs (w-32 each), and "Clear filters" ghost button visible only when any filter is active. All text inputs debounced 300ms via useEffect/setTimeout/cleanup.
- Created `ContactsTable` with full table structure (Name, Email, Status badge, Tags pills max-3+N-more, Added relative date), loading spinner centered in Card, empty state ("No contacts yet"), empty-search state ("No contacts found"), and Previous/Next pagination shown only when totalPages > 1.
- Created `ContactDrawer` with `fixed right-0 top-0 h-full w-96 bg-gray-900 border-l border-gray-800 z-50` panel and `fixed inset-0 bg-black/40 z-40` backdrop. Supports view mode, edit mode (inline Input fields), new-contact mode (isNew prop), soft delete with inline confirmation, and list membership add/remove with Supabase `contact_list_members` queries.
- Updated `ContactsPage` to replace the `contacts-table-slot` placeholder with fully wired `ContactsFilters` + `ContactsTable` + `ContactDrawer`. State: `filters`, `page`, `selectedContact`, `showNewContact`. Add Contact button opens drawer in new mode; row click opens edit mode; `?list=<id>` passes `listId` to `useContacts`; breadcrumb strip shows active list name.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ContactsFilters and ContactsTable components** — `8944585` (feat)
2. **Task 2: Create ContactDrawer and wire All Contacts tab into ContactsPage** — `812920e` (feat)

## Files Created/Modified

- `src/components/contacts/ContactsFilters.tsx` — Search + status/tag/custom-field filter bar with 300ms debounce
- `src/components/contacts/ContactsTable.tsx` — Paginated contacts table with status badges, tag pills, row click, empty states
- `src/components/contacts/ContactDrawer.tsx` — Fixed slide-in drawer: view/edit/delete contact, list membership, new-contact mode
- `src/pages/contacts/ContactsPage.tsx` — Fully wired All Contacts tab replacing contacts-table-slot placeholder

## Decisions Made

- **useToast from Toast.tsx, not a hook file:** The project exports `useToast` from `src/components/ui/Toast.tsx` (not a separate `hooks/useToast.ts`). Fixed import path automatically at TypeScript compile time (Rule 3 deviation — blocking import error).
- **Single ContactDrawer component with isNew prop:** Rather than a separate NewContactDrawer, the `isNew` prop drives new-contact vs edit-contact behavior within the same component. Reduces duplication and keeps layout consistent.
- **effectiveFilters merge in ContactsPage:** Page state and listId are merged into filters at call time (`{ ...filters, page, pageSize: 50, listId }`) so `useContacts` receives a single clean filter object. Page resets to 1 on filter change.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed useToast import path**
- **Found during:** Task 2 TypeScript compilation
- **Issue:** Plan specified `import { useToast } from '../../hooks/useToast'` but the project exports `useToast` from `src/components/ui/Toast.tsx`
- **Fix:** Changed import to `import { useToast } from '../ui/Toast'`
- **Files modified:** `src/components/contacts/ContactDrawer.tsx`
- **Commit:** `812920e` (fixed before commit)

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| `onClick={() => {}}` on "View import history" button | `src/pages/contacts/ContactsPage.tsx` | ~99 | Intentional — Plan 05 (ImportHistoryModal) will wire this |
| `onClick={() => {}}` on "Import Contacts" button | `src/pages/contacts/ContactsPage.tsx` | ~105 | Intentional — Plan 05 (ImportWizardModal) will wire this |

These stubs do not block the plan's goal (All Contacts tab fully functional). Both are unchanged from Plan 03's stubs — Plan 04 scope does not include the import wizard or history modal.

## Threat Model Coverage

| Threat ID | Mitigation | Status |
|-----------|-----------|--------|
| T-04-01 | All update/delete queries include `.eq('workspace_id', profile.workspace_id)` | Applied in ContactDrawer handleSave and handleDelete |
| T-04-02 | Search input trimmed before `.or()` interpolation (inherited from useContacts hook) | Applied in useContacts (Plan 02) |
| T-04-03 | contact_list_members queries fetch through contact_lists join; RLS enforces workspace ownership | Queries scoped by contact_id with RLS join policy |
| T-04-04 | Soft delete uses `.update({ deleted_at })` with `.eq('workspace_id')` — no hard DELETE | Applied in ContactDrawer handleDelete |
| T-04-05 | 300ms debounce on all text inputs in ContactsFilters | Applied in ContactsFilters via useEffect/setTimeout |

## Self-Check: PASSED

- [x] `src/components/contacts/ContactsFilters.tsx` exists with "Search contacts...", "All statuses", "Filter by tag...", "Field name", "Field value", "Clear filters", setTimeout
- [x] `src/components/contacts/ContactsTable.tsx` exists with "No contacts yet", "No contacts found", "Page", hover:bg-gray-800/50, onContactClick, Badge
- [x] `src/components/contacts/ContactDrawer.tsx` exists with "fixed right-0 top-0", "fixed inset-0 bg-black/40 z-40", "w-96 bg-gray-900 border-l border-gray-800 z-50", "Delete Contact", "Yes, delete contact", "Keep contact", "Save changes", "Discard changes", "Contact added.", "contact_list_members", "deleted_at: new Date().toISOString()", `aria-label="Close"`
- [x] `src/pages/contacts/ContactsPage.tsx` contains useContacts, ContactsFilters, ContactsTable, ContactDrawer
- [x] Commit 8944585 exists (Task 1)
- [x] Commit 812920e exists (Task 2)
- [x] TypeScript: PASS (zero errors)

---
*Phase: 01-contact-lists*
*Completed: 2026-04-13*
