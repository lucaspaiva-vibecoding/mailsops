---
phase: 7
slug: templates-settings
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (via `npm run test` if configured) / manual browser verification |
| **Config file** | none — no test files detected in codebase |
| **Quick run command** | `npm run build` (TypeScript compile gate) |
| **Full suite command** | `npm run build && npm run lint` |
| **Estimated runtime** | ~10 seconds |

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
| 7-01-01 | 01 | 1 | TMPL-01 | — | workspace_id enforced on templates insert | build | `npm run build` | ❌ W0 | ⬜ pending |
| 7-01-02 | 01 | 1 | TMPL-01 | — | RLS prevents cross-workspace reads | build | `npm run build` | ❌ W0 | ⬜ pending |
| 7-02-01 | 02 | 1 | TMPL-02 | — | "Save as template" modal validates name not empty | build | `npm run build` | ❌ W0 | ⬜ pending |
| 7-02-02 | 02 | 1 | TMPL-03 | — | "Use template" pre-fills campaign builder | build | `npm run build` | ❌ W0 | ⬜ pending |
| 7-03-01 | 03 | 2 | SETT-01 | — | Workspace settings save without error | build | `npm run build` | ❌ W0 | ⬜ pending |
| 7-03-02 | 03 | 2 | SETT-02 | — | Resend API key masked, never returned to client | build | `npm run build` | ❌ W0 | ⬜ pending |
| 7-03-03 | 03 | 2 | SETT-04 | — | Unsubscribe footer text saved to profile | build | `npm run build` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- No test framework detected in codebase — verification via TypeScript build + lint + manual browser testing
- All automated verifications use `npm run build` as the compile gate
- Manual browser tests cover interactive flows

*Existing infrastructure (TypeScript strict mode + ESLint) covers automated compile-time verification.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Save campaign as template from CampaignsPage row action | TMPL-01 | UI interaction flow | Click row action → modal appears → confirm → template appears in TemplatesPage |
| Save as template from CampaignBuilderPage | TMPL-02 | UI interaction flow | Click "Save as template" → modal with default name → confirm → appears in TemplatesPage |
| Use template navigates and pre-fills campaign builder | TMPL-03 | Navigation + pre-fill verification | Click "Use template" → /campaigns/new loads with subject/body/sender pre-filled |
| Delete template removes it from list | TMPL-04 | Destructive UI action | Click Delete → confirm → template removed from table |
| Workspace settings persist after page reload | SETT-01 | DB persistence check | Save settings → reload page → values present |
| Resend API key masked when key exists | SETT-02 | UX masking behavior | Save key → field shows masked placeholder, not raw key |
| Tabs navigate correctly at /settings | SETT-03 | Tab routing | Click each tab → URL updates → content changes |
| /settings/profile redirects to /settings | D-09 | Redirect behavior | Navigate to /settings/profile → redirects to /settings |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
