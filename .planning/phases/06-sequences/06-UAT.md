---
status: complete
phase: 06-sequences
source: [06-01-SUMMARY.md, 06-02-SUMMARY.md, 06-03-SUMMARY.md, 06-04-SUMMARY.md]
started: 2026-04-14T14:10:00.000Z
updated: 2026-04-14T14:20:00.000Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 12
name: Automatic step sending (Edge Function)
expected: |
  All tests complete.
awaiting: done

## Tests

### 1. Sequences sidebar navigation
expected: In the left sidebar, "Sequences" appears between "Campaigns" and "Templates" with a workflow/chain icon. Clicking it navigates to /sequences.
result: pass

### 2. Sequences list empty state
expected: On the /sequences page with no sequences created yet, you see an empty state (no broken layout, no errors). A button or link lets you create your first sequence.
result: pass

### 3. Create new sequence — settings card
expected: At /sequences/new, there is a settings card with fields for: Sequence name, From name, From email, Reply-to (optional), and a Target list dropdown populated with your contact lists.
result: pass

### 4. Step editor — delay, subject, body
expected: The sequence builder has at least one step card. Each step has: a "Send on day" number input, a Subject field with a {{ }} button for variable insertion, and a TipTap rich-text body editor with a formatting toolbar.
result: pass

### 5. Add, reorder, and remove steps
expected: Clicking "Add Step" appends a new step. Steps have up/down arrow buttons to reorder (top step has no up arrow, bottom step has no down arrow). If there are 2+ steps, each has a remove button. If only 1 step, remove is hidden.
result: pass

### 6. Delay validation
expected: If two steps have the same delay days (or a later step has a lower delay than an earlier step), an inline error appears on the offending step. The Start Sequence button is blocked until delays are strictly increasing.
result: pass

### 7. Save draft
expected: Clicking "Save draft" saves the sequence and its steps to the database without validation errors. A success toast appears. Navigating away and back to /sequences/:id/edit shows the saved state.
result: pass

### 8. Start Sequence modal
expected: Clicking "Start Sequence" (with valid settings, steps, and a target list selected) shows a confirmation modal. The modal displays the number of active contacts in the selected list and the list name. Confirming navigates to the sequence results page.
result: pass

### 9. Sequences list with data
expected: After creating and starting a sequence, the /sequences list shows it with: its name, a colored status badge (e.g. "active" in green), the target list name, step count, and enrollment count.
result: pass

### 10. Status-aware actions dropdown
expected: In the sequences list, the actions dropdown for an active sequence shows: "View Results", "Pause", and "Archive". A draft sequence shows "Edit" and "Delete". A paused sequence shows "View Results", "Resume", and "Archive".
result: pass

### 11. Sequence results page
expected: At /sequences/:id/results, you can see the total enrollment count, and per-step stat cards (one card per step) showing at minimum the step number/subject. Active/paused sequences show Pause/Resume buttons. Steps not yet sent show an empty state ("Step not sent yet" or similar).
result: pass

### 12. Automatic step sending (Edge Function)
expected: After deploying send-sequence-step and setting SEQUENCE_CRON_SECRET, manually invoking the function (curl or Supabase Dashboard → Edge Functions → Invoke) with the correct secret sends pending step emails and advances enrollment current_step.
result: pass

## Summary

total: 12
passed: 12
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
