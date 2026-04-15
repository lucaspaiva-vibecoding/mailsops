# Phase 8: Email Signature & Rich HTML Body - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver two distinct capabilities:

1. **Email Signature** — Users can define a persistent email signature in Settings (Workspace tab), editable with the same TipTap rich text editor used for campaigns. The signature is injected server-side at send time into all outgoing emails (campaigns + sequence steps), and is reflected in the campaign preview panel and test sends.

2. **Rich HTML Body Enhancements** — Add text color (preset palette, 6–8 email-safe colors) and text alignment (left/center/right) to the existing CampaignEditorToolbar. These apply to the campaign body editor and the sequence step editor.

Out of scope: custom signature per campaign, per-step signature overrides, free hex color picker, tables, button elements, image upload (only URL-based image insert as already exists).

</domain>

<decisions>
## Implementation Decisions

### Signature — storage and scope
- **D-01:** Signature is stored in the `profiles` table as a new column (e.g., `signature_html` text, `signature_json` jsonb). Per-user, consistent with the existing workspace defaults pattern (Phase 7).
- **D-02:** Signature applies to **all** outgoing emails: campaigns AND sequence steps. No per-campaign or per-step override.
- **D-03:** Signature is configured in the **Workspace tab** of SettingsPage — added as a new section below the existing default sender fields.

### Signature — editor
- **D-04:** Signature editor uses the **same TipTap setup** as the campaign body (StarterKit + Link + Image + Placeholder, same toolbar). Reuses `CampaignEditorToolbar` component.
- **D-05:** Signature supports all existing toolbar features: bold, italic, h1/h2, bullets, links, images (URL-based), and variables. Variable chips are allowed (e.g., `{{first_name}}` at the end of a signature).
- **D-06:** Signature is saved alongside other Workspace tab fields via the existing save pattern (single "Save workspace settings" button).

### Signature — injection and preview
- **D-07:** Signature is injected **server-side at send time** by the Edge Functions (`send-campaign`, `send-sequence-step`). Not visible or editable in the TipTap campaign/sequence editor body. Editor stays clean.
- **D-08:** Signature IS shown in `CampaignPreview` component — preview appends the signature HTML below the body for accurate representation.
- **D-09:** Signature IS included in **test sends** — the test-send Edge Function (or the send-campaign function in test mode) must fetch the sender's signature and inject it.
- **D-10:** Separator between body and signature: a simple `<hr>` tag injected by the Edge Function before the signature HTML.

### Rich HTML — text color
- **D-11:** Text color uses a **preset palette** of 6–8 email-safe colors. No free hex picker.
- **D-12:** Suggested palette (Claude's discretion on final selection): black, dark gray, red, orange, green, blue, purple, white. Common email-safe choices.
- **D-13:** Color picker UI: a small inline color swatch grid in the toolbar (similar to how `VariableDropdown` uses a popover). Clicking a swatch sets `textStyle({ color: '#...' })` via TipTap's `@tiptap/extension-text-style` + `@tiptap/extension-color`.

### Rich HTML — text alignment
- **D-14:** Three alignment buttons added to toolbar: Left, Center, Right. Uses TipTap's `@tiptap/extension-text-align`.
- **D-15:** Alignment buttons appear after existing heading buttons (before the bullet list button) in the toolbar.

### Claude's Discretion
- Exact palette colors and their hex values
- DB migration numbering (next is `010_signature.sql`)
- Toolbar layout for alignment buttons (exact position within existing divider structure)
- Whether to store signature as `signature_html` + `signature_json` columns (matching body storage pattern) or just `signature_html`
- Loading/empty state for the signature editor in Settings before the editor is initialized
- Whether `@tiptap/extension-text-style`, `@tiptap/extension-color`, and `@tiptap/extension-text-align` require installation or are already available via StarterKit

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project and requirements
- `.planning/ROADMAP.md` — Phase 8 goal and success criteria
- `.planning/REQUIREMENTS.md` — general constraints

### Existing editor (extend this)
- `src/components/campaigns/CampaignEditorToolbar.tsx` — toolbar to extend with color + alignment buttons
- `src/pages/campaigns/CampaignBuilderPage.tsx` — TipTap setup: extensions, useEditor config, body storage pattern
- `src/components/campaigns/CampaignPreview.tsx` — preview component to update with signature injection

### Existing settings page (extend this)
- `src/pages/settings/SettingsPage.tsx` — Workspace tab where signature editor is added
- `src/types/database.ts` — Profile interface (add `signature_html` and `signature_json` fields)

### Edge Functions (extend these)
- `supabase/functions/send-campaign/index.ts` — inject signature before Resend batch send
- `supabase/functions/send-sequence-step/index.ts` — inject signature in sequence step sends

### Sequence editor (also gets color + alignment)
- `src/pages/sequences/SequenceBuilderPage.tsx` — uses StepEditorPanel with TipTap per step
- `src/components/sequences/StepEditorPanel.tsx` — per-step TipTap editor (same toolbar should be updated here)

### DB migration naming
- `supabase/migrations/009_templates_settings.sql` — latest migration; next should be `010_signature.sql`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/campaigns/CampaignEditorToolbar.tsx` — extend with color + alignment
- `src/components/ui/Card.tsx` — wraps signature section in Settings
- `src/components/ui/Button.tsx` — save button
- `src/components/ui/Toast.tsx` + `useToast()` — success/error feedback on save
- `src/hooks/useAuth.ts` + `refreshProfile()` — refresh profile after saving signature

### Established Patterns
- TipTap `useEditor` pattern: `StarterKit + Link + Image + Placeholder + VariableChipNode` — replicate for signature editor
- Settings Workspace tab save flow: update Supabase `profiles` table via `supabase.from('profiles').update(...)` scoped to `user.id`
- `signature_html` + `signature_json` storage mirrors `body_html` + `body_json` on campaigns
- Edge Function signature fetch: `auth.getUser(token)` → `profiles.select('signature_html')` where `id = user.id`

### Integration Points
- `src/types/database.ts` — add `signature_html: string | null`, `signature_json: Json | null` to `Profile` interface
- `supabase/migrations/010_signature.sql` — `ALTER TABLE profiles ADD COLUMN signature_html text; ADD COLUMN signature_json jsonb;`
- `src/pages/settings/SettingsPage.tsx` — add signature TipTap editor to Workspace tab, save alongside existing workspace fields
- `CampaignPreview.tsx` — accept optional `signatureHtml` prop, render below body with `<hr>` separator
- `send-campaign` / `send-sequence-step` Edge Functions — fetch `signature_html` from profile and append to email HTML before send

</code_context>

<specifics>
## Specific Ideas

No "I want it like X" references provided during discussion.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 08-email-signature-rich-html-body*
*Context gathered: 2026-04-14*
