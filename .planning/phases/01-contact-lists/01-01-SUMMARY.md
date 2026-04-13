---
phase: 01-contact-lists
plan: 01
subsystem: database
tags: [supabase, postgresql, rls, migrations, papaparse, csv]

# Dependency graph
requires: []
provides:
  - "contact_import_logs table with RLS policies (SELECT, INSERT scoped to workspace)"
  - "contact_count PostgreSQL trigger on contact_list_members (INSERT/DELETE)"
  - "contact_list_members RLS policies (SELECT, INSERT, DELETE) scoped through contact_lists.workspace_id"
  - "papaparse 5.5.3 installed as project dependency"
affects: [01-02, 01-03, 01-04, 01-05]

# Tech tracking
tech-stack:
  added:
    - "papaparse 5.5.3 — browser CSV parsing for import wizard"
    - "@types/papaparse 5.5.2 — TypeScript types for papaparse"
  patterns:
    - "RLS join-through pattern: contact_list_members policies join through contact_lists.workspace_id since the table has no workspace_id column"
    - "PostgreSQL AFTER trigger with GREATEST(count - 1, 0) guard for denormalized counter maintenance"

key-files:
  created:
    - "supabase/migrations/001_contact_import_logs.sql"
    - "supabase/migrations/002_contact_list_count_trigger.sql"
    - "supabase/migrations/003_contact_list_members_rls.sql"
  modified:
    - "package.json — added papaparse and @types/papaparse"

key-decisions:
  - "Three separate migration files (not one combined) for atomic rollback capability and clear audit trail"
  - "No UPDATE policy on contact_list_members: pure join table with no mutable fields, add/remove only"
  - "GREATEST(contact_count - 1, 0) guard in trigger prevents negative counts from edge-case race conditions"

patterns-established:
  - "RLS join-through: when a table lacks workspace_id, use subquery IN (SELECT id FROM parent_table WHERE workspace_id = ...)"
  - "Denormalized counter trigger: AFTER INSERT/DELETE on join table, UPDATE parent SET count = count +/- 1"

requirements-completed: []  # Pending Task 2 (human-action): migrations must be applied to Supabase before requirements are live

# Metrics
duration: ~5min
completed: 2026-04-13
---

# Phase 01 Plan 01: DB Migrations + PapaParse Setup Summary

**Three SQL migration files and papaparse dependency establishing the data foundation for CSV import (contact_import_logs), accurate list counts (trigger), and functional list membership queries (contact_list_members RLS)**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-13T04:11:27Z
- **Completed:** 2026-04-13T04:16:00Z
- **Tasks:** 1 of 2 complete (Task 2 awaiting human action)
- **Files modified:** 5

## Accomplishments

- Created `supabase/migrations/001_contact_import_logs.sql`: new table for import history (CONT-04) with workspace-scoped RLS SELECT and INSERT policies
- Created `supabase/migrations/002_contact_list_count_trigger.sql`: PostgreSQL trigger function that atomically maintains `contact_count` on `contact_lists` on every insert/delete to `contact_list_members`
- Created `supabase/migrations/003_contact_list_members_rls.sql`: SELECT, INSERT, and DELETE RLS policies on `contact_list_members` scoped through the `contact_lists.workspace_id` join (fixing the silent empty-result bug)
- Installed `papaparse` 5.5.3 and `@types/papaparse` 5.5.2 for browser-side CSV parsing

## Task Commits

Each task was committed atomically:

1. **Task 1: Create migration SQL files and install papaparse** - `2cdd906` (feat)
2. **Task 2: Apply migrations to Supabase** - PENDING (human-action checkpoint)

## Files Created/Modified

- `supabase/migrations/001_contact_import_logs.sql` — DDL for contact_import_logs with index and RLS policies
- `supabase/migrations/002_contact_list_count_trigger.sql` — Trigger function and AFTER INSERT/DELETE triggers on contact_list_members
- `supabase/migrations/003_contact_list_members_rls.sql` — Three RLS policies for contact_list_members (SELECT, INSERT, DELETE)
- `package.json` — Added papaparse (runtime) and @types/papaparse (dev)
- `package-lock.json` — Updated lockfile

## Decisions Made

- **Three separate files over one combined migration:** Each file handles one concern (table, trigger, RLS) for clearer audit trail and isolated rollback if one migration needs to be re-run.
- **No UPDATE policy on contact_list_members:** The table is a pure join table (`id`, `contact_list_id`, `contact_id`, `added_at`). There is no use case for updating a row in place — contacts are added or removed.
- **GREATEST() guard on trigger:** `GREATEST(contact_count - 1, 0)` prevents negative counts if a DELETE fires on a list where the count is already 0 (edge case during data migrations or manual admin operations).

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. All three migration files were created per specification. Grep verification of multi-line SQL patterns required using partial pattern matching (the acceptance criteria check `workspace_id = (SELECT workspace_id FROM public.profiles WHERE id = auth.uid())` spans two lines in the file — verified with partial pattern `workspace_id FROM public.profiles WHERE id = auth.uid` which matched 3 times as expected).

## User Setup Required

**Migrations must be applied manually to Supabase.** Task 2 is a `checkpoint:human-action` requiring the user to run the three SQL files in the Supabase Dashboard SQL Editor:

1. Open Supabase Dashboard > SQL Editor
2. Paste and run `supabase/migrations/001_contact_import_logs.sql`
3. Paste and run `supabase/migrations/002_contact_list_count_trigger.sql`
4. Paste and run `supabase/migrations/003_contact_list_members_rls.sql`
5. Verify in Table Editor: `contact_import_logs` table exists
6. Verify in Database > Functions: `update_contact_list_count` function exists
7. Verify in Authentication > Policies: `contact_list_members` has 3 policies (SELECT, INSERT, DELETE)

Type `"migrations applied"` to resume execution after all three files have been run successfully.

## Next Phase Readiness

- Migration files are ready to apply — papaparse is installed and importable
- Once Task 2 (human action) is complete, all requirements CONT-04, LIST-03, LIST-04, LIST-05 will be unblocked
- Plan 01-02 (TypeScript types and data hooks) can proceed immediately after migrations are applied

---
*Phase: 01-contact-lists*
*Completed: 2026-04-13 (Task 2 pending human action)*
