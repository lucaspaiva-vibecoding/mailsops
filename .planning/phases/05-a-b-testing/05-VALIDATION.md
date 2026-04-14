---
phase: 5
slug: a-b-testing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-13
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual — no automated test framework detected (no jest/vitest config) |
| **Config file** | none |
| **Quick run command** | `npm run build` (TypeScript compile check) |
| **Full suite command** | `npm run build && npm run lint` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build` to catch TypeScript errors
- **After every plan wave:** Run `npm run build && npm run lint` + manual browser verification
- **Before `/gsd-verify-work`:** All 4 manual acceptance criteria must pass (see Per-Task Verification Map)
- **Max feedback latency:** 15 seconds (build check)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 1 | ABTS-01 | — | N/A | build | `npm run build` | ✅ | ⬜ pending |
| 5-01-02 | 01 | 1 | ABTS-01 | — | N/A | build | `npm run build` | ✅ | ⬜ pending |
| 5-01-03 | 01 | 1 | ABTS-02 | — | Input range 8–90 validated client-side | build | `npm run build` | ✅ | ⬜ pending |
| 5-02-01 | 02 | 2 | ABTS-01 | — | session checked before Edge Function invoke | build + manual | `npm run build` | ✅ | ⬜ pending |
| 5-02-02 | 02 | 2 | ABTS-02 | — | contact_ids subset passed to send-campaign | build + manual | `npm run build` | ✅ | ⬜ pending |
| 5-03-01 | 03 | 3 | ABTS-03 | — | RLS workspace_id check inherited | build + manual | `npm run build` | ✅ | ⬜ pending |
| 5-03-02 | 03 | 3 | ABTS-04 | — | winner-send uses stored hold-back IDs | build + manual | `npm run build` | ✅ | ⬜ pending |
| 5-04-01 | 04 | 4 | ABTS-01 | — | N/A | build + manual | `npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements (TypeScript compiler serves as the automated check; no test framework install needed).

*No additional Wave 0 setup required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Create A/B test with 2 variants (different subject/body) | ABTS-01 | No UI test framework — requires browser interaction | Create A/B test → confirm 3 DB rows in Supabase campaigns table (1 `ab_test` + 2 `ab_variant`); reload edit page and confirm each variant's subject persists |
| Split percentage slider: derived breakdown display | ABTS-02 | Requires UI interaction | Set test group size to 60% → confirm display reads "Variant A: 30% · Variant B: 30% · Hold-back: 40%" |
| View side-by-side open/click rates per variant | ABTS-03 | Requires sent campaign data | After variants sent: navigate to `/campaigns/:id/ab-results`; confirm StatCards show correct rates from variant campaign rows (not parent campaign) |
| Select winning variant → sends to remaining contacts | ABTS-04 | Requires Edge Function invocation | Click "Send Variant A"; confirm modal shows correct hold-back count; confirm hold-back contacts receive email; confirm parent campaign status → 'sent' in DB |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (`npm run build` covers all)
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
