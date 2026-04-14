---
phase: 08-email-signature-rich-html-body
plan: 01
subsystem: editor
tags: [tiptap, rich-text, toolbar, migration, typescript]
dependency_graph:
  requires: []
  provides:
    - signature columns on profiles table (signature_html, signature_json)
    - CampaignEditorToolbar with color picker and alignment buttons
    - Color and TextAlign extensions wired into all editors
  affects:
    - src/components/campaigns/CampaignEditorToolbar.tsx
    - src/pages/campaigns/CampaignBuilderPage.tsx
    - src/components/sequences/StepEditorPanel.tsx
tech_stack:
  added:
    - "@tiptap/extension-color@2.27.2"
    - "@tiptap/extension-text-align@2.27.2"
  patterns:
    - TipTap extension registration via useEditor extensions array
    - Preset color palette swatch grid popover (8 email-safe colors)
    - Mutual-exclusion popover state pattern (link / image / color)
key_files:
  created:
    - supabase/migrations/010_signature.sql
    - .planning/phases/08-email-signature-rich-html-body/08-01-SUMMARY.md
  modified:
    - src/types/database.ts
    - src/components/campaigns/CampaignEditorToolbar.tsx
    - src/pages/campaigns/CampaignBuilderPage.tsx
    - src/components/sequences/StepEditorPanel.tsx
    - package.json
    - package-lock.json
decisions:
  - "8-color preset palette chosen (black, dark gray, red, orange, yellow, green, blue, purple) — email-safe mid-range luminosity for readability on white backgrounds"
  - "TextStyle not explicitly added to extensions — StarterKit already includes it (avoids Pitfall 2 double-registration warning)"
  - "TextAlign configured with types: ['heading', 'paragraph'] to support both node types (avoids Pitfall 3)"
  - "Color picker popover follows mutual-exclusion pattern: opening any popover closes the other two"
metrics:
  duration: "3 minutes"
  completed: "2026-04-14T23:18:45Z"
  tasks_completed: 2
  files_changed: 6
---

# Phase 8 Plan 01: DB Foundation, TipTap Color & Alignment Summary

**One-liner:** Migration adds signature_html/signature_json to profiles; toolbar extended with 8-swatch color picker and left/center/right alignment buttons wired into both campaign and sequence editors via @tiptap/extension-color and @tiptap/extension-text-align.

## What Was Built

### Task 1: DB Migration, npm Installs, TypeScript Types

- **`supabase/migrations/010_signature.sql`** — `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS signature_html TEXT, ADD COLUMN IF NOT EXISTS signature_json JSONB`. No RLS changes needed (existing per-row policy covers new columns automatically).
- **npm packages** — Installed `@tiptap/extension-color@2.27.2` and `@tiptap/extension-text-align@2.27.2`, matching the installed `@tiptap/core@2.27.2`. No version conflict.
- **`src/types/database.ts`** — Added `signature_html: string | null` and `signature_json: Record<string, unknown> | null` to the `Profile` interface after `unsubscribe_footer_text`, matching the `body_html`/`body_json` dual-storage pattern used in campaigns and templates.

### Task 2: Extended Toolbar and Editor Wiring

- **`src/components/campaigns/CampaignEditorToolbar.tsx`** — Extended with:
  - `COLOR_PALETTE` constant (8 email-safe colors with hex values)
  - Three alignment buttons (AlignLeft, AlignCenter, AlignRight) after H2, before BulletList per D-15
  - Color picker button (Palette icon) after Image button
  - Color picker popover: 4-column swatch grid, active swatch highlighted with `ring-2 ring-indigo-400`
  - Mutual exclusion: each popover (link, image, color) closes the others on open
  - `colorPickerOpen` state added alongside existing `linkPopoverOpen` / `imagePopoverOpen`

- **`src/pages/campaigns/CampaignBuilderPage.tsx`** — Added `Color` and `TextAlign.configure({ types: ['heading', 'paragraph'] })` to `useEditor` extensions array.

- **`src/components/sequences/StepEditorPanel.tsx`** — Same Color + TextAlign extensions added to the per-step `useEditor` instance.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| Task 1 | `fc355c8` | feat(phase-08): add signature migration, TipTap extensions, and Profile type update |
| Task 2 | `9109656` | feat(phase-08): extend toolbar with color picker and alignment buttons, wire extensions into all editors |

## Verification Results

- `supabase/migrations/010_signature.sql` — contains `ALTER TABLE public.profiles` with both `ADD COLUMN IF NOT EXISTS` clauses
- `package.json` — `@tiptap/extension-color: "^2.27.2"` and `@tiptap/extension-text-align: "^2.27.2"` present
- `src/types/database.ts` — Profile interface has `signature_html: string | null` and `signature_json: Record<string, unknown> | null`
- `npx tsc --noEmit` — zero errors
- Toolbar has `AlignLeft`, `AlignCenter`, `AlignRight`, `Palette` icons with correct aria-labels
- `COLOR_PALETTE` array with 8 color objects, rendered as `grid grid-cols-4 gap-1` swatch grid
- Both `CampaignBuilderPage` and `StepEditorPanel` import and register `Color` and `TextAlign`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan establishes the DB schema foundation and toolbar UI primitives. No data flows to UI rendering are stubbed. The `signature_html` and `signature_json` columns are empty until Plan 02 adds the signature editor to SettingsPage.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries introduced. The two new profile columns inherit the existing RLS policy (`id = auth.uid()`). Color values are preset hex strings applied via TipTap commands, not free-form user input.

## Self-Check: PASSED

- `supabase/migrations/010_signature.sql` — FOUND
- `src/types/database.ts` (signature_html field) — FOUND
- `src/components/campaigns/CampaignEditorToolbar.tsx` (AlignLeft, COLOR_PALETTE) — FOUND
- `src/pages/campaigns/CampaignBuilderPage.tsx` (Color, TextAlign imports) — FOUND
- `src/components/sequences/StepEditorPanel.tsx` (Color, TextAlign imports) — FOUND
- Commit `fc355c8` — FOUND
- Commit `9109656` — FOUND
- TypeScript compilation — PASS (zero errors)
