---
phase: 02-campaign-builder
plan: 02
subsystem: editor
tags: [typescript, tiptap, react, campaigns, editor, rich-text, personalization]

# Dependency graph
requires:
  - phase: 02-campaign-builder
    plan: 01
    provides: Campaign types and hooks that CampaignBuilderPage will consume
provides:
  - VariableChipNode custom TipTap Node extension (inline variable chips)
  - CampaignEditorToolbar with Bold, Italic, H1, H2, Bullet, Link, Image, Variable buttons
  - VariableDropdown toolbar dropdown for inserting personalization variables
  - CampaignPreview component with sample data substitution in 600px light container
  - VariableSlashCommand extension for '/' triggered variable insertion in editor body
  - VARIABLES constant (first_name, last_name, company) shared across toolbar and slash command
affects: [02-03, 02-04, campaign-builder-page]

# Tech tracking
tech-stack:
  added:
    - "@tiptap/extension-link@2.27.2"
    - "@tiptap/extension-image@2.27.2"
    - "@tiptap/extension-placeholder@2.27.2"
    - "@tiptap/suggestion@2.27.2"
  patterns:
    - "TipTap custom Node.create for inline atom nodes — chip renders in editor but serializes to {{variable}} text"
    - "TipTap Extension.create wrapping @tiptap/suggestion Suggestion plugin for slash commands"
    - "Suggestion.render() returns lifecycle hooks (onStart/onUpdate/onKeyDown/onExit) using vanilla DOM for popup"
    - "clientRect API used for cursor-relative popup positioning (not coordsAtPos — Suggestion 2.27.x API)"

key-files:
  created:
    - src/components/campaigns/VariableChipNode.ts
    - src/components/campaigns/CampaignEditorToolbar.tsx
    - src/components/campaigns/VariableDropdown.tsx
    - src/components/campaigns/CampaignPreview.tsx
    - src/components/campaigns/VariableSlashCommand.ts
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "TipTap extensions installed at 2.27.2 (matching actual installed core version) not 2.27.2 from plan — @tiptap/core was already at 2.27.2 (semver satisfied ^2.11.5), latest extensions require ^3 so explicit 2.27.2 versions used"
  - "VariableSlashCommand uses clientRect API for popup positioning — Suggestion 2.27.x provides clientRect callback instead of requiring view.coordsAtPos; behavior identical (cursor-relative), API is correct for this version"
  - "VARIABLES constant exported from VariableDropdown.tsx alongside component — same pattern as Toast.tsx; react-refresh warning accepted as pre-existing project pattern"

patterns-established:
  - "TipTap atom nodes use contentEditable=false and aria-label for accessibility per UI-SPEC"
  - "VariableChipNode renderHTML outputs {{variable}} as text content for email delivery serialization"
  - "Slash command popup built with vanilla DOM (not React) to avoid React lifecycle issues with ProseMirror plugins"

requirements-completed: [CAMP-02, CAMP-03]

# Metrics
duration: 4min
completed: 2026-04-13
---

# Phase 2 Plan 02: TipTap Editor Components Summary

**TipTap custom VariableChipNode extension, CampaignEditorToolbar with full formatting + variable insertion, VariableDropdown, CampaignPreview with sample substitution, and VariableSlashCommand '/' trigger extension — all five editor components ready for composition in CampaignBuilderPage**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-13T11:27:32Z
- **Completed:** 2026-04-13T11:30:57Z
- **Tasks:** 3
- **Files modified:** 7 (5 created, 2 modified)

## Accomplishments

- Installed four TipTap extension packages at 2.27.2 matching existing `@tiptap/core` version: `extension-link`, `extension-image`, `extension-placeholder`, `suggestion`
- Created `VariableChipNode` — custom TipTap `Node.create` extension: inline, atom, non-editable chip with `bg-indigo-900 text-indigo-200` styling, serializes to `{{variable_name}}` in `getHTML()` output
- Created `CampaignEditorToolbar` — 12 toolbar items in UI-SPEC order (Bold, Italic, H1, H2, Bullet, Link, Image, Variable) with inline URL popovers for Link and Image
- Created `VariableDropdown` — toolbar dropdown listing first_name/last_name/company with `role="listbox"` accessibility; inserts via `insertVariable` command
- Created `CampaignPreview` — light-theme 600px container with `substituteVariables()` replacing `{{first_name}}` → Alex, `{{last_name}}` → Smith, `{{company}}` → Acme Corp
- Created `VariableSlashCommand` — TipTap Extension wrapping `@tiptap/suggestion` Suggestion plugin; typing `/` in editor opens filterable dark popup; arrow/enter/escape navigation; inserts VariableChipNode on selection

## Task Commits

Each task was committed atomically:

1. **Task 1: Install TipTap extensions + VariableChipNode** - `233e47e` (feat)
2. **Task 2: CampaignEditorToolbar + VariableDropdown + CampaignPreview** - `77e5839` (feat)
3. **Task 3: VariableSlashCommand extension** - `8db3d20` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `src/components/campaigns/VariableChipNode.ts` - Custom TipTap Node extension: inline atom chip, `bg-indigo-900 text-indigo-200`, serializes to `{{variable}}`, `insertVariable` command
- `src/components/campaigns/CampaignEditorToolbar.tsx` - Toolbar with Bold/Italic/H1/H2/Bullet/Link/Image/Variable, inline URL popovers, keyboard support (Enter/Escape)
- `src/components/campaigns/VariableDropdown.tsx` - Variable insertion dropdown, `VARIABLES` export, `role="listbox"`, click-outside close
- `src/components/campaigns/CampaignPreview.tsx` - Light-theme 600px preview with `substituteVariables()` and `dangerouslySetInnerHTML`
- `src/components/campaigns/VariableSlashCommand.ts` - Slash command extension using `@tiptap/suggestion`, dark popup, `clientRect` positioning, keyboard navigation
- `package.json` - Added four TipTap extension packages at 2.27.2
- `package-lock.json` - Updated lockfile

## Decisions Made

- `@tiptap/core` was already at 2.27.2 (semver `^2.11.5` resolved to latest 2.x); installing extensions without explicit version would pull 3.x which requires `@tiptap/core@^3` — installed 2.27.2 explicitly to match
- `VariableSlashCommand` uses `props.clientRect()` (Suggestion 2.27.x API) instead of `view.coordsAtPos()` — the `clientRect` callback is the idiomatic way to get cursor position in this version; result is equivalent
- `VARIABLES` constant lives in `VariableDropdown.tsx` alongside the component — same pattern as `Toast.tsx` (pre-existing warning accepted); moves it to a separate file would require changing VariableSlashCommand import

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TipTap extension version conflict**
- **Found during:** Task 1 (npm install)
- **Issue:** `npm install @tiptap/extension-link @tiptap/extension-image @tiptap/extension-placeholder @tiptap/suggestion` failed because latest versions (3.x) require `@tiptap/core@^3`, but installed core is 2.27.2
- **Fix:** Installed all four extensions at explicit `@2.27.2` to match the installed core version
- **Files modified:** `package.json`, `package-lock.json`
- **Commit:** `233e47e`

**2. [Rule 1 - API Adaptation] Suggestion clientRect vs coordsAtPos**
- **Found during:** Task 3 (VariableSlashCommand implementation)
- **Issue:** Plan specified using `view.coordsAtPos(props.range.from)` for popup positioning, but `@tiptap/suggestion` 2.27.x provides `props.clientRect()` as the standard popup positioning callback — this is the idiomatic API for this version
- **Fix:** Used `props.clientRect()` which returns a `DOMRect` with `left` and `bottom` coordinates, achieving identical cursor-relative positioning behavior
- **Files modified:** `src/components/campaigns/VariableSlashCommand.ts`
- **Commit:** `8db3d20`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 API adaptation)
**Impact on plan:** Both deviations resolved correctly. All 5 components created as specified. TypeScript strict mode passes clean.

## Known Stubs

None. All five components are fully implemented with no placeholder data or empty bodies.

## Threat Flags

No new threat surface introduced beyond what the plan's threat model documents:
- `CampaignPreview` uses `dangerouslySetInnerHTML` — accepted per T-2-02 (self-authored content, scoped div)
- `VariableChipNode` renderHTML — outputs only `{{variable_name}}` text from fixed set per T-2-03 mitigation

## Next Phase Readiness

- All five editor components are ready for composition in `CampaignBuilderPage` (Plan 03)
- Plan 03 executor must import and wire: `VariableChipNode`, `VariableSlashCommand` in `useEditor` extensions array; `CampaignEditorToolbar` for toolbar; `VariableDropdown` embedded in toolbar; `CampaignPreview` for preview mode
- `VARIABLES` exported from `VariableDropdown.tsx` — available for any future extension that needs the variable list
- No blockers for Plan 03

## Self-Check: PASSED

- `src/components/campaigns/VariableChipNode.ts` — FOUND
- `src/components/campaigns/CampaignEditorToolbar.tsx` — FOUND
- `src/components/campaigns/VariableDropdown.tsx` — FOUND
- `src/components/campaigns/CampaignPreview.tsx` — FOUND
- `src/components/campaigns/VariableSlashCommand.ts` — FOUND
- Task 1 commit `233e47e` — FOUND
- Task 2 commit `77e5839` — FOUND
- Task 3 commit `8db3d20` — FOUND
- `npx tsc --noEmit` exits 0 — VERIFIED
- `npm run lint` exits 0 errors — VERIFIED

---
*Phase: 02-campaign-builder*
*Completed: 2026-04-13*
