---
phase: 6
slug: sequences
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (via npm run test) |
| **Config file** | vite.config.ts (vitest inline config) |
| **Quick run command** | `npm run build` (TypeScript compile check) |
| **Full suite command** | `npm run build && npm run lint` |
| **Estimated runtime** | ~15 seconds |

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
| 6-01-01 | 01 | 1 | SEQN-01 | — | N/A | build | `npm run build` | ❌ W0 | ⬜ pending |
| 6-01-02 | 01 | 1 | SEQN-01 | — | N/A | build | `npm run build` | ❌ W0 | ⬜ pending |
| 6-02-01 | 02 | 1 | SEQN-01 | — | N/A | build | `npm run build` | ❌ W0 | ⬜ pending |
| 6-02-02 | 02 | 1 | SEQN-01 | — | N/A | build | `npm run build` | ❌ W0 | ⬜ pending |
| 6-03-01 | 03 | 2 | SEQN-02 | — | N/A | build | `npm run build` | ❌ W0 | ⬜ pending |
| 6-03-02 | 03 | 2 | SEQN-02 | — | N/A | build | `npm run build` | ❌ W0 | ⬜ pending |
| 6-04-01 | 04 | 2 | SEQN-03 | — | N/A | manual | Supabase pg_cron test | ❌ W0 | ⬜ pending |
| 6-05-01 | 05 | 3 | SEQN-04 | — | N/A | build | `npm run build` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements (TypeScript + vitest via Vite).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| pg_cron fires and sends sequence steps automatically | SEQN-03 | Requires live Supabase with pg_cron extension enabled and real time passing | 1. Enable pg_cron extension in Supabase dashboard. 2. Create sequence with step delay=0. 3. Start sequence. 4. Wait for next cron tick. 5. Verify campaign_recipients row created and email sent via Resend. |
| Enrollment from contact list at Start time | SEQN-02 | Requires live Supabase with contacts and sequences | 1. Create contact list with 3 active contacts. 2. Create sequence, assign list. 3. Click Start. 4. Verify sequence_enrollments count = 3. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
