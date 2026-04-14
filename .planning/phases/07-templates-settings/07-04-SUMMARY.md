---
phase: 07-templates-settings
plan: 04
subsystem: ui
tags: [react, typescript, tailwind, supabase, settings, forms]

# Dependency graph
requires:
  - phase: 07-01
    provides: Profile interface with default_sender_name, default_sender_email, resend_api_key, unsubscribe_footer_text columns

provides:
  - Tabbed SettingsPage at /settings with Profile, Workspace, and Integrations tabs
  - /settings/profile redirect to /settings via React Router Navigate
  - Sidebar Settings link pointing to /settings
  - AppLayout pageTitles entry for /settings

affects:
  - 07-05-PLAN.md (schema push — the migration must be applied for Workspace/Integrations save to write new columns)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - URL-based tab state via useSearchParams (?tab=profile|workspace|integrations) — default tab = 'profile' (no param)
    - Per-tab independent form + save handler pattern — prevents cross-tab data overwrite (apiKeyDirty guard)
    - API key dirty-state guard — only includes resend_api_key in UPDATE payload when user has typed a new value

key-files:
  created:
    - src/pages/settings/SettingsPage.tsx
  modified:
    - src/App.tsx
    - src/components/layout/Sidebar.tsx
    - src/components/layout/AppLayout.tsx

key-decisions:
  - "useSearchParams for tab state — URL-based tabs allow direct linking to /settings?tab=integrations; default tab (no param) shows Profile"
  - "Each tab has its own form element and save handler — prevents Workspace save from overwriting API key with empty string, and vice versa"
  - "apiKeyDirty guard — resend_api_key excluded from UPDATE unless user has typed a new value; prevents clearing key on unrelated saves"
  - "API key input type=password with empty value when not dirty — key is never populated into DOM, display-only masked placeholder when key exists"
  - "ProfilePage kept on disk but removed from routing — retained as historical reference; SettingsPage Profile tab is its functional replacement"

patterns-established:
  - "Pattern: useSearchParams tab routing — switchTab sets empty params for default tab, named param for non-default"
  - "Pattern: dirty-state API key guard — apiKeyDirty boolean gates inclusion of sensitive field in UPDATE payload"

requirements-completed: [SETT-01, SETT-02, SETT-03, SETT-04]

# Metrics
duration: 2min
completed: 2026-04-14
---

# Phase 7 Plan 04: Settings Hub Summary

**Tabbed SettingsPage at /settings with Profile/Workspace/Integrations tabs, masked API key dirty-state guard, read-only sending domain badge, and unsubscribe footer textarea**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-14T16:51:36Z
- **Completed:** 2026-04-14T16:52:56Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created `src/pages/settings/SettingsPage.tsx` with three independent tabs (Profile, Workspace, Integrations), each with its own form and save handler
- Profile tab migrates all ProfilePage content verbatim (avatar header, Personal Information card, Account card)
- Workspace tab saves default_sender_name and default_sender_email to profiles table
- Integrations tab has masked API key (type="password", apiKeyDirty guard), read-only "resend.dev shared domain" with Active badge, and unsubscribe footer textarea
- Updated routing, sidebar nav link, and page title across App.tsx, Sidebar.tsx, and AppLayout.tsx
- `npm run build` passes with zero TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SettingsPage with three tabs** - `195bfeb` (feat)
2. **Task 2: Update routing, sidebar, and page titles** - `08f5bcb` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `src/pages/settings/SettingsPage.tsx` - Tabbed settings hub with Profile, Workspace, and Integrations tabs; three independent save handlers
- `src/App.tsx` - SettingsPage route at /settings; Navigate redirect from /settings/profile; ProfilePage import removed
- `src/components/layout/Sidebar.tsx` - Settings navItem updated from /settings/profile to /settings
- `src/components/layout/AppLayout.tsx` - pageTitles updated from /settings/profile to /settings with label 'Settings'

## Decisions Made
- URL-based tab state via useSearchParams — clean URLs, allows bookmarking /settings?tab=integrations, default tab (no param) is Profile
- Per-tab independent forms — each tab is a separate `<form>` with its own onSubmit handler and loading state; prevents the Workspace save from accidentally clearing resend_api_key or unsubscribe_footer_text
- apiKeyDirty boolean guard — API key only included in Supabase UPDATE payload when user has actively typed a new value; prevents silent key erasure on any other tab save
- API key value never pre-populated into DOM — input shows empty string when not dirty, placeholder shows bullet mask when key exists; the actual key string is never placed in the input

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Build passed cleanly on first attempt.

## User Setup Required

None - no external service configuration required. The new profile columns (default_sender_name, default_sender_email, resend_api_key, unsubscribe_footer_text) require migration 009_templates_settings.sql to be applied to production (handled in plan 07-05).

## Next Phase Readiness
- SettingsPage is fully functional; all four SETT requirements delivered (SETT-01 through SETT-04)
- Migration 009_templates_settings.sql must be applied (07-05) before Workspace and Integrations saves can write to the new columns in production
- ProfilePage at src/pages/settings/ProfilePage.tsx is no longer routed but remains on disk

---
*Phase: 07-templates-settings*
*Completed: 2026-04-14*
