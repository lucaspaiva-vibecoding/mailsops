---
phase: 01-contact-lists
plan: 02
subsystem: contacts/data-layer
tags: [typescript, supabase, hooks, contacts, contact-lists]
dependency_graph:
  requires: [01-01]
  provides: [Contact type, ContactList type, ContactListMember type, ContactImportLog type, useContacts hook, useContactLists hook]
  affects: [01-03, 01-04, 01-05]
tech_stack:
  added: []
  patterns: [supabase-js-filter-chaining, useCallback-fetchcontacts, soft-delete-filtering, workspace-id-scoping]
key_files:
  created:
    - src/hooks/contacts/useContacts.ts
    - src/hooks/contacts/useContactLists.ts
  modified:
    - src/types/database.ts
decisions:
  - ContactUpdate omits workspace_id (immutable field) in addition to id/timestamps/deleted_at
  - Database interface extended with all four new table Row/Insert/Update types
  - contact_import_logs table has Update: never (import logs are append-only)
metrics:
  duration: 3m
  completed: 2026-04-13T04:17:49Z
  tasks_completed: 2
  files_created: 2
  files_modified: 1
---

# Phase 01 Plan 02: Types and Data Hooks Summary

**One-liner:** Four TypeScript interfaces (Contact, ContactList, ContactListMember, ContactImportLog) and two Supabase data hooks (useContacts with multi-filter pagination, useContactLists with full CRUD) establishing the complete data layer for Phase 01.

## What Was Built

### Task 1: Extended database.ts with contact type interfaces

Added four new interfaces after `Profile` and before the updated `Database` interface in `src/types/database.ts`:

- `Contact` — matches `contacts` table exactly: email, first_name, last_name, company, tags (string[]), custom_fields (Record<string,string>), status union, bounce fields, soft-delete
- `ContactList` — matches `contact_lists` table: name, description, color, contact_count (denormalized), soft-delete
- `ContactListMember` — join table: contact_list_id, contact_id, added_at (no workspace_id, no deleted_at)
- `ContactImportLog` — log table: total_rows, imported, updated, skipped, errors, error_details (typed array)

Added two utility types:
- `ContactInsert` — omits id, created_at, updated_at, deleted_at (server-generated fields)
- `ContactUpdate` — partial of ContactInsert fields, also omits workspace_id (immutable)

Updated `Database` interface with Row/Insert/Update types for all four new tables.

### Task 2: Created useContacts and useContactLists hooks

**`src/hooks/contacts/useContacts.ts`**
- Exports `ContactFilters` interface with: search, status, tag, customFieldKey, customFieldValue, listId, page, pageSize
- Returns `{ contacts, loading, error, refetch, totalCount }`
- Implements all threat model mitigations:
  - T-02-01: search input trimmed before interpolation into `.or()` PostgREST filter
  - T-02-02: every query chains `.eq('workspace_id', profile.workspace_id)`
  - T-02-03: every SELECT includes `.is('deleted_at', null)`
- List filtering uses two-step approach (fetch contact_list_members IDs, then `.in('id', ...)`) — avoids RLS join complexity
- Pagination via `.range(from, to)` with configurable pageSize (default 50)

**`src/hooks/contacts/useContactLists.ts`**
- Returns `{ lists, loading, error, refetch, createList, updateList, deleteList }`
- All queries scoped to `profile.workspace_id` with soft-delete filter
- `deleteList` uses soft delete: `{ deleted_at: new Date().toISOString() }` — never hard deletes
- `updateList` sends `updated_at` timestamp on every update

## Deviations from Plan

None — plan executed exactly as written.

## Threat Model Coverage

| Threat ID | Mitigation | Status |
|-----------|-----------|--------|
| T-02-01 | Trim search input before `.or()` interpolation | Applied in useContacts |
| T-02-02 | Every query chains `.eq('workspace_id', profile.workspace_id)` | Applied in both hooks |
| T-02-03 | Every SELECT includes `.is('deleted_at', null)` | Applied in both hooks |

## Known Stubs

None. These are data-layer hooks — no UI rendering, no placeholder values.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 79793d8 | feat(01-02): extend database.ts with contact type interfaces |
| Task 2 | ffb1ec8 | feat(01-02): create useContacts and useContactLists data hooks |

## Self-Check: PASSED

- [x] src/types/database.ts exists and contains all 4 interfaces + 2 utility types
- [x] src/hooks/contacts/useContacts.ts exists with ContactFilters interface and all filter support
- [x] src/hooks/contacts/useContactLists.ts exists with createList, updateList, deleteList
- [x] Commit 79793d8 exists (Task 1)
- [x] Commit ffb1ec8 exists (Task 2)
- [x] TypeScript compilation: zero errors
