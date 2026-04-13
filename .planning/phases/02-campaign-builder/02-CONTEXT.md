# Phase 2: Campaign Builder - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can build a complete email campaign — composing content with a rich text editor, configuring sender settings and targeting, previewing how the email looks with sample data, scheduling delivery, and sending a test email to themselves. This phase delivers the campaign creation and editing experience; actual bulk delivery to the full list is Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Editor (CAMP-02)
- **D-01:** Use TipTap (already installed as `@tiptap/core`, `@tiptap/react`, `@tiptap/starter-kit`) — no new editor library
- **D-02:** Editor is full-width within the campaign builder form
- **D-03:** Toolbar includes: Bold, Italic, Links, Images (insert by URL) — plus headings and bullet lists from StarterKit
- **D-04:** No drag-and-drop block editor — flat rich text only

### Personalization Variables (CAMP-03)
- **D-05:** Variables inserted via a dropdown button in the toolbar OR via `/` command (slash command in the editor body)
- **D-06:** Available variables: `{{first_name}}`, `{{last_name}}`, `{{company}}`
- **D-07:** Variables can appear in both the subject line (plain text input) and the email body (editor)
- **D-08:** Variables are rendered as styled inline chips in the editor so they're visually distinct from regular text (but stored as raw `{{variable}}` string in the DB)

### Preview Mode (CAMP-02, CAMP-03)
- **D-09:** Toggle between "Edit" and "Preview" mode — not side-by-side (simpler UX, fits mobile too)
- **D-10:** Preview mode renders the email HTML with sample data substituted: `{{first_name}}` → "Alex", `{{last_name}}` → "Smith", `{{company}}` → "Acme Corp"
- **D-11:** Preview is shown in a styled email-like container (white background, max-width ~600px, centered) to approximate how it looks in an inbox

### Scheduling (CAMP-05)
- **D-12:** "Send now" option (immediate dispatch, status set to `queued`) vs "Schedule for later" (date/time picker)
- **D-13:** Date/time picker: native `<input type="datetime-local">` wrapped in a styled component — no third-party date library
- **D-14:** Timezone: user selects from a dropdown of common timezones (same `TIMEZONES` constant already defined in the codebase)
- **D-15:** Scheduled datetime stored in UTC in the DB; timezone only affects the UI display

### Test Send (CAMP-06)
- **D-16:** "Send test email" button sends the email to the currently authenticated user's email address
- **D-17:** Test send uses Resend API directly from a Supabase Edge Function — same infrastructure as Phase 3 delivery, but sends to one recipient only
- **D-18:** Toast feedback on success/failure; no separate test send history UI

### Campaign List & Drafts (CAMP-07, CAMP-08)
- **D-19:** `/campaigns` route shows a list of all campaigns (name, status badge, target list, scheduled/sent date)
- **D-20:** Campaign statuses: `draft`, `scheduled`, `queued`, `sent`, `failed`
- **D-21:** Clicking a campaign row opens the campaign builder in edit mode
- **D-22:** "Duplicate" action creates a copy with status `draft` and name prefixed "Copy of …"
- **D-23:** Unsaved changes prompt (browser `beforeunload`) if user navigates away while editing

### Campaign Builder Layout (CAMP-01)
- **D-24:** Single-page form layout (not a multi-step wizard) — all fields visible at once with sections: Details, Content, Target & Schedule
- **D-25:** Fields: Campaign name, Subject line, Preview text, Sender name, Sender email, Contact list selector, Schedule, Email body editor
- **D-26:** "Save draft" and "Schedule / Send" are the two primary action buttons at the bottom of the form

### Claude's Discretion
- Campaign builder route: `/campaigns/new` for creating, `/campaigns/:id/edit` for editing
- Subject line and preview text: plain text `<input>` fields (not rich text)
- Contact list selector: `<select>` dropdown populated from `useContactLists()` hook (Phase 1)
- Image insertion in editor: URL-based only (no file upload in this phase)
- Empty state on `/campaigns`: friendly prompt to create first campaign

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Database Schema
- `docs/schema-v1.md` §Module 3 — Full DDL for `campaigns` table; columns (`id`, `workspace_id`, `name`, `subject`, `preview_text`, `from_name`, `from_email`, `body_html`, `body_text`, `status`, `contact_list_id`, `scheduled_at`, `sent_at`, `created_at`, `updated_at`), status enum, RLS policies

### Phase 1 Artifacts (Dependencies)
- `.planning/phases/01-contact-lists/01-02-SUMMARY.md` — `useContactLists` hook API (needed for list selector)
- `src/hooks/contacts/useContactLists.ts` — Actual hook implementation

### Existing Packages (Do Not Re-Install)
- `@tiptap/core 2.11.5`, `@tiptap/react 2.11.5`, `@tiptap/starter-kit 2.11.5` — already in package.json
- `TIMEZONES` constant — already defined in codebase (used by ProfilePage timezone selector)

### Conventions
- `CLAUDE.md` — Naming conventions, Tailwind patterns, dark theme (`bg-gray-950`/`bg-gray-900`), component structure

</canonical_refs>

<specifics>
## Specific Ideas

- TipTap slash commands for variable insertion: implement via `@tiptap/extension-slash-commands` or custom extension if not available
- Variable chips in editor: custom TipTap Node extension (inline, non-editable, visually distinct with `bg-indigo-900 text-indigo-200 rounded px-1`)
- Preview container: `max-w-[600px] mx-auto bg-white text-gray-900 p-8 rounded-lg` (light theme to match real email clients)
- Test send edge function: `supabase/functions/send-test-email/index.ts`

</specifics>

<deferred>
## Deferred Ideas

- Side-by-side edit/preview layout (too complex for MVP, toggle is sufficient)
- File upload for images in editor (Phase 3+ or Templates phase)
- Rich variable editor with fallback values (e.g., `{{first_name | "there"}}`)
- Campaign send history / delivery stats (Phase 3 and Phase 4)

</deferred>

---

*Phase: 02-campaign-builder*
*Context gathered: 2026-04-13 via /gsd-discuss-phase*
