# Phase 7: Templates & Settings - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver two distinct capabilities:

1. **Template Library** — Users can save any campaign as a reusable template, browse saved templates, create a new campaign pre-filled from a template, and delete templates they no longer need.

2. **Settings Hub** — Users can configure workspace settings (company name, timezone, default sender name/email), save their Resend API key, view the active sending domain, and configure the unsubscribe footer text.

Out of scope: template categories/tags, team-shared templates, Resend domain verification flow, any other settings not listed above.

</domain>

<decisions>
## Implementation Decisions

### Templates page layout
- **D-01:** Table/list layout (not card grid) for the Templates page
- **D-02:** Each row shows: template name, subject line, date saved
- **D-03:** Per-row actions: "Use template" (→ Campaign Builder pre-filled) + "Delete"
- **D-04:** No preview action, no rename action — keep it minimal

### "Save as template" entry points
- **D-05:** "Save as template" is available in TWO places:
  - CampaignsPage table — as a row action alongside Edit/Delete
  - CampaignBuilderPage — as a button (e.g., in the header/action area)
- **D-06:** Saving opens a small modal prompting for a template name (defaulting to the campaign name). User confirms to save.
- **D-07:** "Use template" navigates to `/campaigns/new` with subject, body, sender name, sender email, preview text pre-filled from the template. No confirmation modal — direct navigation.

### Settings page structure
- **D-08:** Settings is a **tabbed page** at `/settings` with three tabs: **Profile**, **Workspace**, **Integrations**
  - **Profile tab** — personal info (existing ProfilePage content: full name, company name, timezone, email, workspace ID)
  - **Workspace tab** — workspace defaults: default sender name, default sender email (new fields), timezone can remain in Profile
  - **Integrations tab** — Resend API key, sending domain display (read-only), unsubscribe footer text
- **D-09:** `/settings/profile` route should redirect to `/settings` (Profile tab) or the tab becomes the default
- **D-10:** Sidebar "Settings" link navigates to `/settings` (tab defaults to Profile on first load, or last active tab)

### Resend API key UX
- **D-11:** API key field is **always masked** — shows placeholder text ("API key configured" or bullet mask) when a key exists. User must clear and re-enter to update. No reveal toggle.
- **D-12:** Sending domain (SETT-03) is displayed as read-only text ("resend.dev shared domain") — informational only, no editable field

### Claude's Discretion
- DB schema for templates table (new table vs. reusing campaigns) — researcher decides cleanest approach
- DB schema for new workspace settings fields (add columns to profiles table vs. new workspace_settings table)
- Default tab active state and URL-based tab routing pattern
- Exact empty state design for Templates page when no templates exist
- Confirmation dialog for template deletion

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above.

### Project and requirements
- `.planning/REQUIREMENTS.md` — TMPL-01 through TMPL-04, SETT-01 through SETT-04
- `.planning/ROADMAP.md` — Phase 7 goal and success criteria

### Existing settings page (extend this)
- `src/pages/settings/ProfilePage.tsx` — existing Profile content to migrate into the Profile tab
- `src/types/database.ts` — Profile interface (add new fields for workspace defaults + Resend key)

### Campaigns patterns (reuse for templates)
- `src/pages/campaigns/CampaignsPage.tsx` — table layout pattern, row actions pattern
- `src/pages/campaigns/CampaignBuilderPage.tsx` — pre-fill pattern + where to add "Save as template" button
- `src/hooks/campaigns/useCampaigns.ts` — hook pattern for list + mutations

### Navigation / routing
- `src/App.tsx` — route declarations (add `/settings`, `/templates` routes, redirect `/settings/profile`)
- `src/components/layout/Sidebar.tsx` — Settings link already points to `/settings/profile`, update to `/settings`
- `src/components/layout/AppLayout.tsx` — pageTitles map (update settings titles)

### DB migration naming
- `supabase/migrations/008_sequences.sql` — latest migration; next should be `009_templates.sql`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/Card.tsx` — wraps each settings section/tab content
- `src/components/ui/Button.tsx` — primary/secondary variants for save/cancel actions
- `src/components/ui/Input.tsx` — for all settings form fields
- `src/components/ui/Badge.tsx` — could be used for "Active" domain badge
- `src/components/ui/Spinner.tsx` — loading states
- `src/components/ui/Toast.tsx` + `useToast()` — success/error feedback
- `src/lib/constants.ts` — TIMEZONES constant already defined here

### Established Patterns
- Hooks in `src/hooks/{domain}/useXxx.ts` — create `src/hooks/templates/useTemplates.ts`
- Pages in `src/pages/{domain}/XxxPage.tsx` — create `src/pages/templates/TemplatesPage.tsx` and `src/pages/settings/SettingsPage.tsx`
- RLS: all tables require `workspace_id` + matching policy via `profiles.workspace_id`
- `useAuth()` → `profile.workspace_id` for all workspace-scoped queries
- Migration naming: next file is `009_templates.sql` (or `009_templates_settings.sql`)

### Integration Points
- `src/App.tsx` — add `/templates`, `/settings` routes; `/settings/profile` redirect
- `src/components/layout/Sidebar.tsx` — Settings link already exists (update href target)
- `src/components/layout/AppLayout.tsx` — update pageTitles for settings tabs and templates
- `src/types/database.ts` — add Template interface and extended Profile fields

</code_context>

<specifics>
## Specific Ideas

No "I want it like X" references provided during discussion — open to standard approaches for all visual details.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 07-templates-settings*
*Context gathered: 2026-04-14*
