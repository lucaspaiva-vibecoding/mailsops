---
phase: 06-sequences
plan: 02
subsystem: sequences
tags: [ui, builder, tiptap, sequences, forms]
dependency_graph:
  requires:
    - 06-01 (sequences data foundation — hooks, types, routes)
  provides:
    - StepEditorPanel component (per-step TipTap editor with delay + subject + variable insertion)
    - StartSequenceModal component (enrollment confirmation)
    - SequenceBuilderPage (create/edit modes with shared settings + dynamic step list)
  affects:
    - src/pages/sequences/SequenceBuilderPage.tsx
    - src/components/sequences/StepEditorPanel.tsx
    - src/components/sequences/StartSequenceModal.tsx
tech_stack:
  added: []
  patterns:
    - StepEditorPanel owns its own useEditor instance (solves hooks-in-loops problem)
    - stable localId (crypto.randomUUID) as React key for step list (prevents TipTap remount on reorder)
    - populated guard prevents form re-population when hooks refetch after mutations
    - Create mode: supabase direct insert for steps (no hook needed since no id yet)
    - Edit mode: updateSequence + saveSteps (delete-all + bulk insert pattern from Plan 01)
    - delayErrors computed as Map<localId, string> from steps array each render
key_files:
  created:
    - src/components/sequences/StepEditorPanel.tsx
    - src/components/sequences/StartSequenceModal.tsx
  modified:
    - src/pages/sequences/SequenceBuilderPage.tsx
decisions:
  - StepEditorPanel owns its own useEditor instance — each component in the steps array mounts independently, solving the hooks-in-loops problem from Research Pitfall 5
  - Create mode step insert uses supabase directly rather than useSequence hook — the hook requires an id, which doesn't exist until after createSequence resolves
  - delayErrors computed as Map<localId, string> inline each render — simpler than useState, always in sync with steps array
  - Read-only guard renders yellow notice and disables all inputs for non-draft sequences
metrics:
  duration: 2min
  completed: 2026-04-14
  tasks_completed: 2
  files_changed: 3
---

# Phase 6 Plan 2: Sequence Builder UI Summary

Full sequence builder page (create and edit modes) with TipTap per-step editors, shared settings card, delay validation, save draft flow, and Start Sequence confirmation modal.

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | StepEditorPanel + StartSequenceModal components | b9c4982 | StepEditorPanel.tsx, StartSequenceModal.tsx |
| 2 | SequenceBuilderPage — full builder with shared settings, steps, save/start flow | d464854 | SequenceBuilderPage.tsx |

## What Was Built

**StepEditorPanel (`src/components/sequences/StepEditorPanel.tsx`):**
- Each panel owns its own TipTap `useEditor` instance (Placeholder + StarterKit + Link + Image + VariableChipNode + VariableSlashCommand)
- Delay input row with "Send on day" label + number input + "(days after enrollment)" suffix + inline `role="alert"` error
- Subject input with `{{ }}` variable insertion dropdown (appends `{{variable}}` at cursor or end of subject)
- `CampaignEditorToolbar` reused for TipTap formatting (bold, italic, headings, lists, link, image, variable)
- Step header: numbered badge + "Step N" label + ChevronUp/ChevronDown/X buttons with proper aria-labels
- Up button hidden on first step; Down button hidden on last step; Remove hidden if only 1 step

**StartSequenceModal (`src/components/sequences/StartSequenceModal.tsx`):**
- Fixed overlay modal with "Start this sequence?" heading
- Body shows enrollment count and list name dynamically
- Keep Editing (secondary) and Start Sequence (primary, loading state) actions

**SequenceBuilderPage (`src/pages/sequences/SequenceBuilderPage.tsx`):**
- Create mode (`/sequences/new`): initializes with one empty step, calls `createSequence` then inserts steps via supabase directly
- Edit mode (`/sequences/:id/edit`): populates from `useSequence` hook with `populated` guard
- Shared settings card: From name, From email, Reply-to (optional), Target list select
- Step list: `steps.map` with `key={step.localId}` (stable UUID, never index)
- Step operations: `addStep` (defaults delay to last+1), `removeStep`, `moveStep` (up/down array swap), `updateStep`
- Delay validation: `delayErrors` Map computed each render, passed as `delayError` prop to each StepEditorPanel
- Save draft: always available, no validation — saves silently with success toast
- Start flow: validates (steps, subjects, list, delay errors), fetches active contact count, opens StartSequenceModal
- On start confirm: saves first, then calls `startSequence(id, listId, step0Delay)`, navigates to `/sequences/:id/results`
- Read-only guard: yellow notice + disabled inputs for active/paused/archived sequences
- Loading spinner for edit mode while sequence loads

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all plan goals achieved.

## Threat Surface Scan

No new network endpoints or auth paths introduced. The client-side enrollment count fetch (contact_list_members query) follows the same RLS-protected pattern as useSequences.startSequence. T-6-06 mitigation (RLS on sequence_enrollments) is enforced at the DB level by the migration from Plan 01.

## Self-Check: PASSED

- src/components/sequences/StepEditorPanel.tsx: FOUND
- src/components/sequences/StartSequenceModal.tsx: FOUND
- src/pages/sequences/SequenceBuilderPage.tsx: FOUND (422 lines, full implementation)
- StepEditorPanel contains "export function StepEditorPanel": FOUND
- StepEditorPanel contains "useEditor(": FOUND
- StepEditorPanel contains "CampaignEditorToolbar": FOUND
- StepEditorPanel contains "VariableChipNode": FOUND
- StepEditorPanel contains "VariableSlashCommand": FOUND
- StepEditorPanel contains 'aria-label="Move step up"': FOUND
- StepEditorPanel contains 'aria-label="Move step down"': FOUND
- StepEditorPanel contains "Send on day": FOUND
- StepEditorPanel contains 'role="alert"': FOUND
- StartSequenceModal contains "export function StartSequenceModal": FOUND
- StartSequenceModal contains "Start this sequence?": FOUND
- StartSequenceModal contains "Keep Editing": FOUND
- StartSequenceModal contains "Start Sequence": FOUND
- SequenceBuilderPage contains "export function SequenceBuilderPage": FOUND
- SequenceBuilderPage contains "useSequences()": FOUND
- SequenceBuilderPage contains "useSequence(": FOUND
- SequenceBuilderPage contains "useContactLists()": FOUND
- SequenceBuilderPage contains "StepEditorPanel": FOUND
- SequenceBuilderPage contains "StartSequenceModal": FOUND
- SequenceBuilderPage contains "key={step.localId}": FOUND
- SequenceBuilderPage contains "Save draft": FOUND
- SequenceBuilderPage contains "Start Sequence": FOUND
- SequenceBuilderPage contains "Sequence Settings": FOUND
- SequenceBuilderPage contains "Add Step": FOUND
- SequenceBuilderPage contains "crypto.randomUUID()": FOUND
- SequenceBuilderPage contains "delayErrors": FOUND
- commit b9c4982: FOUND
- commit d464854: FOUND
- npm run build: exits 0
