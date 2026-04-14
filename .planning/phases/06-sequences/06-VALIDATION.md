---
phase: 6
slug: sequences
status: draft
nyquist_compliant: true
nyquist_acceptance: "build-only"
wave_0_complete: false
created: 2026-04-14
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None in active use — project has no test suite (no jest.config, vitest.config, or test directory per RESEARCH.md Validation Architecture) |
| **Config file** | N/A |
| **Quick run command** | `npm run build` (TypeScript compile check) |
| **Full suite command** | `npm run build && npm run lint` |
| **Estimated runtime** | ~15 seconds |

### Build-Only Verification Acceptance

This project intentionally uses `npm run build` (TypeScript strict-mode compilation) as the primary automated verification for all phases. Per RESEARCH.md Validation Architecture:

- **No unit test framework** is configured or in active use across the project (Phases 1-5 all used build-only verification)
- **TypeScript strict mode** catches type errors, missing imports, interface mismatches, and dead code
- **ESLint** catches React hooks rule violations and refresh pattern issues
- **Runtime behavior** is verified via manual-only checks (see Manual-Only Verifications below) against the live Supabase instance

Adding a test framework (e.g., Vitest) is a valid future improvement but is out of scope for this phase, consistent with all prior phases.

---

## Sampling Rate

- **After every task commit:** Run `npm run build`
- **After every plan wave:** Run `npm run build && npm run lint`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 6-01-01 | 01 | 1 | SEQN-01 | — | N/A | build | `npm run build` | N/A (build) | ⬜ pending |
| 6-01-02 | 01 | 1 | SEQN-01 | — | N/A | build | `npm run build` | N/A (build) | ⬜ pending |
| 6-02-01 | 02 | 2 | SEQN-01 | — | N/A | build | `npm run build` | N/A (build) | ⬜ pending |
| 6-02-02 | 02 | 2 | SEQN-01 | — | N/A | build | `npm run build` | N/A (build) | ⬜ pending |
| 6-03-01 | 03 | 2 | SEQN-03 | T-6-08 | secret header auth | build+grep | `npm run build` + file content check | N/A (build) | ⬜ pending |
| 6-03-02 | 03 | 2 | SEQN-03 | — | N/A | manual | Supabase deploy + cron setup | N/A (checkpoint) | ⬜ pending |
| 6-04-01 | 04 | 3 | SEQN-04 | — | N/A | build | `npm run build` | N/A (build) | ⬜ pending |
| 6-04-02 | 04 | 3 | SEQN-04 | — | N/A | build | `npm run build` | N/A (build) | ⬜ pending |
| 6-05-01 | 05 | 4 | SEQN-01-04 | — | N/A | build+lint | `npm run build && npm run lint` | N/A (build) | ⬜ pending |
| 6-05-02 | 05 | 4 | SEQN-01-04 | — | N/A | manual | Schema application to production | N/A (checkpoint) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- No Wave 0 test scaffold needed — project standard is build-only verification (TypeScript strict + ESLint).
- All `<automated>` commands use `npm run build` which requires no additional test files.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| pg_cron fires and sends sequence steps automatically | SEQN-03 | Requires live Supabase with pg_cron extension enabled and real time passing | 1. Enable pg_cron extension in Supabase dashboard. 2. Create sequence with step delay=0. 3. Start sequence. 4. Wait for next cron tick. 5. Verify campaign_recipients row created and email sent via Resend. |
| Enrollment from contact list at Start time | SEQN-02 | Requires live Supabase with contacts and sequences | 1. Create contact list with 3 active contacts. 2. Create sequence, assign list. 3. Click Start. 4. Verify sequence_enrollments count = 3. |
| campaign_recipients insert with campaign_id NULL | SEQN-03 | Requires live Supabase with migration 008 applied | 1. Start a sequence. 2. Wait for cron or manually invoke send-sequence-step. 3. Query campaign_recipients and verify: campaign_id IS NULL, sequence_id matches sequence UUID. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify (npm run build) — build-only is the intentional project standard
- [x] Sampling continuity: every task has build verification
- [x] No Wave 0 needed — build verification requires no test scaffolds
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter (with `nyquist_acceptance: "build-only"` documenting the standard)

**Approval:** pending
