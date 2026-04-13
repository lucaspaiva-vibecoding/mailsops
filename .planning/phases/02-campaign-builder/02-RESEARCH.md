# Phase 2: Campaign Builder - Research

**Researched:** 2026-04-13
**Domain:** TipTap rich text editor, custom ProseMirror Node extensions, Supabase Edge Functions, campaign CRUD, React Router v7
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Editor (CAMP-02)**
- D-01: Use TipTap (already installed as `@tiptap/core`, `@tiptap/react`, `@tiptap/starter-kit`) — no new editor library
- D-02: Editor is full-width within the campaign builder form
- D-03: Toolbar includes: Bold, Italic, Links, Images (insert by URL) — plus headings and bullet lists from StarterKit
- D-04: No drag-and-drop block editor — flat rich text only

**Personalization Variables (CAMP-03)**
- D-05: Variables inserted via a dropdown button in the toolbar OR via `/` command (slash command in the editor body)
- D-06: Available variables: `{{first_name}}`, `{{last_name}}`, `{{company}}`
- D-07: Variables can appear in both the subject line (plain text input) and the email body (editor)
- D-08: Variables are rendered as styled inline chips in the editor so they're visually distinct from regular text (but stored as raw `{{variable}}` string in the DB)

**Preview Mode (CAMP-02, CAMP-03)**
- D-09: Toggle between "Edit" and "Preview" mode — not side-by-side
- D-10: Preview mode renders the email HTML with sample data substituted: `{{first_name}}` → "Alex", `{{last_name}}` → "Smith", `{{company}}` → "Acme Corp"
- D-11: Preview is shown in a styled email-like container (white background, max-width ~600px, centered)

**Scheduling (CAMP-05)**
- D-12: "Send now" option (immediate dispatch, status set to `queued`) vs "Schedule for later" (date/time picker)
- D-13: Date/time picker: native `<input type="datetime-local">` — no third-party date library
- D-14: Timezone: user selects from a dropdown of common timezones (same `TIMEZONES` constant already defined in the codebase)
- D-15: Scheduled datetime stored in UTC in the DB; timezone only affects the UI display

**Test Send (CAMP-06)**
- D-16: "Send test email" button sends the email to the currently authenticated user's email address
- D-17: Test send uses Resend API directly from a Supabase Edge Function
- D-18: Toast feedback on success/failure; no separate test send history UI

**Campaign List & Drafts (CAMP-07, CAMP-08)**
- D-19: `/campaigns` route shows a list of all campaigns (name, status badge, target list, scheduled/sent date)
- D-20: Campaign statuses: `draft`, `scheduled`, `queued`, `sent`, `failed`
- D-21: Clicking a campaign row opens the campaign builder in edit mode
- D-22: "Duplicate" action creates a copy with status `draft` and name prefixed "Copy of …"
- D-23: Unsaved changes prompt (browser `beforeunload`) if user navigates away while editing

**Campaign Builder Layout (CAMP-01)**
- D-24: Single-page form layout — all fields visible at once with sections: Details, Content, Target & Schedule
- D-25: Fields: Campaign name, Subject line, Preview text, Sender name, Sender email, Contact list selector, Schedule, Email body editor
- D-26: "Save draft" and "Schedule / Send" are the two primary action buttons at the bottom of the form

### Claude's Discretion
- Campaign builder route: `/campaigns/new` for creating, `/campaigns/:id/edit` for editing
- Subject line and preview text: plain text `<input>` fields (not rich text)
- Contact list selector: `<select>` dropdown populated from `useContactLists()` hook (Phase 1)
- Image insertion in editor: URL-based only (no file upload in this phase)
- Empty state on `/campaigns`: friendly prompt to create first campaign

### Deferred Ideas (OUT OF SCOPE)
- Side-by-side edit/preview layout
- File upload for images in editor
- Rich variable editor with fallback values (e.g., `{{first_name | "there"}}`)
- Campaign send history / delivery stats (Phase 3 and Phase 4)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAMP-01 | User can create a campaign with name, subject line, preview text, sender name, and sender email | Campaign interface + useCampaigns hook CRUD pattern confirmed; campaigns table schema verified in schema-v1.md |
| CAMP-02 | User can build email body with TipTap rich text editor (bold, italic, links, headings, bullets, images) | TipTap 2.27.2 installed; StarterKit covers bold/italic/headings/bullets; extension-link and extension-image need installation at matching version 2.27.2 |
| CAMP-03 | User can insert personalization variables into subject or body | Custom Node extension pattern confirmed via ReactNodeViewRenderer + NodeViewWrapper API in installed version; variable chip rendering pattern documented |
| CAMP-04 | User can select a contact list as campaign target | useContactLists hook confirmed working in Phase 1; returns `{ lists, loading, error }` |
| CAMP-05 | User can schedule a campaign for future delivery | Native datetime-local input + TIMEZONES constant (17 timezones in ProfilePage.tsx) — no third-party date lib needed |
| CAMP-06 | User can send a test email to their own address before launching | Supabase Edge Function (Deno) + supabase.functions.invoke() API confirmed in supabase-js 2.103.0 |
| CAMP-07 | User can save campaign as draft and return to edit later | status: 'draft' column in campaigns table; useCampaign single-fetch hook for edit mode |
| CAMP-08 | User can duplicate an existing campaign | Duplicate = insert new row, status 'draft', name prefixed "Copy of …" — pure DB insert |
</phase_requirements>

---

## Summary

Phase 2 builds the campaign creation and editing experience on top of a fully-specified stack. The three hardest technical challenges are: (1) the TipTap custom Node extension for variable chips — requires `ReactNodeViewRenderer` and `NodeViewWrapper` from `@tiptap/react`, both confirmed present in installed version 2.27.2; (2) installing missing TipTap extensions (`extension-link`, `extension-image`, `extension-placeholder`) at the exact same version 2.27.2 to avoid peer dependency conflicts; and (3) authoring the Supabase Edge Function for test send (Deno TypeScript) and invoking it via `supabase.functions.invoke()`.

The campaign CRUD pattern follows Phase 1's hook architecture exactly: `useCampaigns` for list/create/update/duplicate (mirrors `useContactLists`), `useCampaign` for single-record fetch/update in builder mode (mirrors `useContacts` single-item pattern). The database schema for campaigns is already live in production — no migration is needed for the `campaigns` table itself, only for any RLS policies not yet applied.

The UI contract is locked in `02-UI-SPEC.md` with pixel-level detail. Research confirms that all referenced component APIs (Button, Card, Badge, Input, Toast, Spinner) match the locked spec. The `TIMEZONES` constant lives locally in `ProfilePage.tsx` and must be extracted to a shared constant file for reuse in `SchedulingSection`.

**Primary recommendation:** Install the three missing TipTap extensions at 2.27.2 in Wave 0, then build in order: TypeScript types → data hooks → CampaignsPage (list) → CampaignBuilderPage (form shell) → TipTap editor + VariableChipNode → SchedulingSection → TestSendSection → Edge Function → routes wired in App.tsx.

---

## Standard Stack

### Core (already installed — do not re-install)

| Library | Installed Version | Purpose | Verified |
|---------|------------------|---------|----------|
| `@tiptap/core` | 2.27.2 | ProseMirror wrapper, Node/Extension/Mark base classes | [VERIFIED: node_modules] |
| `@tiptap/react` | 2.27.2 | EditorContent, useEditor, ReactNodeViewRenderer, NodeViewWrapper | [VERIFIED: node_modules] |
| `@tiptap/starter-kit` | 2.27.2 | Bundled: Bold, Italic, Heading, BulletList, OrderedList, Blockquote, Code, CodeBlock, History, HardBreak, HorizontalRule, Strike | [VERIFIED: node_modules] |
| `@supabase/supabase-js` | 2.103.0 | supabase.functions.invoke() for Edge Function call | [VERIFIED: node_modules] |
| `react-router-dom` | 7.5.3 | useParams, useNavigate for /campaigns/:id/edit | [VERIFIED: package.json] |
| `lucide-react` | 0.511.0 | Bold, Italic, Link2, Image, Heading1, Heading2, List, Variable, Send icons | [VERIFIED: package.json] |

**Important version note:** `package.json` declares `@tiptap/core: ^2.11.5` but the installed version in `node_modules` is 2.27.2. The `^` range allowed npm to resolve a newer minor. All new TipTap extensions MUST be installed at 2.27.2 to match. [VERIFIED: node_modules/@tiptap/core/package.json]

### Required New Packages (must install in Wave 0)

| Library | Target Version | Purpose | Why Needed |
|---------|---------------|---------|------------|
| `@tiptap/extension-link` | 2.27.2 | Hyperlink support with popover | D-03: Links in toolbar; NOT in StarterKit |
| `@tiptap/extension-image` | 2.27.2 | URL-based image insertion | D-03: Images in toolbar; NOT in StarterKit |
| `@tiptap/extension-placeholder` | 2.27.2 | "Write your email content here..." placeholder | UI-SPEC: editor placeholder text |

All three confirmed to exist on npm at version 2.27.2. [VERIFIED: npm view]

**Installation command:**
```bash
npm install @tiptap/extension-link@2.27.2 @tiptap/extension-image@2.27.2 @tiptap/extension-placeholder@2.27.2
```

Peer dependency check: all three require `@tiptap/core ^2.7.0` and/or `@tiptap/pm ^2.7.0` — satisfied by installed 2.27.2. [VERIFIED: npm view peerDependencies]

### Alternatives Considered

| Instead of | Could Use | Why We Don't |
|------------|-----------|--------------|
| TipTap custom Node | Store variables as HTML span with contenteditable=false | TipTap's Node API gives correct serialization to HTML/JSON; raw span approach breaks editor serialization |
| supabase.functions.invoke() | fetch() to Edge Function URL directly | invoke() handles auth headers automatically; locked decision D-17 |
| Native datetime-local input | react-datepicker, date-fns | Locked decision D-13; no date library allowed |

---

## Architecture Patterns

### Recommended File Structure

```
src/
├── hooks/
│   └── campaigns/
│       ├── useCampaigns.ts       # list/create/duplicate/delete — mirrors useContactLists.ts
│       └── useCampaign.ts        # single fetch + update — for builder edit mode
├── pages/
│   └── campaigns/
│       ├── CampaignsPage.tsx     # /campaigns — list view
│       └── CampaignBuilderPage.tsx  # /campaigns/new + /campaigns/:id/edit
├── components/
│   └── campaigns/
│       ├── CampaignEditorToolbar.tsx  # TipTap toolbar
│       ├── VariableDropdown.tsx        # variable insertion UI
│       ├── VariableChipNode.tsx        # custom TipTap Node extension
│       ├── CampaignPreview.tsx         # preview mode with sample substitution
│       ├── SchedulingSection.tsx       # send-now / schedule-later UI
│       └── TestSendSection.tsx         # test send button + feedback
├── types/
│   └── database.ts               # ADD: Campaign, CampaignInsert, CampaignUpdate interfaces
└── supabase/
    └── functions/
        └── send-test-email/
            └── index.ts          # Deno Edge Function — Resend API call
```

**Constant extraction required:** `TIMEZONES` is currently declared locally in `ProfilePage.tsx`. It must be extracted to `src/lib/constants.ts` (or `src/lib/timezones.ts`) so both `ProfilePage` and `SchedulingSection` can import it without duplication.

### Pattern 1: Campaign Data Hook (mirrors useContactLists)

```typescript
// src/hooks/campaigns/useCampaigns.ts
// Source: follows useContactLists.ts pattern exactly [VERIFIED: codebase]

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../useAuth'
import type { Campaign } from '../../types/database'

export function useCampaigns() {
  const { profile } = useAuth()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCampaigns = useCallback(async () => {
    if (!profile?.workspace_id) return
    setLoading(true)
    setError(null)
    const { data, error: fetchError } = await supabase
      .from('campaigns')
      .select('*, contact_lists(name)')  // join for target list name in table
      .eq('workspace_id', profile.workspace_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    if (fetchError) setError(fetchError.message)
    else setCampaigns((data as Campaign[]) ?? [])
    setLoading(false)
  }, [profile?.workspace_id])

  useEffect(() => { fetchCampaigns() }, [fetchCampaigns])

  const createCampaign = async (input: CampaignInsert) => { ... }
  const updateCampaign = async (id: string, updates: CampaignUpdate) => { ... }
  const deleteCampaign = async (id: string) => { ... }  // soft delete: deleted_at
  const duplicateCampaign = async (campaign: Campaign) => { ... }  // insert copy

  return { campaigns, loading, error, refetch: fetchCampaigns, createCampaign, updateCampaign, deleteCampaign, duplicateCampaign }
}
```

### Pattern 2: TipTap Editor Setup (useEditor)

```typescript
// Source: TipTap official API — useEditor + EditorContent [VERIFIED: node_modules types]
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import { VariableChipNode } from './VariableChipNode'

const editor = useEditor({
  extensions: [
    StarterKit,
    Link.configure({ openOnClick: false }),
    Image,
    Placeholder.configure({ placeholder: 'Write your email content here...' }),
    VariableChipNode,
  ],
  content: campaign?.body_json ?? '',
  onUpdate: ({ editor }) => {
    setBodyHtml(editor.getHTML())
    setBodyJson(editor.getJSON())
  },
})
```

**Key API methods confirmed in installed types:**
- `editor.getHTML()` — returns HTML string for `body_html` DB column [VERIFIED: Editor.d.ts]
- `editor.getJSON()` — returns JSONContent for `body_json` DB column [VERIFIED: Editor.d.ts]
- `editor.chain().focus().insertContent(node).run()` — for variable insertion
- `editor.isEmpty` — for form validation (body required check)

### Pattern 3: Custom TipTap Node Extension (VariableChipNode)

```typescript
// src/components/campaigns/VariableChipNode.tsx
// Source: TipTap Node + ReactNodeViewRenderer pattern [VERIFIED: node_modules types]
import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'

// React component rendered as the chip
function VariableChipComponent({ node }: { node: any }) {
  return (
    <NodeViewWrapper as="span" className="inline">
      <span
        contentEditable={false}
        aria-label={`${node.attrs.variable} — personalization variable`}
        className="inline-flex items-center bg-indigo-900 text-indigo-200 rounded px-1 text-sm font-mono mx-0.5 select-none"
      >
        {node.attrs.variable}
      </span>
    </NodeViewWrapper>
  )
}

export const VariableChipNode = Node.create({
  name: 'variableChip',
  group: 'inline',
  inline: true,
  atom: true,            // atom = true means non-editable, cursor cannot go inside

  addAttributes() {
    return {
      variable: { default: null },  // e.g. '{{first_name}}'
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-variable]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-variable': '' }), HTMLAttributes.variable]
    // CRITICAL: renderHTML must output the raw {{variable}} text so body_html contains
    // the raw string (not chip HTML) when read by the delivery engine
  },

  addNodeView() {
    return ReactNodeViewRenderer(VariableChipComponent)
  },
})
```

**Critical serialization note:** `renderHTML` controls what `editor.getHTML()` outputs. The chip MUST serialize to the raw `{{variable_name}}` string in HTML (not the chip's `<span>` markup) so the delivery engine can substitute it. The visual chip is only a NodeView (React rendering layer); the underlying ProseMirror document stores and serializes the raw variable string. [ASSUMED — verify renderHTML output in tests]

**Alternative approach (simpler):** Store variables as plain text `{{first_name}}` in the ProseMirror doc and use a Decoration (not a Node) for visual chip rendering. Decorations don't affect serialization at all — the raw text is always what gets stored. This avoids the serialization complexity but is harder to make non-editable (atom). The CONTEXT.md spec chose Node for the non-editable atom behavior. [ASSUMED]

### Pattern 4: Supabase Edge Function Invocation

```typescript
// Frontend call (from TestSendSection.tsx)
// Source: supabase-js 2.103.0 installed [VERIFIED: node_modules]
const { data, error } = await supabase.functions.invoke('send-test-email', {
  body: {
    campaignId: campaign.id,
    recipientEmail: user?.email,
  },
})
```

```typescript
// supabase/functions/send-test-email/index.ts (Deno)
// Source: Supabase Edge Function pattern [ASSUMED — based on Supabase docs pattern]
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

serve(async (req) => {
  const { campaignId, recipientEmail } = await req.json()

  // Call Resend API
  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${campaign.from_name} <${campaign.from_email}>`,
      to: [recipientEmail],
      subject: `[TEST] ${campaign.subject}`,
      html: campaign.body_html,
    }),
  })

  if (!resendResponse.ok) {
    return new Response(JSON.stringify({ error: 'Resend API error' }), { status: 500 })
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200 })
})
```

**Edge Function infrastructure note:** There is no `supabase/functions/` directory yet. It must be created. The Supabase CLI is NOT installed on this machine (verified). The Edge Function file can be authored and committed; it must be deployed via the Supabase dashboard or CI. The planner should note this as a manual deployment step. [VERIFIED: command -v supabase returned NOT FOUND]

### Pattern 5: React Router v7 Parameterized Route

```typescript
// App.tsx additions
// Source: follows existing route structure [VERIFIED: codebase]
<Route path="/campaigns" element={<CampaignsPage />} />
<Route path="/campaigns/new" element={<CampaignBuilderPage />} />
<Route path="/campaigns/:id/edit" element={<CampaignBuilderPage />} />
```

```typescript
// CampaignBuilderPage.tsx — detect new vs edit
import { useParams } from 'react-router-dom'
const { id } = useParams<{ id: string }>()
const isNew = !id
```

### Pattern 6: Soft Delete + Duplicate

```typescript
// Soft delete follows existing pattern [VERIFIED: useContactLists.ts deleteList]
const deleteCampaign = async (id: string) => {
  const { error } = await supabase
    .from('campaigns')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('workspace_id', profile.workspace_id)
  ...
}

// Duplicate: insert new row, copy all content fields, set status draft, prefix name
const duplicateCampaign = async (campaign: Campaign) => {
  const { error } = await supabase.from('campaigns').insert({
    workspace_id: profile.workspace_id,
    name: `Copy of ${campaign.name}`,
    status: 'draft',
    subject: campaign.subject,
    preview_text: campaign.preview_text,
    from_name: campaign.from_name,
    from_email: campaign.from_email,
    body_html: campaign.body_html,
    body_json: campaign.body_json,
    contact_list_id: campaign.contact_list_id,
  })
}
```

### Pattern 7: beforeunload Guard (Unsaved Changes)

```typescript
// CampaignBuilderPage.tsx — D-23
// Source: standard browser API [ASSUMED]
useEffect(() => {
  if (!isDirty) return
  const handler = (e: BeforeUnloadEvent) => {
    e.preventDefault()
    e.returnValue = ''  // required for Chrome
  }
  window.addEventListener('beforeunload', handler)
  return () => window.removeEventListener('beforeunload', handler)
}, [isDirty])
```

### Anti-Patterns to Avoid

- **Installing TipTap extensions at wrong version:** Installing `@tiptap/extension-link@latest` (currently 3.22.3 on npm) while `@tiptap/core` 2.27.2 is installed causes a peer dependency conflict and runtime errors. Always pin to 2.27.2.
- **Using editor.getHTML() for variable storage only (not body_json):** Both `body_html` and `body_json` must be saved. Phase 3 delivery uses `body_html` for Resend; future template loading uses `body_json` to restore editor state.
- **Setting `atom: false` on VariableChipNode:** Without `atom: true`, cursor can enter the chip and break the non-editable behavior. Always set `atom: true`.
- **Calling supabase.functions.invoke() without awaiting:** The function is async; missing await causes silent failures in test send.
- **Storing timezone in DB:** Timezone is display-only per D-15. Only `scheduled_at` (UTC) goes to DB. Never save timezone to the campaigns table.
- **Not extracting TIMEZONES:** Duplicating the TIMEZONES array in SchedulingSection creates drift from ProfilePage. Must extract to shared constant.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rich text editing | Custom contenteditable div | TipTap (already installed) | ProseMirror handles selection, paste, undo, input rules, markdown shortcuts |
| Variable chip in editor | Raw contenteditable=false span | TipTap Node extension (atom:true) | Handles cursor placement, selection, delete behavior, serialization correctly |
| Inline node rendering | Custom DOM manipulation | ReactNodeViewRenderer + NodeViewWrapper | React lifecycle, event handling, and re-render are managed by TipTap |
| Email delivery via Resend | Direct fetch from browser | Supabase Edge Function | RESEND_API_KEY must never be exposed to browser; server-side only |
| Pagination | Custom offset math | Supabase `.range(from, to)` (already used in useContacts) | Matches existing pattern; handles count header |
| UUID generation | Custom random string | Supabase auto-generates on insert | campaigns table uses `DEFAULT gen_random_uuid()` |

**Key insight:** TipTap's Node extension system handles all the hard parts of inline non-editable content. The only custom work is defining the schema (`group`, `inline`, `atom`, `addAttributes`) and the React view (`ReactNodeViewRenderer`). Do not attempt to replicate this with raw DOM manipulation.

---

## Common Pitfalls

### Pitfall 1: TipTap Version Mismatch
**What goes wrong:** Installing `@tiptap/extension-link` at the latest version (3.x) while `@tiptap/core` 2.27.2 is installed causes "Cannot find module" errors or silent extension failures.
**Why it happens:** npm `latest` tag now resolves to TipTap v3 (3.22.3 as of 2026-04-13). The installed core is 2.27.2.
**How to avoid:** Always pin: `npm install @tiptap/extension-link@2.27.2 @tiptap/extension-image@2.27.2 @tiptap/extension-placeholder@2.27.2`
**Warning signs:** TypeScript error "Module X has no exported member Y" or console error about missing schema node type.

### Pitfall 2: Variable Chip Serialization Producing Chip HTML Instead of Raw String
**What goes wrong:** `editor.getHTML()` outputs `<span data-variable="">{{first_name}}</span>` instead of `{{first_name}}`, so the delivery engine in Phase 3 cannot find and substitute the variable.
**Why it happens:** `renderHTML` in the Node extension controls HTML output. If `renderHTML` outputs the chip's full span markup, that's what gets stored in `body_html`.
**How to avoid:** `renderHTML` must output just the raw variable text node: `return ['span', { 'data-variable': '' }, node.attrs.variable]` where `node.attrs.variable` is `'{{first_name}}'`. Validate with `editor.getHTML()` in a test after implementing.
**Warning signs:** Preview substitution of `{{first_name}}` fails because the raw string is not present in `body_html`.

### Pitfall 3: Editor State Loss on Route Navigation
**What goes wrong:** User navigates from `/campaigns/new` to `/campaigns`, comes back, and the editor content is gone.
**Why it happens:** React Router unmounts the component; TipTap editor state is ephemeral.
**How to avoid:** This is expected behavior — drafts are always saved to DB via "Save draft" button. The `beforeunload` guard (D-23) warns the user before they lose unsaved changes.
**Warning signs:** Not a bug — document in UX that unsaved content is lost on navigation (prompt covers explicit navigation, not back button in all cases).

### Pitfall 4: useEditor Hook and React StrictMode Double Mount
**What goes wrong:** In React 19 StrictMode (enabled via `<React.StrictMode>` in main.tsx), `useEditor` may be called twice, causing two editor instances.
**Why it happens:** StrictMode intentionally double-invokes effects in development.
**How to avoid:** TipTap's `useEditor` handles StrictMode correctly as of 2.x — it destroys and recreates the editor. No special handling needed. [ASSUMED — verify if StrictMode is active in main.tsx]
**Warning signs:** Two editor instances visible in TipTap DevTools or duplicate onUpdate callbacks.

### Pitfall 5: datetime-local Min Value Timezone Mismatch
**What goes wrong:** Setting `min={new Date().toISOString()}` on a `datetime-local` input fails because `datetime-local` expects `YYYY-MM-DDTHH:mm` format (no seconds, no Z suffix), not a full ISO string.
**Why it happens:** `datetime-local` input has a specific string format requirement that differs from ISO 8601.
**How to avoid:**
```typescript
const now = new Date()
const minValue = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  .toISOString()
  .slice(0, 16)  // "2026-04-13T10:30"
```
**Warning signs:** Min attribute has no visible effect in the browser; user can select past dates.

### Pitfall 6: Supabase Edge Function CORS
**What goes wrong:** `supabase.functions.invoke()` call from browser fails with CORS error.
**Why it happens:** Supabase Edge Functions need CORS headers to accept browser requests. Default function scaffold does not include them.
**How to avoid:** Include CORS headers in the Edge Function response:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
// Handle OPTIONS preflight
if (req.method === 'OPTIONS') {
  return new Response('ok', { headers: corsHeaders })
}
```
**Warning signs:** Network tab shows OPTIONS request failing with 404 or CORS error; invoke() returns error immediately.

### Pitfall 7: TIMEZONES Duplication
**What goes wrong:** `SchedulingSection` re-declares the `TIMEZONES` array locally, diverging from ProfilePage's version.
**Why it happens:** TIMEZONES is currently a local constant in `ProfilePage.tsx` (confirmed by grep).
**How to avoid:** Extract to `src/lib/constants.ts` in Wave 0 or the first plan; import in both ProfilePage and SchedulingSection.
**Warning signs:** ESLint "no-duplicate-imports" or manual comparison reveals different timezone lists.

### Pitfall 8: contact_lists Join in useCampaigns
**What goes wrong:** Campaign list page needs to display the target list's name, but `campaigns` only stores `contact_list_id`.
**Why it happens:** Normalized schema — list name lives in `contact_lists` table.
**How to avoid:** Use PostgREST nested select: `.select('*, contact_lists(name, color)')` — Supabase resolves the FK join automatically. Result shape: `campaign.contact_lists.name`.
**Warning signs:** `campaign.contact_list_id` is a UUID but the UI needs a human-readable name.

---

## Code Examples

### TipTap Editor with All Extensions

```typescript
// Source: @tiptap/react useEditor API [VERIFIED: node_modules types]
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import { VariableChipNode } from './VariableChipNode'

const editor = useEditor({
  extensions: [
    StarterKit,
    Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-indigo-400 underline' } }),
    Image.configure({ inline: false, allowBase64: false }),
    Placeholder.configure({ placeholder: 'Write your email content here...' }),
    VariableChipNode,
  ],
  content: initialBodyJson ?? '',
  editorProps: {
    attributes: {
      class: 'min-h-[320px] p-4 text-gray-100 text-sm leading-relaxed bg-gray-900 focus:outline-none',
      'aria-label': 'Email body editor',
    },
  },
  onUpdate: ({ editor }) => {
    onBodyChange(editor.getHTML(), editor.getJSON())
  },
})
```

### Variable Insertion Command

```typescript
// Source: TipTap chain API [VERIFIED: node_modules types — insertContent accepts NodeSpec]
const insertVariable = (variableName: string) => {
  editor?.chain().focus().insertContent({
    type: 'variableChip',
    attrs: { variable: `{{${variableName}}}` },
  }).run()
}
```

### Preview Variable Substitution

```typescript
// Source: codebase pattern — simple string replace [ASSUMED]
const SAMPLE_DATA: Record<string, string> = {
  '{{first_name}}': 'Alex',
  '{{last_name}}': 'Smith',
  '{{company}}': 'Acme Corp',
}

function substituteVariables(html: string): string {
  return Object.entries(SAMPLE_DATA).reduce(
    (result, [variable, value]) => result.replaceAll(variable, value),
    html
  )
}
```

### TypeScript Campaign Types (to add to database.ts)

```typescript
// src/types/database.ts — additions for Phase 2
// Source: schema-v1.md §Module 3 [VERIFIED: docs/schema-v1.md]

export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'cancelled'

export interface Campaign {
  id: string
  workspace_id: string
  name: string
  status: CampaignStatus
  from_name: string
  from_email: string
  reply_to_email: string | null
  subject: string
  preview_text: string | null
  body_html: string
  body_json: Record<string, unknown> | null
  contact_list_id: string | null
  segment_filter: Record<string, unknown> | null
  scheduled_at: string | null
  sent_at: string | null
  total_recipients: number
  total_sent: number
  total_delivered: number
  total_opened: number
  total_clicked: number
  total_replied: number
  total_bounced: number
  total_unsubscribed: number
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type CampaignInsert = Omit<Campaign, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'total_recipients' | 'total_sent' | 'total_delivered' | 'total_opened' | 'total_clicked' | 'total_replied' | 'total_bounced' | 'total_unsubscribed'>

export type CampaignUpdate = Partial<Omit<Campaign, 'id' | 'workspace_id' | 'created_at' | 'updated_at' | 'deleted_at'>>
```

**Note on status enum mismatch:** `schema-v1.md` defines statuses `('draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled')`. The CONTEXT.md (D-20) lists `draft`, `scheduled`, `queued`, `sent`, `failed`. The DB schema wins — use the schema's enum. The UI should map `sending` → "Sending" badge, and `queued`/`failed` are not in the DB schema. The planner should verify with the user or use the DB schema enum strictly. [ASSUMED — potential conflict between CONTEXT.md D-20 and schema-v1.md]

### Supabase Client Edge Function Invocation

```typescript
// Source: supabase-js 2.103.0 [VERIFIED: installed]
const { data, error } = await supabase.functions.invoke('send-test-email', {
  body: { campaignId: campaign.id, recipientEmail: user?.email },
})
if (error) {
  showToast('Test send failed. Check your Resend configuration.', 'error')
} else {
  showToast('Test email sent.', 'success')
}
```

---

## State of the Art

| Old Approach | Current Approach | Status |
|--------------|------------------|--------|
| TipTap v2.11.5 (in package.json) | TipTap 2.27.2 (installed in node_modules) | npm resolved newer minor — already installed |
| TipTap v3 (latest npm) | TipTap 2.27.2 (this project) | v3 is a major rewrite; this project stays on 2.x |
| Manual ProseMirror Node | TipTap Node.create() wrapper | TipTap's Node.create() is the idiomatic API for custom nodes |
| Supabase Edge Functions via URL fetch | supabase.functions.invoke() | invoke() handles auth; preferred for authenticated callers |

**Deprecated/outdated:**
- `@tiptap/extension-slash-commands`: Not a published package at 2.x. CONTEXT.md mentions it speculatively (§Specifics). The slash command feature is listed as an alternative to the toolbar dropdown. Do NOT attempt to install it — it does not exist as a standalone npm package at 2.27.2. The toolbar variable dropdown (D-05) is the locked implementation path. [VERIFIED: npm view returned no such package]

---

## Open Questions (RESOLVED)

1. **Campaign status enum mismatch** — RESOLVED
   - **Resolution:** The database schema (`docs/schema-v1.md` Module 3) is the source of truth. The CHECK constraint defines: `('draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled')`. CONTEXT.md D-20 listed `queued` and `failed`, but these are NOT valid DB values — inserting them would violate the CHECK constraint. The TypeScript `CampaignStatus` type uses the schema enum exactly. For D-12's "Send now" behavior, the status is set to `'sending'` (not `'queued'`). The UI badge for `'sending'` displays as "Sending".

2. **Edge Function deployment path** — RESOLVED
   - **Resolution:** Plan creates the Edge Function file at `supabase/functions/send-test-email/index.ts`. Deployment is documented as a manual step in `user_setup` frontmatter: `supabase functions deploy send-test-email`. Supabase CLI is not available on this machine; deploy via Supabase dashboard or from an environment where CLI is installed.

3. **RESEND_API_KEY availability** — RESOLVED
   - **Resolution:** Documented in `user_setup` frontmatter of Plan 03. User must set the key via `supabase secrets set RESEND_API_KEY=re_xxxx` before testing test send. Plan 03 Task 1 Edge Function returns HTTP 500 with clear error message if key is not configured.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm installs | Yes | v24.12.0 | — |
| npm | package installs | Yes | 11.6.2 | — |
| Supabase CLI | Edge Function deploy | No | — | Deploy via Supabase dashboard or CI |
| `@tiptap/extension-link` | CAMP-02 (links in editor) | No — not installed | 2.27.2 available on npm | — (must install) |
| `@tiptap/extension-image` | CAMP-02 (images in editor) | No — not installed | 2.27.2 available on npm | — (must install) |
| `@tiptap/extension-placeholder` | CAMP-02 (editor placeholder) | No — not installed | 2.27.2 available on npm | — (must install) |
| RESEND_API_KEY | CAMP-06 (test send) | Unknown | — | Cannot test send without key |

**Missing dependencies with no fallback:**
- `@tiptap/extension-link@2.27.2`, `@tiptap/extension-image@2.27.2`, `@tiptap/extension-placeholder@2.27.2` — must install before editor implementation

**Missing dependencies with fallback:**
- Supabase CLI — Edge Function can be authored without it; deploy via Supabase dashboard

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — no test config files found in project |
| Config file | None — Wave 0 must create test infrastructure or document manual validation |
| Quick run command | `npm run lint` (type-check + lint) |
| Full suite command | None — manual browser testing |

No test files exist in the codebase. Phase 1 was implemented without automated tests. Given project conventions (no testing tooling), the validation approach for Phase 2 is:

**Per-task commit validation:** `npm run lint && tsc --noEmit` (TypeScript type check, no emit)
**Per-wave validation:** Manual browser walkthrough against the Interaction Contracts in UI-SPEC.md

### Phase Requirements — Validation Map

| Req ID | Behavior | Test Type | Command | Automated |
|--------|----------|-----------|---------|-----------|
| CAMP-01 | Create campaign, all fields save correctly | Manual | Browser: /campaigns/new, fill fields, save draft | No |
| CAMP-02 | Editor renders with all toolbar actions working | Manual | Browser: editor toolbar buttons, link/image popover | No |
| CAMP-03 | Variable chips insert, display, serialize to raw string | Manual | Browser: insert variable, check getHTML() output | No |
| CAMP-04 | Contact list selector shows Phase 1 lists | Manual | Browser: /campaigns/new, verify dropdown | No |
| CAMP-05 | Schedule saves UTC, timezone display-only | Manual | Browser: schedule for later, verify DB record | No |
| CAMP-06 | Test send invokes Edge Function, toast appears | Manual | Browser: send test, check toast + Resend dashboard | No |
| CAMP-07 | Draft saves, route /campaigns/:id/edit reloads content | Manual | Browser: save draft, navigate away, return | No |
| CAMP-08 | Duplicate creates copy with "Copy of" prefix, status draft | Manual | Browser: duplicate from campaigns list | No |

**TypeScript coverage (automated):** `npm run lint && npx tsc --noEmit` must pass after each plan before committing.

### Wave 0 Gaps

- [ ] Extract TIMEZONES to `src/lib/constants.ts`
- [ ] Install 3 missing TipTap extensions at 2.27.2
- [ ] Create `supabase/functions/` directory
- [ ] Add Campaign TypeScript types to `src/types/database.ts`
- [ ] Add Campaign tables to `Database` interface in `src/types/database.ts`
- [ ] Add campaigns RLS policies migration (if not yet applied — confirm with Supabase dashboard)
- [ ] Wire `/campaigns`, `/campaigns/new`, `/campaigns/:id/edit` routes in `App.tsx`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Supabase session via useAuth() — all campaign routes are ProtectedRoute |
| V3 Session Management | No (handled by Supabase/Phase 1) | Supabase JWT |
| V4 Access Control | Yes | RLS on campaigns table: `workspace_id = auth.uid()` pattern; campaign CRUD always passes `.eq('workspace_id', profile.workspace_id)` |
| V5 Input Validation | Yes | Required field validation before submit; from_email validated as type="email" |
| V6 Cryptography | No | No new crypto; RESEND_API_KEY stored in Supabase secrets (server-side only) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Campaign data leakage across workspaces | Information Disclosure | RLS + explicit workspace_id filter in all queries |
| XSS via dangerouslySetInnerHTML in preview | Tampering | Preview only renders user's own content; no external HTML; contained in a scoped div with no auth context |
| RESEND_API_KEY exposure to browser | Information Disclosure | Key lives in Supabase Edge Function env only; never in client bundle |
| CSRF on Edge Function | Spoofing | supabase.functions.invoke() includes the user's JWT; Edge Function should verify the JWT before acting |

**dangerouslySetInnerHTML note:** The preview mode uses `dangerouslySetInnerHTML` to render `body_html`. This is safe for self-authored content (user edits their own email body) but would be a risk if the HTML came from external sources. Document clearly that the preview div must never render HTML from other workspaces or external URLs.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | VariableChipNode renderHTML outputs raw `{{variable}}` text (not chip span markup) into body_html | Architecture Patterns — Pattern 3 | Phase 3 delivery engine cannot substitute variables; must be verified by manual test of getHTML() after inserting a chip |
| A2 | TipTap 2.27.2 handles React 19 StrictMode double-mount without duplicate editor instances | Common Pitfalls — Pitfall 4 | Editor may behave erratically in development; mitigated by noting StrictMode is enabled in main.tsx |
| A3 | The `beforeunload` guard (D-23) covers browser refresh and tab close but not React Router navigation | Architecture Patterns — Pattern 7 | User loses changes when clicking nav links without seeing prompt; React Router navigation requires a separate `useBlocker` hook from react-router-dom v7 |
| A4 | Supabase Edge Function simple fetch pattern (Deno) works for Resend API without additional SDK | Code Examples | If Resend requires DKIM headers or rate-limit handling beyond simple fetch, the function may fail silently |
| A5 | Campaign table RLS policies follow the same pattern as contacts (SELECT/INSERT/UPDATE/DELETE for own workspace) and are already applied in production | Architecture Patterns | If RLS is not applied, any authenticated user could read or modify any campaign; must verify in Supabase dashboard |
| A6 | `schema-v1.md` status enum is what's actually deployed (`draft/scheduled/sending/sent/paused/cancelled`) | Code Examples — CampaignStatus type | Type mismatch causes runtime errors when saving `queued` or `failed` status; verify against live DB |

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 2 |
|-----------|-------------------|
| Tech Stack: React 19 + TypeScript + Supabase + Resend — no changes | No new libraries beyond the three TipTap extensions (within TipTap ecosystem) |
| No custom backend server | Edge Function is Supabase Edge Function (Deno), not a separate Express/Node server |
| Frontend only — all business logic via Supabase | Test send logic lives in Edge Function, not in React component |
| Naming: Pages = PascalCase + Page suffix | `CampaignsPage.tsx`, `CampaignBuilderPage.tsx` |
| Naming: Hooks = camelCase with `use` prefix | `useCampaigns.ts`, `useCampaign.ts` |
| Naming: Components = PascalCase | `CampaignEditorToolbar.tsx`, `VariableChipNode.tsx`, etc. |
| Naming: Directories = lowercase with hyphens | `src/hooks/campaigns/`, `src/pages/campaigns/`, `src/components/campaigns/` |
| Single quotes for string literals | All new TypeScript files use single quotes |
| Semicolons always | Enforced by convention |
| 2-space indentation | All new files |
| Dark theme: bg-gray-950 base, bg-gray-900 cards | Campaign builder form surface = bg-gray-900; page background = bg-gray-950 |
| useToast imported from src/components/ui/Toast.tsx | Import path is `../../components/ui/Toast` (not a standalone hook file) |
| ESLint: `npm run lint` | Run before each commit |
| Named exports for utilities/hooks; default exports for components | Hooks: `export function useCampaigns()`. Pages: `export function CampaignsPage()` |
| Error handling: errors stored in state, displayed conditionally | All hook errors exposed as `error: string | null` |

---

## Sources

### Primary (HIGH confidence)
- `node_modules/@tiptap/core/package.json` — version 2.27.2, Node/Extension/mergeAttributes API
- `node_modules/@tiptap/react/dist/index.d.ts` — ReactNodeViewRenderer, NodeViewWrapper, useEditor, EditorContent exports
- `node_modules/@tiptap/core/dist/Editor.d.ts` — getHTML(), getJSON() API
- `node_modules/@supabase/supabase-js/package.json` — version 2.103.0
- `docs/schema-v1.md §Module 3` — campaigns table DDL, columns, status enum
- `src/hooks/contacts/useContactLists.ts` — hook pattern for useCampaigns
- `src/hooks/contacts/useContacts.ts` — hook pattern for useCampaign
- `src/types/database.ts` — existing type interface pattern
- `src/App.tsx` — existing route structure, layout pattern
- `src/components/ui/Button.tsx`, `Badge.tsx`, `Card.tsx`, `Input.tsx`, `Toast.tsx` — component APIs
- `src/pages/settings/ProfilePage.tsx` — TIMEZONES constant (17 entries)
- `.planning/phases/02-campaign-builder/02-CONTEXT.md` — all locked decisions D-01 through D-26
- `.planning/phases/02-campaign-builder/02-UI-SPEC.md` — component locations, Tailwind classes, interaction contracts

### Secondary (MEDIUM confidence)
- `npm view @tiptap/extension-link@2.27.2` — confirmed exists on npm at 2.27.2
- `npm view @tiptap/extension-image@2.27.2` — confirmed exists on npm at 2.27.2
- `npm view @tiptap/extension-placeholder@2.27.2` — confirmed exists on npm at 2.27.2
- `npm view @tiptap/extension-link peerDependencies` — confirmed peer deps satisfied by 2.27.2
- `npm view @tiptap/core version` (current latest) — 3.22.3 (confirms v3 is on npm latest)

### Tertiary (LOW confidence)
- Supabase Edge Function CORS headers pattern — from training knowledge, standard Supabase pattern [ASSUMED]
- beforeunload handler pattern — from training knowledge [ASSUMED]
- TipTap React 19 StrictMode compatibility — from training knowledge [ASSUMED]

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all versions verified in node_modules and npm registry
- TipTap Node extension API: HIGH — types verified in node_modules
- Architecture patterns: HIGH (hooks) / MEDIUM (Edge Function) — hooks verified from codebase; Edge Function based on known patterns
- Campaign TypeScript types: HIGH — derived directly from schema-v1.md DDL
- Pitfalls: HIGH for version mismatch and serialization / MEDIUM for Edge Function CORS

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (30 days — TipTap 2.x is stable; supabase-js 2.x is stable)
