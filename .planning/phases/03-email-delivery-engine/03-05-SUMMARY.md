---
phase: 03-email-delivery-engine
plan: "05"
subsystem: frontend
tags: [send-campaign, edge-function-invocation, confirmation-dialog, toast-feedback, campaign-status, frontend]
dependency_graph:
  requires: [send-campaign Edge Function (03-03), useCampaign hook, CampaignBuilderPage, supabase.functions.invoke]
  provides: [sendCampaign hook function, frontend send flow, confirmation dialog, send/schedule button with state-aware label]
  affects: [campaign status transitions, user-facing send UX, DELV-01 completion]
tech_stack:
  added: []
  patterns: [supabase.functions.invoke for Edge Function calls, window.confirm for send confirmation, dual-path send logic (edit vs create mode)]
key_files:
  created: []
  modified:
    - src/hooks/campaigns/useCampaign.ts
    - src/pages/campaigns/CampaignBuilderPage.tsx
decisions:
  - "Edit mode saves latest content then calls sendCampaign hook (which uses id from useParams); create mode creates draft first then invokes Edge Function directly with new campaign ID"
  - "window.confirm() used for send confirmation dialog — simple, no extra dependency (T-03-20)"
  - "canSend guard checks campaign.status is draft or scheduled — prevents re-sending sent/sending campaigns (T-03-19, T-03-21)"
  - "On send error in create mode: navigate to edit URL with new campaign ID instead of orphaning the campaign"
  - "sendCampaign hook function calls fetchCampaign after success to update local state with new status"
metrics:
  duration: ~5m
  completed_date: "2026-04-13"
  tasks_completed: 2
  tasks_total: 3
  files_modified: 2
---

# Phase 3 Plan 05: Frontend Send Campaign UI Summary

**One-liner:** Frontend wired to invoke send-campaign Edge Function via useCampaign hook — confirmation dialog, dual-path send logic (edit vs create), `sending` state disabling, dynamic button label, and success/error toast feedback completing DELV-01.

## Tasks Completed

### Task 1: Add sendCampaign function to useCampaign hook

**Status:** COMPLETE — committed at `64d6a67`

Added `sendCampaign` async function to `src/hooks/campaigns/useCampaign.ts`:

- Invokes `send-campaign` Edge Function via `supabase.functions.invoke('send-campaign', { body: { campaign_id: id } })`
- Handles both `FunctionInvokeError` (network/auth error) and application-level `{ ok: false }` responses
- Calls `fetchCampaign()` after successful send to refresh campaign state in the hook
- Returns `{ error: string | null; sent?: number; total?: number }` matching Edge Function response shape
- Added to return statement alongside existing `updateCampaign` and `refetch`

### Task 2: Update CampaignBuilderPage to invoke sendCampaign with confirmation and feedback

**Status:** COMPLETE — committed at `9d9efe3`

Updated `src/pages/campaigns/CampaignBuilderPage.tsx`:

**Imports added:**
- `supabase` from `../../lib/supabase` (needed for direct invocation in create-then-send path)

**State added:**
- `const [sending, setSending] = useState(false)` — separate from `saving` for distinct UI feedback

**Destructuring updated:**
- `sendCampaign` added to useCampaign destructuring

**handleScheduleSend rewritten:**
- `scheduleMode === 'now'` path:
  1. `window.confirm()` dialog with irreversibility warning
  2. `setSending(true)` before async work
  3. Edit mode: `updateCampaign(savePayload)` then `sendCampaign()` from hook
  4. Create mode: `createCampaign({ ...savePayload, status: 'draft' })` then `supabase.functions.invoke('send-campaign', ...)` directly with new campaign ID
  5. Success: `showToast('Campaign sent to X of Y contacts.', 'success')` then `navigate('/campaigns')`
  6. Error: `showToast(errorMessage, 'error')` — stays on page (edit mode) or navigates to edit URL (create mode)
- `scheduleMode === 'later'` path: preserved unchanged (saves with `status: 'scheduled'`, navigates)

**Send eligibility:**
- `canSend = !campaign || campaign.status === 'draft' || campaign.status === 'scheduled'`
- Both send buttons: `disabled={!canSend || sending}`

**Dynamic button label:**
- `'Already Sent'` when campaign.status === 'sent'
- `'Sending...'` when sending === true
- `'Send Now'` when scheduleMode === 'now'
- `'Schedule'` when scheduleMode === 'later'

### Task 3: Verify campaign send flow end-to-end

**Status:** AWAITING HUMAN VERIFICATION — checkpoint not yet reached

## Deviations from Plan

None — plan executed exactly as written. All STRIDE mitigations T-03-19, T-03-20, T-03-21 applied as specified in the threat model.

## Known Stubs

None — all send logic is fully wired. The `sendCampaign` function invokes the real Edge Function; no mock data used.

## Threat Flags

No new security surface beyond what is documented in the plan's threat model.

- T-03-19 (Tampering — double-click): `sending` state disables both send buttons during in-flight invocation. `canSend` guard prevents re-sending already-sent campaigns.
- T-03-20 (Repudiation — accidental send): `window.confirm()` dialog on line ~205 requires explicit acknowledgment before any send operation proceeds.
- T-03-21 (DoS — rapid send attempts): Button disabled during `sending`; Edge Function validates campaign status is `draft/scheduled` before processing (defense-in-depth).

## Self-Check: PASSED

- [x] `src/hooks/campaigns/useCampaign.ts` — EXISTS and contains `sendCampaign`
- [x] `src/pages/campaigns/CampaignBuilderPage.tsx` — EXISTS and contains `sendCampaign`, `window.confirm`, `setSending`, `canSend`, `sendButtonLabel`
- [x] Commit `64d6a67` — EXISTS (`feat(03-05): add sendCampaign function to useCampaign hook`)
- [x] Commit `9d9efe3` — EXISTS (`feat(03-05): wire CampaignBuilderPage to invoke send-campaign Edge Function`)
- [x] `npx tsc --noEmit` exits 0 — CONFIRMED
- [x] `npx eslint src/hooks/campaigns/useCampaign.ts src/pages/campaigns/CampaignBuilderPage.tsx` exits 0 — CONFIRMED
- [x] `useCampaign.ts` contains `supabase.functions.invoke('send-campaign'` — YES (line 56)
- [x] `useCampaign.ts` contains `body: { campaign_id: id }` — YES (line 57)
- [x] `CampaignBuilderPage.tsx` contains `window.confirm(` — YES (line ~205)
- [x] `CampaignBuilderPage.tsx` contains `setSending(true)` — YES (line ~210)
- [x] `CampaignBuilderPage.tsx` contains `setSending(false)` — YES (multiple exit paths)
- [x] `CampaignBuilderPage.tsx` contains `Campaign sent to` — YES (lines ~244, ~275)
- [x] `CampaignBuilderPage.tsx` contains `canSend` — YES (lines ~325, ~371, ~591)
- [x] `CampaignBuilderPage.tsx` contains `sendButtonLabel` — YES (lines ~328, ~375, ~595)
- [x] Task 3 (human-verify checkpoint) — PENDING human verification
