---
phase: 02-campaign-builder
plan: 03
subsystem: campaign-builder
tags: [typescript, react, tiptap, supabase, edge-functions, resend, scheduling, forms]

# Dependency graph
requires:
  - phase: 02-campaign-builder
    plan: 01
    provides: Campaign types, useCampaigns, useCampaign hooks
  - phase: 02-campaign-builder
    plan: 02
    provides: VariableChipNode, VariableSlashCommand, CampaignEditorToolbar, CampaignPreview, VariableDropdown/VARIABLES
provides:
  - SchedulingSection component (send-now/schedule-later radio + datetime-local + TIMEZONES dropdown)
  - TestSendSection component (invokes send-test-email Edge Function with toast feedback)
  - send-test-email Supabase Edge Function (JWT verification + Resend API integration)
  - CampaignBuilderPage (full campaign creation/editing form — Details, Content, Target & Schedule sections)
affects: [02-04, campaign-builder, campaign-list]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "selectionStart/selectionEnd + requestAnimationFrame for cursor-position variable insertion in plain text inputs"
    - "Supabase Edge Function: JWT verification via supabase.auth.getUser() before processing request"
    - "Edge Function env secret: RESEND_API_KEY via Deno.env.get() — never in browser bundle"
    - "edit mode population via useEffect with populated guard to prevent re-population on refetch"
    - "beforeunload guard pattern: addEventListener in useEffect with dirty boolean dependency"

key-files:
  created:
    - src/components/campaigns/SchedulingSection.tsx
    - src/components/campaigns/TestSendSection.tsx
    - supabase/functions/send-test-email/index.ts
  modified:
    - src/pages/campaigns/CampaignBuilderPage.tsx

key-decisions:
  - "scheduleMode='now' sets status='sending' (not 'queued' — aligns with actual DB schema values per Plan 01 decision)"
  - "scheduledAt stored as UTC via new Date(localDatetimeString).toISOString() — datetime-local interpreted as browser local time"
  - "Timezone dropdown in SchedulingSection is display-only reference; does not change UTC conversion math"
  - "populated guard prevents re-population when useCampaign refetches after updateCampaign"
  - "Edge Function catches err as (err as Error).message — TypeScript strict mode requires explicit cast for unknown catch variable"

patterns-established:
  - "Subject variable insertion uses selectionStart/selectionEnd for cursor tracking + requestAnimationFrame to restore cursor after React re-render"
  - "Supabase Edge Functions authenticate via Authorization header JWT check before any data processing"

requirements-completed: [CAMP-01, CAMP-04, CAMP-05, CAMP-06, CAMP-07]

# Metrics
duration: 2min
completed: 2026-04-13
---

# Phase 2 Plan 03: Campaign Builder Page Summary

**Full CampaignBuilderPage with single-page form layout (Details/Content/Target & Schedule), TipTap editor wired with VariableChipNode + VariableSlashCommand, subject line variable insertion via selectionStart/End, SchedulingSection with datetime picker, TestSendSection invoking Resend via Supabase Edge Function with JWT authentication**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-13T11:33:39Z
- **Completed:** 2026-04-13T11:35:49Z
- **Tasks:** 2
- **Files modified:** 4 (3 created, 1 replaced)

## Accomplishments

- Created `SchedulingSection` component: send-now/schedule-later radio buttons with `accent-indigo-500`, conditional datetime-local picker with `min` set to current datetime, TIMEZONES dropdown
- Created `TestSendSection` component: invokes `send-test-email` Edge Function via `supabase.functions.invoke`, shows "Test email sent." / "Test send failed. Check your Resend configuration." toast feedback
- Created `supabase/functions/send-test-email/index.ts` Edge Function: CORS preflight, JWT verification via `supabase.auth.getUser()`, RESEND_API_KEY from `Deno.env.get()`, sends via Resend API `https://api.resend.com/emails`, returns `{ success: true, id }` or error JSON
- Replaced stub `CampaignBuilderPage` with full 300+ line implementation:
  - Dual mode: create (`/campaigns/new`) and edit (`/campaigns/:id/edit`) via `useParams`
  - Edit mode populates all form fields from `useCampaign` response (including `body_json` → TipTap `setContent`)
  - Subject line variable insertion: `{{ }}` button with dropdown reusing `VARIABLES` from `VariableDropdown.tsx`; `selectionStart`/`selectionEnd` cursor tracking with `requestAnimationFrame` cursor restoration
  - TipTap `useEditor` with `StarterKit`, `Link`, `Image`, `Placeholder`, `VariableChipNode`, `VariableSlashCommand` — both toolbar dropdown and `/` slash command for variable insertion
  - Edit/Preview toggle (`role="tablist"`) switching between `CampaignEditorToolbar + EditorContent` and `CampaignPreview`
  - Contact list `<select>` from `useContactLists()` with "Select a contact list..." default disabled option
  - `handleSaveDraft`: saves with `status: 'draft'`, navigates to `/campaigns/:id/edit` on create
  - `handleScheduleSend`: validates required fields inline, converts `scheduledAt` to UTC via `new Date().toISOString()`, sets `status: 'sending'` or `status: 'scheduled'`
  - `beforeunload` guard: fires when `dirty === true`
  - Inline validation with `role="alert"` and `aria-describedby` for all required fields

## Task Commits

Each task was committed atomically:

1. **Task 1: SchedulingSection + TestSendSection + send-test-email Edge Function** - `b1f2eb9` (feat)
2. **Task 2: CampaignBuilderPage full implementation** - `dff440e` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `src/components/campaigns/SchedulingSection.tsx` - Send-now/schedule-later radio, datetime-local picker, TIMEZONES dropdown
- `src/components/campaigns/TestSendSection.tsx` - Test send button, supabase.functions.invoke, toast feedback
- `supabase/functions/send-test-email/index.ts` - Edge Function: CORS, JWT auth, Resend API integration, RESEND_API_KEY secret
- `src/pages/campaigns/CampaignBuilderPage.tsx` - Full campaign builder: Details/Content/Target & Schedule sections, TipTap editor, variable insertion, save/schedule, beforeunload

## Decisions Made

- `scheduleMode='now'` sets `status='sending'` (not `'queued'`) — aligns with live DB schema values confirmed in Plan 01
- `scheduledAt` converted to UTC via `new Date(datetimeLocalString).toISOString()` — browser `datetime-local` input returns a string interpreted as local time by `Date()`; `toISOString()` converts to UTC for DB storage
- Timezone dropdown is display-only (helps user reason about send time) — does not affect UTC conversion math
- `populated` guard state prevents form re-population when `useCampaign` refetches after `updateCampaign` calls
- Edge Function uses `(err as Error).message` in catch clause — TypeScript strict mode requires explicit cast since catch variable is `unknown`

## Deviations from Plan

None — plan executed exactly as written. All components, behaviors, and Tailwind classes match the plan's specifications and UI-SPEC contract.

## Known Stubs

None. All components are fully implemented and wired end-to-end. The `send-test-email` Edge Function requires:
- `RESEND_API_KEY` secret deployed to Supabase (`supabase secrets set RESEND_API_KEY=re_xxxx`)
- Edge Function deployed (`supabase functions deploy send-test-email`)

These are infrastructure setup steps (per `user_setup` in the plan frontmatter), not code stubs.

## Threat Flags

No new threat surface introduced beyond what the plan's threat model documents:
- T-2-03 mitigated: JWT verified via `supabase.auth.getUser()` in Edge Function; unauthenticated requests return 401
- T-2-04 mitigated: `RESEND_API_KEY` only accessed via `Deno.env.get()` in Edge Function; never in browser bundle
- T-2-01 mitigated: `useCampaign`/`useCampaigns`/`useContactLists` all filter by `workspace_id`

## Self-Check: PASSED

- `src/components/campaigns/SchedulingSection.tsx` — FOUND
- `src/components/campaigns/TestSendSection.tsx` — FOUND
- `supabase/functions/send-test-email/index.ts` — FOUND
- `src/pages/campaigns/CampaignBuilderPage.tsx` — FOUND (513 lines, fully implemented)
- Task 1 commit `b1f2eb9` — FOUND
- Task 2 commit `dff440e` — FOUND
- `npx tsc --noEmit` exits 0 — VERIFIED
- `npm run lint` exits 0 errors — VERIFIED

---
*Phase: 02-campaign-builder*
*Completed: 2026-04-13*
