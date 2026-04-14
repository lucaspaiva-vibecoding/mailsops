---
phase: 06-sequences
plan: 01
subsystem: sequences
tags: [database, types, hooks, routing, navigation]
dependency_graph:
  requires: []
  provides:
    - sequences DB schema (4 tables + RLS)
    - campaign_recipients nullable campaign_id + sequence_id FK
    - TypeScript interfaces for sequences domain
    - useSequences hook (CRUD + enrollment + archive)
    - useSequence hook (single fetch + steps + saveSteps)
    - /sequences/* route declarations
    - Sequences sidebar nav item
  affects:
    - src/types/database.ts
    - src/App.tsx
    - src/components/layout/Sidebar.tsx
    - src/components/layout/AppLayout.tsx
    - supabase/migrations/
    - supabase/config.toml
tech_stack:
  added: []
  patterns:
    - delete-all + bulk insert for step reordering (saveSteps)
    - upsert with onConflict for idempotent enrollment (startSequence)
    - workspace_id denormalization on sequence_enrollments for RLS performance
key_files:
  created:
    - supabase/migrations/008_sequences.sql
    - src/hooks/sequences/useSequences.ts
    - src/hooks/sequences/useSequence.ts
    - src/pages/sequences/SequencesPage.tsx
    - src/pages/sequences/SequenceBuilderPage.tsx
    - src/pages/sequences/SequenceResultsPage.tsx
  modified:
    - src/types/database.ts
    - src/App.tsx
    - src/components/layout/Sidebar.tsx
    - src/components/layout/AppLayout.tsx
    - supabase/config.toml
decisions:
  - sequence_step_sends bridge table chosen over JSONB metadata in campaign_recipients — cleaner per-step stats queries for Plan 04
  - saveSteps uses delete-all + bulk insert pattern (simpler than diffing, handles reordering cleanly)
  - startSequence uses upsert with ignoreDuplicates:true to safely re-run without double-enrolling
  - pg_cron schedule NOT in this migration — deferred to Plan 03 after Edge Function exists (avoids migration failure if extension not enabled)
  - campaign_id made nullable on campaign_recipients to allow sequence step tracking rows without campaign FK violation
metrics:
  duration: 3min
  completed: 2026-04-14
  tasks_completed: 2
  files_changed: 11
---

# Phase 6 Plan 1: Sequences Data Foundation Summary

Sequences data foundation with 4-table DB schema, TypeScript interfaces, two data hooks (list + single), route wiring, and sidebar navigation entry using Workflow icon.

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Database migration + TypeScript types + config.toml update | df70fe7 | 008_sequences.sql, database.ts, config.toml |
| 2 | Data hooks + route wiring + sidebar navigation + placeholder pages | a52d8b0 | useSequences.ts, useSequence.ts, App.tsx, Sidebar.tsx, AppLayout.tsx, 3 page placeholders |

## What Was Built

**Migration (008_sequences.sql):**
- `sequences` table — workspace-scoped with status CHECK constraint ('draft', 'active', 'paused', 'archived'), contact_list_id FK, from_name/from_email/reply_to_email
- `sequence_steps` table — cascade delete from sequences, UNIQUE(sequence_id, step_number), delay_days + TipTap body_json
- `sequence_enrollments` table — UNIQUE(sequence_id, contact_id), next_send_at + current_step for cron-driven sending, partial index on next_send_at WHERE status='active'
- `sequence_step_sends` bridge table — SELECT-only RLS (Edge Function writes via service_role), links enrollment + step + campaign_recipient for per-step stats
- ALTER campaign_recipients: campaign_id nullable, sequence_id UUID FK added
- pg_cron and pg_net extensions enabled (idempotent IF NOT EXISTS)
- [functions.send-sequence-step] verify_jwt = false registered in config.toml

**TypeScript types (database.ts):**
- `SequenceStatus`, `SequenceEnrollmentStatus` union types
- `Sequence`, `SequenceStep`, `SequenceEnrollment`, `SequenceStepSend` interfaces
- `SequenceInsert`, `SequenceUpdate`, `SequenceStepInsert`, `SequenceStepUpdate` mutation types
- All 4 tables added to `Database` interface Tables section

**Hooks:**
- `useSequences` — fetchSequences (workspace-scoped), createSequence, updateSequence, deleteSequence, archiveSequence, pauseSequence, resumeSequence, startSequence (bulk enrollment via upsert)
- `useSequence` — fetchSequence (sequence + steps), updateSequence, saveSteps (delete-all + bulk insert for clean reordering)

**Routing + Navigation:**
- 4 routes: /sequences, /sequences/new, /sequences/:id/edit, /sequences/:id/results
- Sidebar: Workflow icon, 'Sequences' label between Campaigns and Templates
- AppLayout pageTitles: '/sequences': 'Sequences'
- 3 placeholder page components (Plans 02 and 04 will replace)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

The following placeholder page components render static text only. They are intentional stubs — Plans 02 and 04 will replace them with full implementations:

| File | Stub | Resolved by |
|------|------|-------------|
| src/pages/sequences/SequencesPage.tsx | Returns static "Sequences page — loading..." div | Plan 02 |
| src/pages/sequences/SequenceBuilderPage.tsx | Returns static "Sequence builder — loading..." div | Plan 02 |
| src/pages/sequences/SequenceResultsPage.tsx | Returns static "Sequence results — loading..." div | Plan 04 |

These stubs do not prevent Plan 01's goal (data foundation contracts) from being achieved.

## Threat Surface Scan

No new network endpoints or auth paths introduced in this plan. The sequence_step_sends RLS is SELECT-only as required by T-6-03 — INSERT/UPDATE/DELETE reserved for Edge Function with service_role (Plan 03). The send-sequence-step config.toml entry (verify_jwt = false) is consistent with T-6-04 disposition — secret header validation will be implemented in Plan 03.

## Self-Check: PASSED

- supabase/migrations/008_sequences.sql: FOUND
- src/types/database.ts (SequenceStatus export): FOUND
- src/hooks/sequences/useSequences.ts: FOUND
- src/hooks/sequences/useSequence.ts: FOUND
- src/pages/sequences/SequencesPage.tsx: FOUND
- src/pages/sequences/SequenceBuilderPage.tsx: FOUND
- src/pages/sequences/SequenceResultsPage.tsx: FOUND
- commit df70fe7: FOUND
- commit a52d8b0: FOUND
- npm run build: exits 0
