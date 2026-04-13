---
phase: 4
slug: analytics-dashboard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-13
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (via Vite) |
| **Config file** | vite.config.ts |
| **Quick run command** | `npm run lint` |
| **Full suite command** | `npm run build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run lint`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 0 | — | — | N/A | lint | `npm run lint` | ✅ | ⬜ pending |
| 4-02-01 | 02 | 1 | ANLX-01 | — | N/A | build | `npm run build` | ✅ | ⬜ pending |
| 4-02-02 | 02 | 1 | ANLX-02 | — | N/A | build | `npm run build` | ✅ | ⬜ pending |
| 4-03-01 | 03 | 1 | ANLX-03 | — | N/A | build | `npm run build` | ✅ | ⬜ pending |
| 4-03-02 | 03 | 1 | ANLX-04 | — | N/A | build | `npm run build` | ✅ | ⬜ pending |
| 4-04-01 | 04 | 1 | DASH-01 | — | N/A | build | `npm run build` | ✅ | ⬜ pending |
| 4-04-02 | 04 | 2 | DASH-02 | — | N/A | build | `npm run build` | ✅ | ⬜ pending |
| 4-04-03 | 04 | 2 | DASH-03 | — | N/A | build | `npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/types/database.ts` — fix stale CampaignRecipient interface (status/resend_message_id/variables)

*Existing infrastructure covers all phase requirements after type fix.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Campaign stat cards show correct counts | ANLX-01 | Requires live Supabase data + sent campaign | Open CampaignDetailPage, verify stat cards match campaign table values |
| Event timeline renders chronologically | ANLX-02 | Requires real events in tracking_events table | Send test campaign, open timeline, verify events ordered by timestamp |
| Per-link click drill-down | ANLX-03 | Requires click events in DB | Click tracked link, verify count increments in UI |
| Dashboard account-wide stats | DASH-01 | Requires contacts + campaigns in workspace | Verify totals match DB counts on Dashboard page |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
