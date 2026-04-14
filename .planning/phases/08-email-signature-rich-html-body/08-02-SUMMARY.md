---
phase: 08-email-signature-rich-html-body
plan: 02
subsystem: settings-editor
tags: [tiptap, signature, settings, preview, typescript]
dependency_graph:
  requires:
    - "08-01 (signature columns on profiles, Color/TextAlign extensions, CampaignEditorToolbar)"
  provides:
    - signature editor in SettingsPage Workspace tab
    - CampaignPreview optional signatureHtml rendering with hr separator
    - CampaignBuilderPage passes profile.signature_html to preview
  affects:
    - src/pages/settings/SettingsPage.tsx
    - src/components/campaigns/CampaignPreview.tsx
    - src/pages/campaigns/CampaignBuilderPage.tsx
tech_stack:
  added: []
  patterns:
    - signaturePopulated ref guard for one-time TipTap editor population
    - isEmptySig null-coercion pattern for empty editor content
    - Optional prop pattern for CampaignPreview signatureHtml rendering
key_files:
  created:
    - .planning/phases/08-email-signature-rich-html-body/08-02-SUMMARY.md
  modified:
    - src/pages/settings/SettingsPage.tsx
    - src/components/campaigns/CampaignPreview.tsx
    - src/pages/campaigns/CampaignBuilderPage.tsx
decisions:
  - "signaturePopulated useRef guard prevents re-population when profile refreshes after save — same pattern as CampaignBuilderPage populated guard"
  - "isEmptySig check stores null instead of <p></p> for both signature_html and signature_json columns"
  - "CampaignPreview restructured to nested divs: outer div keeps prose class, inner div holds body HTML, conditional hr + inner div for signature"
  - "useAuth imported in CampaignBuilderPage alongside existing useToast — both hooks coexist cleanly"
metrics:
  duration: "4 minutes"
  completed: "2026-04-14T23:30:00Z"
  tasks_completed: 2
  files_changed: 3
---

# Phase 8 Plan 02: Signature Editor in Settings and CampaignPreview Integration Summary

**One-liner:** SettingsPage Workspace tab gains a full TipTap signature editor (toolbar + min-h-120px content area) that saves signature_html/signature_json alongside workspace fields; CampaignPreview renders the optional signature below the body with an hr separator, wired from profile via CampaignBuilderPage.

## What Was Built

### Task 1: Signature editor in SettingsPage Workspace tab

- **`src/pages/settings/SettingsPage.tsx`** — Workspace tab restructured from a single Card to a two-card layout inside a form:
  - **Sending Defaults Card** — existing sender name/email fields, unchanged content
  - **Email Signature Card** — new section with heading "Email Signature", helper text "Appended below every email you send. Supports formatting and personalization variables.", and a full TipTap editor
  - `signatureEditor` created via `useEditor` with the complete extension set: StarterKit, LinkExtension, ImageExtension, Placeholder (placeholder: "Add your signature…"), VariableChipNode, VariableSlashCommand, Color, TextAlign
  - `signaturePopulated` ref guards one-time population from `profile.signature_json` (fallback to `profile.signature_html`) — prevents re-population when profile refreshes after save
  - `handleWorkspaceSave` updated to include `signature_html` and `signature_json` in the Supabase update, with `isEmptySig` check to store `null` instead of `<p></p>`
  - Editor container: `border border-gray-700 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500`
  - EditorContent: `min-h-[120px]` for 3-row minimum height
  - Save button text updated to "Save workspace settings" per UI-SPEC copywriting contract

### Task 2: CampaignPreview signature display and CampaignBuilderPage wiring

- **`src/components/campaigns/CampaignPreview.tsx`** — Updated interface and rendering:
  - Added optional `signatureHtml?: string` prop
  - `substitutedSignature` computed via `substituteVariables(signatureHtml)` — variables in signature are replaced with sample data (Alex Smith, Acme Corp)
  - Restructured render: outer `prose` div now contains two inner `dangerouslySetInnerHTML` divs separated by `<hr className="my-4 border-gray-200" />` when signature is present

- **`src/pages/campaigns/CampaignBuilderPage.tsx`** — Two additions:
  - `import { useAuth } from '../../hooks/useAuth'` added alongside existing `useToast` import
  - `const { profile } = useAuth()` destructured inside component
  - `CampaignPreview` call updated to pass `signatureHtml={profile?.signature_html ?? undefined}`

## Commits

| Task | Commit | Message |
|------|--------|---------|
| Task 1 | `b1108ce` | feat(phase-08): add TipTap signature editor to Settings Workspace tab |
| Task 2 | `bb3a1c5` | feat(phase-08): add signature to CampaignPreview and wire from CampaignBuilderPage |

## Verification Results

- `npx tsc --noEmit` — zero errors after both tasks
- `SettingsPage.tsx` contains `signatureEditor` (11 occurrences), `Email Signature` card heading, `signature_html` in update payload, `signaturePopulated` ref, `Save workspace settings` button text, `min-h-[120px]`, `focus-within:ring-2 focus-within:ring-indigo-500`, and helper text
- `CampaignPreview.tsx` contains `signatureHtml?: string` prop, `substitutedSignature = signatureHtml ? substituteVariables(signatureHtml) : null`, `<hr className="my-4 border-gray-200" />`, and `dangerouslySetInnerHTML={{ __html: substitutedSignature }}`
- `CampaignBuilderPage.tsx` contains `import { useAuth }`, `const { profile } = useAuth()`, and `signatureHtml={profile?.signature_html ?? undefined}`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — signature data flows from the live Supabase profile through to both the Settings editor (load/save) and the CampaignPreview (render). No placeholder data or hardcoded empty values in the rendering path.

## Threat Flags

None — no new network endpoints or auth paths introduced. Profile update in `handleWorkspaceSave` is scoped to `eq('id', user?.id ?? '')` — RLS enforces `auth.uid()` match. Signature HTML rendered in `CampaignPreview` via `dangerouslySetInnerHTML` is TipTap-generated controlled output from the user's own session (T-08-04 accepted per plan threat model).

## Self-Check: PASSED

- `src/pages/settings/SettingsPage.tsx` — FOUND, contains signatureEditor, Email Signature card, signature_html in update
- `src/components/campaigns/CampaignPreview.tsx` — FOUND, contains signatureHtml prop, substitutedSignature, hr separator
- `src/pages/campaigns/CampaignBuilderPage.tsx` — FOUND, contains useAuth import, profile destructuring, signatureHtml prop
- Commit `b1108ce` — FOUND
- Commit `bb3a1c5` — FOUND
- TypeScript compilation — PASS (zero errors)
