---
phase: 1
slug: contact-lists
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-13
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vite.config.ts (or vitest.config.ts — Wave 0 installs) |
| **Quick run command** | `npm run typecheck` |
| **Full suite command** | `npm run build && npm run typecheck` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck`
- **After every plan wave:** Run `npm run build && npm run typecheck`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 0 | CONT-01 | — | Schema migration applied before data access | manual | `supabase db push` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 0 | CONT-04 | — | Import log table exists | manual | `supabase db push` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 1 | CONT-01 | — | TypeScript types compile | type | `npm run typecheck` | ❌ W0 | ⬜ pending |
| 1-03-01 | 03 | 1 | LIST-01 | — | workspace_id filter on all queries | type | `npm run typecheck` | ❌ W0 | ⬜ pending |
| 1-04-01 | 04 | 2 | CONT-01,CONT-02 | — | Duplicate handling skips/upserts correctly | manual | manual CSV test | ❌ W0 | ⬜ pending |
| 1-05-01 | 05 | 2 | CONT-05,CONT-06 | — | CRUD operations reflect in UI | manual | manual UI test | ❌ W0 | ⬜ pending |
| 1-06-01 | 06 | 3 | CONT-07,CONT-08 | — | Search/filter returns correct results | manual | manual UI test | ❌ W0 | ⬜ pending |
| 1-07-01 | 07 | 3 | LIST-02,LIST-03 | — | List member counts update accurately | manual | manual UI test | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Supabase migration: `contacts`, `contact_lists`, `contact_list_members`, `contact_import_logs` tables
- [ ] DB trigger for `contact_count` maintenance on `contact_list_members`
- [ ] `npm install papaparse @types/papaparse` — CSV parsing library
- [ ] TypeScript type extensions in `src/types/database.ts`

*These are blocking prerequisites — no application code can proceed without them.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CSV import end-to-end | CONT-01, CONT-02, CONT-03 | Requires file upload interaction in browser | Upload CSV, map columns, verify contacts appear |
| Duplicate skip/update | CONT-02 | Requires seeded data + import | Import CSV with known duplicates, verify counts |
| Import history display | CONT-04 | Requires completed import run | Check import log panel after import |
| Contact drawer UX | CONT-05, CONT-06 | UI interaction, overflow/z-index | Open drawer, edit contact, verify list stays visible behind |
| Search and filter | CONT-07, CONT-08, CONT-09 | Requires seeded data | Filter by email/name/tag/status/custom field |
| List count accuracy | LIST-05 | Requires DB trigger verification | Add/remove contacts from list, verify count column |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
