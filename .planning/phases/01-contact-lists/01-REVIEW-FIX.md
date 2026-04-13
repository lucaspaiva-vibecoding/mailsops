---
phase: 01-contact-lists
fixed_at: 2026-04-13T00:00:00Z
review_path: .planning/phases/01-contact-lists/01-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-04-13T00:00:00Z
**Source review:** .planning/phases/01-contact-lists/01-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8
- Fixed: 8
- Skipped: 0

## Fixed Issues

### CR-01: Import log records incorrect `imported` count when batch errors occur

**Files modified:** `src/components/contacts/ImportWizardModal.tsx`
**Commit:** 54de0e7
**Applied fix:** Introduced `insertedCount` and `updatedCount` tracking variables initialised to 0. In the batch insert loop, incremented `insertedCount += chunk.length` on success. In the update loop, incremented `updatedCount++` on success. Replaced the algebraically incorrect `toInsert.length - Math.max(0, errors - toUpdate.length)` formula in the log insert with `insertedCount`, and replaced `toInsert.length` in `setImportResult` with `insertedCount`. Both the database log and the UI result now reflect actual successful operations.

---

### CR-02: Fragile FK reference to non-PK column `profiles.workspace_id`

**Files modified:** `supabase/migrations/001_contact_import_logs.sql`
**Commit:** 5022991
**Applied fix:** Removed the `REFERENCES public.profiles(workspace_id)` foreign key constraint from the `workspace_id` column declaration, leaving it as `UUID NOT NULL`. Workspace isolation is already correctly enforced by the two existing RLS policies (lines 20-26) which resolve workspace membership via a subquery on `profiles`. This matches the pattern used by the other migrations and eliminates the risk of a rejected migration due to a missing UNIQUE constraint on `profiles.workspace_id`.

---

### WR-01: `fetchMemberships` silently swallows Supabase errors

**Files modified:** `src/components/contacts/ContactDrawer.tsx`
**Commit:** 43f4634
**Applied fix:** Destructured `error` alongside `data` from the Supabase response. Added an `if (error)` guard that calls `showToast('Failed to load list memberships.', 'error')` before falling through to set memberships to an empty array, so users see actionable feedback instead of a silent empty state.

---

### WR-02: File input does not validate file type; only drag-and-drop validates

**Files modified:** `src/components/contacts/ImportWizardModal.tsx`
**Commit:** b8fcf26
**Applied fix:** Added an extension check at the top of `handleFileSelect` that mirrors the existing check in `handleDrop`: if the selected file name does not end with `.csv`, `setParseError('Please upload a .csv file only.')` is called and the function returns early before any parsing occurs.

---

### WR-03: Stale closure in debounce `useEffect` hooks can produce inconsistent filter state

**Files modified:** `src/components/contacts/ContactsFilters.tsx`
**Commit:** 9b49729
**Applied fix:** Replaced the three independent debounce `useEffect` hooks (one each for `search`, `tag`, and `customFieldKey`/`customFieldValue`) with a single unified effect. The single effect fires when any of the four local state values change, emitting one merged `onFiltersChange` call with all four fields set simultaneously. This eliminates the race condition where two timers could fire close together with stale snapshots of `filters` and overwrite each other's changes.

---

### WR-04: Duplicate column-to-field mappings handled silently

**Files modified:** `src/components/contacts/ImportWizardModal.tsx`
**Commit:** 0cfb5c2
**Applied fix:** Added a duplicate-mapping check at the top of `handleNextToPreview`, immediately after the email-mapped check. It filters out `'skip'` mappings, compares the resulting array length to the size of a Set built from the same array, and calls `setEmailMappingError(true)` and returns if duplicates are found. This blocks progression to Step 3 when the same non-skip field is mapped to more than one CSV column.

---

### WR-05: `executeImport` uses non-null assertion on `profile` without guard

**Files modified:** `src/components/contacts/ImportWizardModal.tsx`
**Commit:** c8d7269
**Applied fix:** Added a `if (!profile?.workspace_id)` guard at the start of `executeImport` that calls `showToast('Session expired. Please sign in again.', 'error')` and returns early. The non-null assertion `profile!.workspace_id` on the next line was replaced with `profile.workspace_id` (safe after the guard). This prevents an uncaught `TypeError` if the profile becomes null during a long import due to session expiry.

---

### WR-06: Large list filter loads all contact IDs into client memory, then uses `.in()` without pagination cap

**Files modified:** `src/hooks/contacts/useContacts.ts`
**Commit:** bbf8c56
**Applied fix:** Added `.limit(10000)` to the `contact_list_members` member fetch query, capping the number of IDs loaded into browser memory and sent as a `.in()` query parameter. Added a comment documenting the constraint and a TODO to replace the client-side join with a server-side subquery filter when available. This is the minimum safe fix; a full server-side join should be implemented when the list size can exceed 10,000 contacts.

---

_Fixed: 2026-04-13T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
