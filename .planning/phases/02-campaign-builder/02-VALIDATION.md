---
phase: 2
slug: campaign-builder
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-13
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None detected — no test config files found in project |
| **Config file** | None — Wave 0 documents manual validation approach |
| **Quick run command** | `npm run lint && npx tsc --noEmit` |
| **Full suite command** | Manual browser walkthrough per Interaction Contracts in UI-SPEC.md |
| **Estimated runtime** | ~15s (lint + tsc) + manual walkthrough |

---

## Sampling Rate

- **After every task commit:** Run `npm run lint && npx tsc --noEmit`
- **After every plan wave:** Manual browser walkthrough against UI-SPEC.md Interaction Contracts
- **Before `/gsd-verify-work`:** Full manual suite must be green
- **Max feedback latency:** ~15 seconds (automated), manual at wave boundaries

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 2-xx-01 | TBD | 0 | CAMP-01–08 | — | N/A | build | `npm run lint && npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 2-xx-02 | TBD | 1 | CAMP-01 | T-2-01 | workspace_id filter on all campaign queries | manual | Browser: /campaigns/new, fill fields, save draft | ❌ W0 | ⬜ pending |
| 2-xx-03 | TBD | 1 | CAMP-02 | — | N/A | manual | Browser: editor toolbar buttons, link/image popover | ❌ W0 | ⬜ pending |
| 2-xx-04 | TBD | 1 | CAMP-03 | — | N/A | manual | Browser: insert variable chip, check getHTML() output | ❌ W0 | ⬜ pending |
| 2-xx-05 | TBD | 1 | CAMP-04 | T-2-01 | workspace_id filter on contact list query | manual | Browser: /campaigns/new, verify dropdown | ❌ W0 | ⬜ pending |
| 2-xx-06 | TBD | 2 | CAMP-05 | — | N/A | manual | Browser: schedule for later, verify DB record stores UTC | ❌ W0 | ⬜ pending |
| 2-xx-07 | TBD | 2 | CAMP-06 | T-2-02 | JWT verified in Edge Function; RESEND_API_KEY server-side only | manual | Browser: send test, check toast + Resend dashboard | ❌ W0 | ⬜ pending |
| 2-xx-08 | TBD | 2 | CAMP-07 | — | N/A | manual | Browser: save draft, navigate away, return to /campaigns/:id/edit | ❌ W0 | ⬜ pending |
| 2-xx-09 | TBD | 2 | CAMP-08 | — | N/A | manual | Browser: duplicate from campaigns list, verify "Copy of" prefix + draft status | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Note: Task IDs will be filled in after PLAN.md files are created.*

---

## Wave 0 Requirements

- [ ] Install 3 missing TipTap extensions at version 2.27.2: `@tiptap/extension-link`, `@tiptap/extension-image`, `@tiptap/extension-placeholder`
- [ ] Extract TIMEZONES constant to `src/lib/constants.ts` (currently inline — Wave 0 dependency for SchedulingSection)
- [ ] Add Campaign TypeScript types to `src/types/database.ts` — `CampaignStatus` enum and `Campaign` interface from schema-v1.md §Module 3
- [ ] Add `campaigns` table to `Database` interface in `src/types/database.ts`
- [ ] Create `supabase/functions/send-test-email/` directory structure for Edge Function
- [ ] Wire routes `/campaigns`, `/campaigns/new`, `/campaigns/:id/edit` in `src/App.tsx`
- [ ] Confirm campaign RLS policies are applied in Supabase dashboard (not a file — manual verification step)

*No automated test framework required — Wave 0 is setup only; validation is lint + tsc + manual browser.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Create campaign with all fields | CAMP-01 | No test framework | Navigate to /campaigns/new, fill all fields, save draft, verify record in Supabase |
| Rich text editor toolbar | CAMP-02 | DOM interaction required | Click each toolbar button (bold, italic, link, image), verify formatting applied |
| Variable chip insert and serialization | CAMP-03 | Requires editor state inspection | Insert a variable chip, call editor.getHTML() in browser console, verify raw `{{variable_name}}` output |
| Contact list selector populates | CAMP-04 | Requires live Supabase data | Open campaign builder, verify dropdown shows Phase 1 contact lists |
| Schedule saves UTC | CAMP-05 | Requires DB record verification | Schedule for future, verify `scheduled_at` in Supabase dashboard is correct UTC |
| Test send invokes Edge Function | CAMP-06 | Requires Resend API + Edge Function | Click "Send Test", verify toast success + check Resend dashboard for delivery |
| Draft save and resume | CAMP-07 | Requires navigation state | Save draft, navigate away, return to /campaigns/:id/edit, verify content reloads |
| Campaign duplicate | CAMP-08 | Requires list + data state | Click duplicate from campaigns list, verify new record has "Copy of" prefix and draft status |
| VariableChipNode renderHTML | Assumption A1 | Critical for Phase 3 | After implementing VariableChipNode, verify getHTML() returns `{{variable_name}}` not `<span>` markup |
| Campaign RLS applied | Assumption A5 | DB verification | Check Supabase dashboard: campaigns table should have 4 RLS policies (SELECT/INSERT/UPDATE/DELETE) |
| Status enum matches live DB | Assumption A6 | DB verification | Check Supabase dashboard: campaigns.status enum values match schema-v1.md (draft/scheduled/sending/sent/paused/cancelled) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s (lint + tsc)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
