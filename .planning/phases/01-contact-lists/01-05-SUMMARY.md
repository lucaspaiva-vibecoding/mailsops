---
phase: 01-contact-lists
plan: 05
subsystem: ui/contacts/import
tags: [react, typescript, papaparse, csv-import, supabase, tailwind, wizard, modal]

# Dependency graph
requires:
  - phase: 01-01
    provides: contact_import_logs table, papaparse installed
  - phase: 01-02
    provides: ContactInsert type, ContactImportLog type, useContacts hook
  - phase: 01-03
    provides: ContactsPage shell
  - phase: 01-04
    provides: ContactsPage with All Contacts tab wired
provides:
  - "ImportWizardModal — 4-step CSV import wizard with PapaParse, column mapping, duplicate handling, preview, batch import"
  - "ImportHistoryModal — modal showing past contact_import_logs with expandable error details"
  - "ContactsPage (updated) — Import Contacts and View import history buttons fully wired"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Application-level duplicate detection: fetch existingMap then route rows to insert/update/skip — never use onConflict with partial functional index"
    - "PapaParse header extraction: Papa.parse(file, { skipEmptyLines: true }) then const [headers, ...rows] = results.data"
    - "500-row CHUNK_SIZE batch insert pattern to avoid single-request overload for large CSVs"
    - "Auto-detect CSV column mappings by normalizing header names to lowercase and matching against field aliases"
    - "Step wizard state via useState<1|2|3|4>(1) — simple numeric step counter"
    - "Fetch-on-open pattern in ImportHistoryModal: useEffect triggers only when open === true"

key-files:
  created:
    - src/components/contacts/ImportWizardModal.tsx
    - src/components/contacts/ImportHistoryModal.tsx
  modified:
    - src/pages/contacts/ContactsPage.tsx

key-decisions:
  - "Application-level duplicate check using existingMap (not onConflict upsert) — partial functional index on contacts prevents PostgREST ON CONFLICT from targeting it"
  - "Import wizard resets all state on close/handleClose — prevents stale data if user reopens the modal"
  - "ImportHistoryModal uses fetch-on-open (useEffect with open as dependency) — avoids unnecessary DB queries when modal is closed"
  - "Unused useToast removed from ImportHistoryModal — history modal has no toast requirements"

patterns-established:
  - "Application-level duplicate detection pattern for partial functional index tables"
  - "Batch insert in CHUNK_SIZE=500 rows — prevents request overload for large CSV files"
  - "Papa.parse with skipEmptyLines + header row destructuring for wizard-controlled column mapping"

requirements-completed: [CONT-01, CONT-02, CONT-03, CONT-04]

# Metrics
duration: ~6min
completed: 2026-04-13
---

# Phase 01 Plan 05: CSV Import Wizard and Import History Summary

**Multi-step ImportWizardModal (PapaParse CSV upload, column mapping, duplicate detection, 500-row batch insert, import logging) and ImportHistoryModal (past imports with expandable error details) delivering CONT-01 through CONT-04 — with ContactsPage Import Contacts and View import history buttons fully wired**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-13T04:42:00Z
- **Completed:** 2026-04-13T04:48:00Z
- **Tasks:** 3 of 3 complete (including checkpoint:human-verify — user approved)
- **Files modified:** 3

## Accomplishments

- Created `ImportWizardModal` (724 lines) with full 4-step wizard: (1) file upload zone with drag-and-drop, (2) column mapping with auto-detection and required email validation, duplicate strategy radio (skip/update), and tags input, (3) preview of first 5 CSV rows with live duplicate count from Supabase, (4) confirm with progress bar, success/error states, and toast notifications.
- Import logic uses application-level duplicate detection via `existingMap` (fetches all existing workspace emails, builds Map, routes each row to insert/update/skip). Batch inserts in `CHUNK_SIZE = 500` chunks. Logs results to `contact_import_logs` table. Never uses `onConflict` (prevents partial functional index error — RESEARCH.md Pitfall 1).
- Created `ImportHistoryModal` with fetch-on-open pattern, relative date formatting, expandable error detail rows (ChevronDown/Up toggle), empty state with Upload icon, and loading spinner. Reads from `contact_import_logs` table ordered by date descending.
- Updated `ContactsPage` to import and render both modals, added `showImportWizard` and `showImportHistory` state, wired both header buttons. `onImportComplete` calls `refetchContacts()` then closes wizard.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ImportWizardModal with 4-step CSV import flow** — `ba43e8d` (feat)
2. **Task 2: Create ImportHistoryModal and wire import buttons into ContactsPage** — `39ebd79` (feat)
3. **Task 3: Verify complete contacts page functionality** — APPROVED by user (checkpoint:human-verify passed)

## Files Created/Modified

- `src/components/contacts/ImportWizardModal.tsx` — 4-step CSV import wizard: PapaParse parsing, column mapping, duplicate handling, batch insert, import log
- `src/components/contacts/ImportHistoryModal.tsx` — Past import records modal with expandable error details
- `src/pages/contacts/ContactsPage.tsx` — Added showImportWizard/showImportHistory state; wired Import Contacts and View import history buttons

## Decisions Made

- **Application-level duplicate detection over onConflict:** The `contacts` table has a partial functional index (`lower(email) WHERE deleted_at IS NULL`) which cannot be targeted by PostgREST `ON CONFLICT`. Using `existingMap` fetch-then-route approach avoids the `42P10` error and correctly handles case-insensitive email matching.
- **handleClose resets all step state:** Prevents stale CSV data, column mappings, and import results if the user closes and reopens the wizard without a page reload.
- **fetch-on-open in ImportHistoryModal:** `useEffect` with `open` as dependency only queries Supabase when the modal becomes visible — avoids silent background queries while the modal is closed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused useToast import from ImportHistoryModal**
- **Found during:** Task 2 cleanup pass
- **Issue:** Initial write included `useToast` import which was unused in ImportHistoryModal (history modal has no toast requirements per plan spec)
- **Fix:** Removed the import before committing
- **Files modified:** `src/components/contacts/ImportHistoryModal.tsx`
- **Commit:** `39ebd79` (fixed before commit)

## Known Stubs

None — all import-related buttons in ContactsPage are now fully wired.

## Threat Model Coverage

| Threat ID | Mitigation | Status |
|-----------|-----------|--------|
| T-05-01 | CSV cell values treated as strings only; no formula execution; file type restricted to .csv via accept attribute | Applied in ImportWizardModal file input and Papa.parse |
| T-05-02 | Duplicate check uses existingEmails fetched with workspace_id scope; cannot affect other workspaces | Applied in handleNextToPreview and executeImport |
| T-05-03 | workspace_id set from profile.workspace_id (auth context), NOT from CSV content | Applied in executeImport contactData construction |
| T-05-04 | Batch inserts in 500-row CHUNK_SIZE chunks; progress bar provides feedback | Applied in executeImport batch loop |
| T-05-05 | contact_import_logs RLS restricts SELECT/INSERT to workspace owner | Enforced by DB migration 001_contact_import_logs.sql (Plan 01) |

## Self-Check: PASSED

- [x] `src/components/contacts/ImportWizardModal.tsx` exists and contains: `import Papa from 'papaparse'`, `Papa.parse`, `skipEmptyLines: true`, `const [headers, ...rows] = results.data`, `email.toLowerCase()`, `existingMap`, `CHUNK_SIZE`, `contact_import_logs`, `Skip duplicate emails`, `Update existing contacts`, `Email is required and must map to a column`, `Start Import`, step labels Upload/Map Columns/Preview/Confirm
- [x] `src/components/contacts/ImportWizardModal.tsx` does NOT contain `onConflict`
- [x] `src/components/contacts/ImportHistoryModal.tsx` exists and contains: `contact_import_logs`, `No imports yet`, `Your past CSV imports will appear here`, `Import History`, `error_details`, `aria-label="Close"`
- [x] `src/pages/contacts/ContactsPage.tsx` contains: `ImportWizardModal`, `ImportHistoryModal`, `showImportWizard`, `showImportHistory`
- [x] Commit `ba43e8d` exists (Task 1)
- [x] Commit `39ebd79` exists (Task 2)
- [x] TypeScript: PASS (zero errors)

---
*Phase: 01-contact-lists*
*Completed: 2026-04-13*
