# Phase 7: Templates & Settings - Research

**Researched:** 2026-04-14
**Domain:** React SPA feature work — Supabase table design, tabbed UI, modal UX, pre-fill navigation pattern
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Templates page layout**
- D-01: Table/list layout (not card grid) for the Templates page
- D-02: Each row shows: template name, subject line, date saved
- D-03: Per-row actions: "Use template" (→ Campaign Builder pre-filled) + "Delete"
- D-04: No preview action, no rename action — keep it minimal

**"Save as template" entry points**
- D-05: "Save as template" is available in TWO places: CampaignsPage table row action + CampaignBuilderPage header/action area
- D-06: Saving opens a small modal prompting for a template name (defaulting to the campaign name). User confirms to save.
- D-07: "Use template" navigates to `/campaigns/new` with subject, body, sender name, sender email, preview text pre-filled from the template. No confirmation modal — direct navigation.

**Settings page structure**
- D-08: Settings is a tabbed page at `/settings` with three tabs: Profile, Workspace, Integrations
  - Profile tab — personal info (existing ProfilePage content: full name, company name, timezone, email, workspace ID)
  - Workspace tab — workspace defaults: default sender name, default sender email (new fields), timezone can remain in Profile
  - Integrations tab — Resend API key, sending domain display (read-only), unsubscribe footer text
- D-09: `/settings/profile` route should redirect to `/settings` (Profile tab) or the tab becomes the default
- D-10: Sidebar "Settings" link navigates to `/settings`

**Resend API key UX**
- D-11: API key field is always masked — shows placeholder text ("API key configured" or bullet mask) when a key exists. User must clear and re-enter to update. No reveal toggle.
- D-12: Sending domain (SETT-03) is displayed as read-only text ("resend.dev shared domain") — informational only

### Claude's Discretion
- DB schema for templates table (new table vs. reusing campaigns) — researcher decides cleanest approach
- DB schema for new workspace settings fields (add columns to profiles table vs. new workspace_settings table)
- Default tab active state and URL-based tab routing pattern
- Exact empty state design for Templates page when no templates exist
- Confirmation dialog for template deletion

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TMPL-01 | User can save any campaign as a reusable template | New `templates` table; `saveAsTemplate` function in hook; modal pattern from existing codebase |
| TMPL-02 | User can browse saved templates with name preview | `useTemplates` hook with `fetchTemplates`; TemplatesPage with table layout matching CampaignsPage pattern |
| TMPL-03 | User can create a new campaign pre-filled from a selected template | Navigate to `/campaigns/new` with `?template=<id>` query param; CampaignBuilderPage reads param and pre-fills |
| TMPL-04 | User can delete templates they no longer need | `deleteTemplate` function; window.confirm or modal confirmation per CampaignsPage pattern |
| SETT-01 | User can update workspace settings: company name, timezone, default sender name and email | New `default_sender_name`, `default_sender_email` columns on `profiles`; extend ProfilePage content into Workspace tab |
| SETT-02 | User can configure and save their Resend API key | New `resend_api_key` column on `profiles` (encrypted at rest by Postgres); masked input pattern |
| SETT-03 | User can view the active sending domain (shared Resend domain displayed) | Static read-only field in Integrations tab — no DB column needed |
| SETT-04 | User can configure unsubscribe footer text included in all outgoing emails | New `unsubscribe_footer_text` column on `profiles`; Integrations tab textarea |
</phase_requirements>

---

## Summary

Phase 7 delivers two self-contained features: a Template Library and a unified Settings Hub. Both are CRUD-only frontend features backed by simple Supabase table changes — no Edge Functions are needed. The scope is well-defined: no external service calls for templates, and the Settings page for this phase is purely profile/workspace data persistence.

The Templates feature requires one new database table (`templates`) scoped to `workspace_id`, with RLS matching the existing patterns. The "save as template" flow is a modal-triggered insert, and "use template" is a client-side navigation with query params feeding pre-fill state into the existing CampaignBuilderPage. The Settings refactor migrates the existing `ProfilePage` into a tabbed `SettingsPage`, adds two new tabs, and extends the `profiles` table with four new columns (`default_sender_name`, `default_sender_email`, `resend_api_key`, `unsubscribe_footer_text`).

**Primary recommendation:** New `templates` table (not reusing `campaigns`) + four new columns on `profiles`. Tab state via URL `?tab=profile|workspace|integrations` with React Router `useSearchParams`, with `profile` as the default. Redirect `/settings/profile` → `/settings`.

---

## Standard Stack

### Core (already installed — no new packages)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | 2.49.4 | DB read/write, RLS-backed queries | Already used across all phases |
| React Router DOM | 7.5.3 | Tab routing via `useSearchParams` | Already app routing layer |
| React | 19.0.0 | Component rendering, hooks | App framework |

[VERIFIED: package.json in codebase]

### Supporting UI (already installed)

| Component | File | Purpose | When to Use |
|-----------|------|---------|-------------|
| Card | `src/components/ui/Card.tsx` | Tab content wrapper | Every settings section |
| Button | `src/components/ui/Button.tsx` | Save/cancel/actions | All form actions |
| Input | `src/components/ui/Input.tsx` | Form fields | All text/email fields |
| Spinner | `src/components/ui/Spinner.tsx` | Loading states | During async saves |
| Toast + useToast | `src/components/ui/Toast.tsx` | Success/error feedback | After every save |
| Badge | `src/components/ui/Badge.tsx` | Status indicators | Optional — "Active" domain badge |

[VERIFIED: `src/components/ui/` directory listing]

### No New Packages Required

This phase adds no new dependencies. All required UI primitives, routing, and Supabase client are already installed.

**Installation:** None required.

---

## Architecture Patterns

### Recommended Project Structure (new files only)

```
src/
├── hooks/
│   └── templates/
│       └── useTemplates.ts           # CRUD for templates table
├── pages/
│   ├── templates/
│   │   └── TemplatesPage.tsx         # /templates — list + row actions
│   └── settings/
│       └── SettingsPage.tsx          # /settings — tabbed hub (replaces ProfilePage usage)
├── components/
│   └── templates/
│       └── SaveAsTemplateModal.tsx   # Modal for naming new template
└── types/
    └── database.ts                   # Add Template interface + ProfileUpdate extensions
supabase/
└── migrations/
    └── 009_templates_settings.sql    # New table + 4 new profile columns
```

[ASSUMED: component location follows established `src/components/{domain}/` convention from CONVENTIONS.md]

### Pattern 1: URL-based tab state (Settings tabs)

**What:** Tab active state stored in `?tab=profile|workspace|integrations` query param via React Router `useSearchParams`. Profile is the default (no param = Profile tab active).

**When to use:** When tabs need linkable, bookmarkable state without nested route complexity. This codebase uses React Router v7 and already has route params (`useParams`).

**Example:**
```typescript
// Source: React Router DOM v7 useSearchParams — [ASSUMED pattern, standard for this router version]
import { useSearchParams } from 'react-router-dom'

type SettingsTab = 'profile' | 'workspace' | 'integrations'

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = (searchParams.get('tab') as SettingsTab) ?? 'profile'

  const switchTab = (tab: SettingsTab) => {
    setSearchParams(tab === 'profile' ? {} : { tab })
  }
  // ...
}
```

**Why not nested routes:** Decision D-08/D-09 specifies a single `/settings` route with tab switching. Nested routes (`/settings/profile`, `/settings/workspace`) would require updating the Sidebar NavLink and add route complexity. A single route with `?tab=` param is simpler and satisfies D-09 (redirect `/settings/profile` → `/settings`).

### Pattern 2: "Save as template" modal

**What:** Small controlled-state modal opened from CampaignsPage row action or CampaignBuilderPage header button. Pre-populates name from campaign name. On confirm, calls `useTemplates().createTemplate()`.

**When to use:** Whenever a brief name-entry is needed before a save action, without navigating away.

**Example (modal trigger in CampaignsPage):**
```typescript
// Source: existing CampaignsPage row-action pattern [VERIFIED: CampaignsPage.tsx lines 194-246]
const [saveAsTemplateTarget, setSaveAsTemplateTarget] = useState<Campaign | null>(null)

// In row action dropdown:
<button
  onClick={(e) => {
    e.stopPropagation()
    setOpenMenuId(null)
    setSaveAsTemplateTarget(campaign)
  }}
>
  Save as template
</button>

{saveAsTemplateTarget && (
  <SaveAsTemplateModal
    campaign={saveAsTemplateTarget}
    onClose={() => setSaveAsTemplateTarget(null)}
    onSaved={() => {
      setSaveAsTemplateTarget(null)
      showToast('Template saved.', 'success')
    }}
  />
)}
```

### Pattern 3: Pre-fill via query param (Use template → Campaign Builder)

**What:** "Use template" navigates to `/campaigns/new?from_template=<template_id>`. CampaignBuilderPage reads the param on mount, fetches the template, and pre-fills form state. The `populated` guard (already in CampaignBuilderPage) prevents re-population on refetch.

**When to use:** Pre-fill pattern when destination page already has a populate-on-mount effect.

**Example:**
```typescript
// Source: CampaignBuilderPage.tsx populated-guard pattern [VERIFIED: lines 72-97]
// In TemplatesPage "Use template" action:
navigate(`/campaigns/new?from_template=${template.id}`)

// In CampaignBuilderPage, alongside existing useEffect:
const [searchParams] = useSearchParams()
const fromTemplateId = searchParams.get('from_template')

useEffect(() => {
  if (fromTemplateId && !populated && editor) {
    // fetch template by id, populate fields
    supabase.from('templates').select('*').eq('id', fromTemplateId).single()
      .then(({ data }) => {
        if (data) {
          setSubject(data.subject ?? '')
          setFromName(data.from_name ?? '')
          setFromEmail(data.from_email ?? '')
          setPreviewText(data.preview_text ?? '')
          if (data.body_json) editor.commands.setContent(data.body_json)
          else if (data.body_html) editor.commands.setContent(data.body_html)
          setPopulated(true)
        }
      })
  }
}, [fromTemplateId, populated, editor])
```

### Pattern 4: Masked API key field

**What:** When a key exists in the profile, show a placeholder (e.g. `'••••••••••••••••'`) instead of the actual value. User clears the field and types a new key to update. No reveal toggle (D-11).

**Example:**
```typescript
// Source: [ASSUMED — standard masked-input UI pattern]
const [apiKey, setApiKey] = useState('')
const [apiKeyPlaceholder] = useState(profile?.resend_api_key ? '••••••••••••••••' : '')
const [apiKeyDirty, setApiKeyDirty] = useState(false)

<input
  type="password"
  value={apiKeyDirty ? apiKey : ''}
  placeholder={apiKeyPlaceholder || 'sk_live_...'}
  onChange={(e) => { setApiKey(e.target.value); setApiKeyDirty(true) }}
  autoComplete="off"
/>
// On save: only update if apiKeyDirty === true
```

### Anti-Patterns to Avoid

- **Reusing the `campaigns` table for templates:** Adding a `template_type` discriminator to campaigns would pollute campaign queries, require filter exclusions everywhere (as `ab_variant` already does), and mix delivery-related columns (status, sent_at, total_recipients) with static template data. Use a dedicated `templates` table.
- **Storing Resend API key in localStorage or component state only:** Persist to the `profiles` table so it survives page refreshes. Supabase RLS (SELECT/UPDATE scoped to `auth.uid()`) provides row-level access control.
- **Adding all new settings columns to a separate `workspace_settings` table:** The workspace-to-user ratio is currently 1:1 (MVP). Adding 4 columns to `profiles` is simpler, avoids a JOIN, and aligns with the existing pattern (company_name, timezone are already on profiles). A dedicated table would be appropriate only for multi-user workspaces (v2 scope).
- **Nested routes for settings tabs:** Using `/settings/profile`, `/settings/workspace`, `/settings/integrations` as separate routes adds Outlet nesting and route declarations without benefit. `useSearchParams` achieves the same linkable tab state with less boilerplate.
- **Fetching templates inside CampaignBuilderPage unconditionally:** Only fetch a template when `fromTemplateId` is present in query params. Don't add a template fetch to every campaign builder load.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Row-level access control on templates | Custom workspace_id filter in every query | Supabase RLS policy matching all prior table patterns | RLS enforces at DB level; forgetting a .eq() filter is a security hole |
| "bullet mask" for stored API key display | Custom character replacement | CSS `input type="password"` with controlled value | Browser handles masking, autofill, screen reader semantics |
| URL tab state | Custom localStorage or React state | `useSearchParams` from React Router v7 | Linkable, bookmarkable, no persistence side-effects |
| Toast notifications | Custom notification system | Existing `useToast()` / `showToast()` | Already wired app-wide in `ToastProvider` |
| Modal backdrop / click-outside | Custom event listeners | Inline state + `data-no-list-click` pattern already in app | Consistent with established pattern; avoids portal complexity |

**Key insight:** This phase is entirely within the existing stack's capabilities. Every pattern (table layout, row actions, modals, form saves, RLS migrations) has a direct precedent in earlier phases.

---

## DB Schema Decisions (Claude's Discretion)

### Templates Table — New dedicated table (recommended)

```sql
-- Migration 009_templates_settings.sql

-- ── templates table ──
CREATE TABLE public.templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL,
  name          TEXT NOT NULL,
  subject       TEXT NOT NULL DEFAULT '',
  preview_text  TEXT,
  from_name     TEXT NOT NULL DEFAULT '',
  from_email    TEXT NOT NULL DEFAULT '',
  body_html     TEXT NOT NULL DEFAULT '',
  body_json     JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_templates_workspace ON public.templates(workspace_id);
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their templates"
  ON public.templates FOR ALL
  USING (workspace_id = (SELECT workspace_id FROM profiles WHERE id = auth.uid()));
```

**Why not reuse `campaigns` table:** Campaigns carry delivery state (status, sent_at, recipient counts, campaign_type, contact_list_id). Templates are static content snapshots with no delivery lifecycle. Mixing them adds complexity to every campaign list query and continues the `ab_variant` exclusion pattern.

**Why no `deleted_at`:** Templates have no referential integrity requirements (no FKs point to them from other tables). Hard delete is correct — simpler queries, no soft-delete guard needed.

### Profiles Table Extension — Add 4 columns (recommended)

```sql
-- Extend profiles for workspace defaults and integrations
ALTER TABLE public.profiles
  ADD COLUMN default_sender_name     TEXT,
  ADD COLUMN default_sender_email    TEXT,
  ADD COLUMN resend_api_key          TEXT,
  ADD COLUMN unsubscribe_footer_text TEXT DEFAULT 'To unsubscribe, click here: {{unsubscribe_url}}';
```

**Why not a separate `workspace_settings` table:** Workspace = user at MVP (1:1). The existing `profiles` table already holds `company_name` and `timezone` — the pattern is established. Joining two tables for every settings page load adds complexity with no current benefit. When multi-user workspaces arrive (v2), the columns can migrate to a proper workspace table in a later migration.

**Note on `resend_api_key` security:** Storing API keys in plaintext in a Postgres TEXT column is acceptable for an MVP where users store their own key (not a shared secret). Supabase RLS scopes SELECT/UPDATE to `auth.uid() = id`, so no other user can read the key. For production hardening, Supabase Vault (secrets management) would encrypt at rest — but that is v2 scope.

[ASSUMED: Supabase Vault not required for MVP based on existing pattern of storing API keys in profiles tables in MVP-stage SaaS. Risk: medium if compliance is required in future.]

---

## Common Pitfalls

### Pitfall 1: Sidebar NavLink active state mismatch after settings restructure

**What goes wrong:** The Settings NavLink in Sidebar.tsx currently points to `/settings/profile`. After the restructure, it points to `/settings`. NavLink's `isActive` check in React Router v7 uses path prefix matching by default — `/settings` will still match `/settings/profile` (the redirect source), but `/settings/profile` will NOT match `/settings` for the new route.

**Why it happens:** NavLink `isActive` by default uses an exact match for React Router v7 leaf routes. When the route changes from `/settings/profile` to `/settings?tab=profile`, the NavLink target must be updated.

**How to avoid:** Update Sidebar navItems entry for Settings from `'/settings/profile'` to `'/settings'` and update `pageTitles` in AppLayout.tsx.

**Warning signs:** Settings link doesn't highlight as active when on the settings page.

### Pitfall 2: `populated` guard conflict in CampaignBuilderPage when using both `id` param and `from_template` param

**What goes wrong:** CampaignBuilderPage uses a `populated` state guard to prevent re-populating the form on re-renders. If `from_template` pre-fill runs first and sets `populated = true`, a subsequent render triggered by `useCampaign(id)` won't re-populate even if there's an actual campaign being edited.

**Why it happens:** Both the edit-mode populate effect (`if (campaign && !populated && editor)`) and the template pre-fill effect share the same `populated` flag. They run independently.

**How to avoid:** The `/campaigns/new` route has no `:id` param, so `useCampaign(undefined)` returns no data and the campaign populate effect never fires. The `from_template` param only appears on `/campaigns/new`, never on `/campaigns/:id/edit`. No conflict exists in practice — but be explicit about this separation in code comments.

**Warning signs:** Form appears empty when navigating with `?from_template=<id>`.

### Pitfall 3: Template name modal opened from CampaignBuilderPage when campaign has no name yet

**What goes wrong:** If the user hasn't typed a campaign name yet (field shows placeholder "Campaign name..."), `name` state is empty string `''`. The modal would default the template name to `''`.

**Why it happens:** The name field in CampaignBuilderPage is a plain `<input>` with an empty initial state, not a DB-backed value until saved.

**How to avoid:** Pass `name || 'Untitled campaign'` as the default template name to the modal. Match the existing pattern in `handleSaveDraft`.

**Warning signs:** Modal opens with empty name input, user saves a nameless template.

### Pitfall 4: Resend API key update — always-overwrite vs. dirty-only update

**What goes wrong:** If the save handler always sends the API key field value to Supabase UPDATE, and the user saves the Workspace or Profile tab without touching the Integrations tab, the masked placeholder value `''` could overwrite an existing key.

**Why it happens:** Each settings tab should save only its own fields. But if a single `handleSave` covers all tabs, the API key field (empty when masked) gets included.

**How to avoid:** Each tab has its own save button and its own update handler. The Integrations tab save handler only updates `resend_api_key` if `apiKeyDirty === true`.

**Warning signs:** API key disappears after saving from another tab.

### Pitfall 5: AppLayout pageTitles — dynamic tab names

**What goes wrong:** AppLayout uses `pageTitles[location.pathname]` for the header title. `/settings` with `?tab=workspace` would show the same generic "Settings" title regardless of active tab — or no title if `/settings` isn't in pageTitles.

**Why it happens:** pageTitles is a static Record keyed on pathname only, ignoring search params.

**How to avoid:** Add `/settings` to pageTitles as `'Settings'`. For per-tab titles in the header, the SettingsPage can render its own `<h1>` or the tab component can set an appropriate section heading — no need to update AppLayout's header for this level of detail.

**Warning signs:** Header shows "MailOps" instead of "Settings".

---

## Code Examples

Verified patterns from the existing codebase:

### Table layout with row actions (Templates page — mirrors CampaignsPage)
```typescript
// Source: CampaignsPage.tsx [VERIFIED: lines 127-254]
<Card padding="sm" className="overflow-hidden p-0">
  <div className="overflow-x-auto">
    <table className="w-full">
      <thead>
        <tr className="border-b border-gray-800">
          <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-900 px-4 py-3 text-left">
            Template name
          </th>
          <th className="...">Subject line</th>
          <th className="...">Date saved</th>
          <th className="... w-12" />
        </tr>
      </thead>
      <tbody>
        {templates.map((template) => (
          <tr key={template.id} className="border-b border-gray-800 hover:bg-gray-800/50">
            <td className="px-4 py-3 text-sm font-semibold text-gray-100">{template.name}</td>
            <td className="px-4 py-3 text-sm text-gray-300">{template.subject}</td>
            <td className="px-4 py-3 text-sm text-gray-400">
              {new Date(template.created_at).toLocaleDateString()}
            </td>
            <td className="px-4 py-3 relative" data-no-list-click>
              {/* row action buttons */}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</Card>
```

### Hook pattern (useTemplates — mirrors useSequences)
```typescript
// Source: useSequences.ts [VERIFIED: lines 1-40]; useTemplates follows same shape
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../useAuth'
import type { Template, TemplateInsert } from '../../types/database'

export function useTemplates() {
  const { profile } = useAuth()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTemplates = useCallback(async () => {
    if (!profile?.workspace_id) return
    setLoading(true)
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .eq('workspace_id', profile.workspace_id)
      .order('created_at', { ascending: false })
    if (!error) setTemplates((data as Template[]) ?? [])
    setLoading(false)
  }, [profile?.workspace_id])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  const createTemplate = async (tmpl: Omit<TemplateInsert, 'workspace_id'>) => {
    if (!profile?.workspace_id) return { data: null, error: 'Not authenticated' }
    const { data, error } = await supabase
      .from('templates')
      .insert({ ...tmpl, workspace_id: profile.workspace_id })
      .select()
      .single()
    if (error) return { data: null, error: error.message }
    await fetchTemplates()
    return { data: data as Template, error: null }
  }

  const deleteTemplate = async (id: string) => {
    if (!profile?.workspace_id) return { error: 'Not authenticated' }
    const { error } = await supabase
      .from('templates')
      .delete()
      .eq('id', id)
      .eq('workspace_id', profile.workspace_id)
    if (error) return { error: error.message }
    await fetchTemplates()
    return { error: null }
  }

  return { templates, loading, fetchTemplates, createTemplate, deleteTemplate }
}
```

### RLS migration pattern (matches 008_sequences.sql)
```sql
-- Source: 008_sequences.sql [VERIFIED: lines 24-27]
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their templates"
  ON public.templates FOR ALL
  USING (workspace_id = (SELECT workspace_id FROM profiles WHERE id = auth.uid()));
```

### Settings tab UI skeleton
```typescript
// Source: [ASSUMED — useSearchParams tab pattern, React Router v7]
const TABS = [
  { key: 'profile', label: 'Profile' },
  { key: 'workspace', label: 'Workspace' },
  { key: 'integrations', label: 'Integrations' },
] as const

// Tab nav:
<div className="flex gap-0 border-b border-gray-800 mb-6">
  {TABS.map(({ key, label }) => (
    <button
      key={key}
      onClick={() => switchTab(key)}
      className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
        activeTab === key
          ? 'border-indigo-500 text-indigo-400'
          : 'border-transparent text-gray-400 hover:text-gray-200'
      }`}
    >
      {label}
    </button>
  ))}
</div>
```

### Profile update pattern (from ProfilePage — reuse verbatim)
```typescript
// Source: ProfilePage.tsx [VERIFIED: lines 28-61]
const handleSubmit = async (e: FormEvent) => {
  e.preventDefault()
  setLoading(true)
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: fullName || null,
      company_name: companyName || null,
      timezone,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user?.id ?? '')
  setLoading(false)
  if (error) {
    showToast(error.message, 'error')
  } else {
    showToast('Profile saved successfully')
    await refreshProfile()
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate `/settings/profile` route | Unified `/settings?tab=profile` | This phase | Route declaration simplification; redirect needed |
| ProfilePage standalone | Absorbed into SettingsPage Profile tab | This phase | ProfilePage becomes the tab content component or is refactored inline |
| No template concept | Dedicated `templates` table | This phase | Clean separation from campaigns |

**Deprecated/outdated after this phase:**
- `/settings/profile` route: Replaced by redirect `/settings/profile` → `/settings` (React Router `<Navigate>`)
- `PlaceholderPage` at `/templates`: Replaced by real `TemplatesPage`

---

## Open Questions

1. **Should `ProfilePage.tsx` be deleted or reused as the Profile tab component?**
   - What we know: ProfilePage.tsx contains all the Profile tab content (full name, company name, timezone, email, workspace ID). It currently renders at `/settings/profile`.
   - What's unclear: The planner must choose between (a) keeping ProfilePage as a standalone component and rendering it inside SettingsPage's Profile tab, or (b) inlining its JSX into SettingsPage.
   - Recommendation: Keep ProfilePage as a reusable component and render it as the Profile tab's content. This minimizes diff and reuse is idiomatic in this codebase.

2. **Delete confirmation for templates — window.confirm or modal?**
   - What we know: CampaignsPage uses `window.confirm()` for delete (lines 74-76). CampaignsPage also marks this as discretionary in the CONTEXT (Claude's Discretion).
   - What's unclear: User hasn't specified.
   - Recommendation: Follow the established `window.confirm()` pattern from CampaignsPage for consistency. No need for a modal.

3. **Should `unsubscribe_footer_text` default be set?**
   - What we know: The column is new; no existing value exists for current users.
   - What's unclear: Whether a hardcoded default or null is preferable.
   - Recommendation: Set `DEFAULT 'To unsubscribe from future emails, click here: {{unsubscribe_url}}'` in the migration. Existing users get a sensible placeholder on the Integrations tab.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 7 is purely frontend code + SQL migration changes. No external CLI tools, services, or runtimes beyond the project's existing stack are required. Supabase project is live (confirmed in MEMORY.md: project ID `pozqnzhgqmajtaidtpkk`). No new deployments needed.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected |
| Config file | None — no vitest.config.*, jest.config.*, pytest.ini found |
| Quick run command | `npm run lint` (TypeScript type-check: `tsc --noEmit`) |
| Full suite command | `npm run build` (catches type errors end-to-end) |

[VERIFIED: package.json scripts contain only `dev`, `build`, `lint`, `preview`]

No automated test infrastructure exists in this project. The nyquist_validation setting is enabled in config.json, but there is no test runner installed. The validation strategy for this project relies on:
- TypeScript strict-mode compilation (`tsc -b` in the build script)
- ESLint (`npm run lint`)
- Manual browser verification

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TMPL-01 | Save campaign as template modal opens, inserts to DB | manual | `npm run build` (type safety) | N/A |
| TMPL-02 | Templates page loads and displays rows | manual | `npm run build` | N/A |
| TMPL-03 | "Use template" navigates with pre-fill | manual | `npm run build` | N/A |
| TMPL-04 | Delete template removes from list | manual | `npm run build` | N/A |
| SETT-01 | Workspace tab saves default sender fields | manual | `npm run build` | N/A |
| SETT-02 | Integrations tab saves/masks API key | manual | `npm run build` | N/A |
| SETT-03 | Sending domain shown as read-only | manual | `npm run build` | N/A |
| SETT-04 | Unsubscribe footer text saves | manual | `npm run build` | N/A |

### Sampling Rate
- **Per task commit:** `npm run lint`
- **Per wave merge:** `npm run build`
- **Phase gate:** Full build green + manual browser smoke test before `/gsd-verify-work`

### Wave 0 Gaps
None — no test framework installation needed; project intentionally has no automated tests. Lint and type-checking are the validation layer.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Supabase auth already handles this |
| V3 Session Management | no | Supabase handles session lifecycle |
| V4 Access Control | yes | Supabase RLS on `templates` and `profiles` (existing pattern) |
| V5 Input Validation | yes | TypeScript types + Supabase column constraints |
| V6 Cryptography | low | Resend API key stored as plaintext TEXT — acceptable for MVP; Supabase Vault deferred to v2 |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Workspace ID injection (user modifies workspace_id before insert) | Tampering | RLS policy enforces `workspace_id = (SELECT workspace_id FROM profiles WHERE id = auth.uid())` — same as all prior tables |
| API key exfiltration via template-scoped query leak | Information Disclosure | RLS on profiles scoped to `auth.uid() = id`; never expose resend_api_key in a template fetch |
| Cross-workspace template access | Elevation of Privilege | RLS blocks; always `.eq('workspace_id', profile.workspace_id)` in hook queries as defense-in-depth |
| API key logged in browser DevTools network tab | Information Disclosure | No logging in this codebase (per CONVENTIONS.md); key only sent in profiles UPDATE body (HTTPS) |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `useSearchParams` is the standard tab-routing pattern for React Router v7 single-page tab UIs | Architecture Patterns | Low — alternative is nested routes, which are more work but also correct |
| A2 | Hard delete (not soft delete) is correct for templates | DB Schema Decisions | Low — no other table FKs reference templates; worst case is a one-line migration to add deleted_at |
| A3 | Storing resend_api_key as plaintext TEXT on profiles is acceptable for MVP | Security Domain | Medium — if compliance or audit requirement exists, Supabase Vault encryption would be needed |
| A4 | `unsubscribe_footer_text` default value format with `{{unsubscribe_url}}` placeholder | DB Schema Decisions | Low — content is user-editable; wrong default is cosmetic only |
| A5 | `window.confirm()` is the preferred delete confirmation pattern for templates | Common Pitfalls / Open Questions | Low — follows CampaignsPage precedent; planner can choose a modal if preferred |

---

## Sources

### Primary (HIGH confidence)
- Codebase: `src/pages/campaigns/CampaignsPage.tsx` — row action pattern, dropdown menu, table layout [VERIFIED]
- Codebase: `src/pages/campaigns/CampaignBuilderPage.tsx` — populated guard, pre-fill pattern, header action area [VERIFIED]
- Codebase: `src/hooks/campaigns/useCampaigns.ts` — hook shape for list + mutations [VERIFIED]
- Codebase: `src/hooks/sequences/useSequences.ts` — canonical hook pattern for new domain hooks [VERIFIED]
- Codebase: `src/pages/settings/ProfilePage.tsx` — existing settings form, update pattern, refreshProfile usage [VERIFIED]
- Codebase: `src/types/database.ts` — all interfaces, Database map, existing Profile fields [VERIFIED]
- Codebase: `src/App.tsx` — current route declarations, existing `/settings/profile` route [VERIFIED]
- Codebase: `src/components/layout/Sidebar.tsx` — navItems, `/settings/profile` link to update [VERIFIED]
- Codebase: `src/components/layout/AppLayout.tsx` — pageTitles map [VERIFIED]
- Codebase: `supabase/migrations/008_sequences.sql` — RLS migration pattern, column additions [VERIFIED]
- Codebase: `supabase/migrations/007_ab_test_columns.sql` — ALTER TABLE column addition pattern [VERIFIED]
- Codebase: `package.json` — no test runner scripts; build/lint only [VERIFIED]

### Secondary (MEDIUM confidence)
- React Router DOM v7 `useSearchParams` for tab state — well-established pattern documented in React Router v7 API [ASSUMED based on training knowledge of React Router v7 API]

### Tertiary (LOW confidence)
- None — all major claims are grounded in the verified codebase

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all verified from package.json
- DB schema decisions: HIGH — patterns directly from existing migrations; discretion areas documented with rationale
- Architecture patterns: HIGH — all patterns have direct codebase precedents (CampaignsPage, useSequences, ProfilePage)
- Pitfalls: HIGH — all identified from actual code inspection (populated guard in CampaignBuilderPage, pageTitles in AppLayout, etc.)
- Security: MEDIUM — ASVS mapping is ASSUMED training knowledge; RLS pattern is VERIFIED from existing migrations

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (stable stack, no external API changes expected)
