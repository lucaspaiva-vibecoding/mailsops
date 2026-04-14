---
phase: 07-templates-settings
plan: 01
subsystem: database
tags: [supabase, postgres, typescript, rls, migrations]

# Dependency graph
requires:
  - phase: 06-sequences
    provides: useSequences hook pattern and 008_sequences.sql migration pattern followed here
provides:
  - templates table in Supabase with workspace_id RLS
  - profiles table extended with 4 new settings columns
  - Template TypeScript interface and TemplateInsert type
  - useTemplates hook with fetchTemplates, createTemplate, deleteTemplate
affects:
  - 07-02-PLAN.md (TemplatesPage — consumes useTemplates hook)
  - 07-03-PLAN.md (SaveAsTemplateModal — consumes createTemplate)
  - 07-04-PLAN.md (SettingsPage — consumes Profile interface new fields)
  - 07-05-PLAN.md (schema push — applies 009_templates_settings.sql to production)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Dedicated templates table (separate from campaigns) for clean content snapshots without delivery lifecycle
    - ADD COLUMN IF NOT EXISTS pattern for idempotent profile schema extension
    - useTemplates follows useSequences shape exactly: workspace-scoped CRUD with defense-in-depth workspace_id injection

key-files:
  created:
    - supabase/migrations/009_templates_settings.sql
    - src/hooks/templates/useTemplates.ts
  modified:
    - src/types/database.ts

key-decisions:
  - "New templates table (not reusing campaigns) — templates are static content snapshots with no delivery lifecycle; mixing would pollute campaign queries"
  - "Four new columns on profiles (not separate workspace_settings table) — workspace=user at MVP, profiles already has company_name/timezone; no JOIN needed"
  - "Hard delete for templates — no FK references from other tables; soft delete unnecessary"
  - "createTemplate injects workspace_id server-side from profile.workspace_id — defense-in-depth against client workspace_id tampering"
  - "deleteTemplate double-filters on id AND workspace_id — matches deleteSequence pattern, defense-in-depth alongside RLS"

patterns-established:
  - "Pattern: hooks/templates/useTemplates.ts — CRUD hook shape mirrors useSequences exactly for consistency"
  - "Pattern: Omit<TemplateInsert, 'workspace_id'> on createTemplate param — workspace_id always injected from profile, never trusted from client"

requirements-completed: [TMPL-01, TMPL-02, TMPL-04, SETT-01, SETT-02, SETT-04]

# Metrics
duration: 8min
completed: 2026-04-14
---

# Phase 7 Plan 01: Templates & Settings — Data Foundation Summary

**Templates table + profiles settings columns in Supabase migration, Template/TemplateInsert TypeScript types, and useTemplates CRUD hook with workspace_id-scoped RLS**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-14T17:00:00Z
- **Completed:** 2026-04-14T17:08:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created `supabase/migrations/009_templates_settings.sql` with templates table (UUID PK, 10 columns), workspace index, RLS policy, and 4 new profile columns
- Extended `src/types/database.ts` with Profile interface additions (4 settings fields), Template interface, TemplateInsert type, and Database Tables map entry
- Created `src/hooks/templates/useTemplates.ts` following useSequences pattern with fetchTemplates, createTemplate (workspace_id injection), and deleteTemplate (double-filter defense-in-depth)
- `npm run build` passes with zero TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Create DB migration and TypeScript types** - `4190caa` (feat)
2. **Task 2: Create useTemplates data hook** - `307e3c0` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `supabase/migrations/009_templates_settings.sql` - Templates table + RLS policy + index + 4 new profile columns
- `src/types/database.ts` - Profile interface extended with 4 settings fields; Template interface + TemplateInsert type + Database Tables entry
- `src/hooks/templates/useTemplates.ts` - CRUD hook for templates table: fetchTemplates, createTemplate, deleteTemplate

## Decisions Made
- New dedicated `templates` table rather than reusing `campaigns` — templates are static content snapshots with no delivery lifecycle (status, sent_at, recipient counts); mixing with campaigns would pollute every campaign list query and continue the ab_variant exclusion pattern
- Four new columns added to `profiles` table rather than a separate `workspace_settings` table — workspace=user at MVP (1:1 ratio); profiles already holds company_name/timezone; no JOIN overhead; dedicated table appropriate only at multi-user workspace stage (v2 scope)
- Hard delete for templates — no FK references from any other table point to templates; no audit trail requirement; simpler queries
- `unsubscribe_footer_text` defaults to `'To unsubscribe from future emails, click here: {{unsubscribe_url}}'` in migration — existing users get a sensible placeholder immediately on first Settings page load
- `createTemplate` accepts `Omit<TemplateInsert, 'workspace_id'>` and injects workspace_id from profile — defense-in-depth against client workspace_id tampering, matching threat mitigation T-07-01

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Build passed cleanly on first attempt.

## User Setup Required

None - no external service configuration required. The SQL migration file `009_templates_settings.sql` must be applied to Supabase in a later plan (07-05).

## Next Phase Readiness
- useTemplates hook is ready for consumption by 07-02 (TemplatesPage) and 07-03 (SaveAsTemplateModal)
- Profile interface new fields (default_sender_name, default_sender_email, resend_api_key, unsubscribe_footer_text) are ready for 07-04 (SettingsPage)
- Migration file 009_templates_settings.sql will be applied to production in plan 07-05 (schema push)
- No blockers

---
*Phase: 07-templates-settings*
*Completed: 2026-04-14*
