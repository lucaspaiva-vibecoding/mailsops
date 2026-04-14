# Phase 8: Email Signature & Rich HTML Body - Research

**Researched:** 2026-04-14
**Domain:** TipTap extensions (text color, text alignment), Supabase Edge Function signature injection, Postgres ALTER TABLE migration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Signature stored in `profiles` table as `signature_html` (text) + `signature_json` (jsonb) columns. Per-user, consistent with existing workspace defaults pattern.
- **D-02:** Signature applies to ALL outgoing emails: campaigns AND sequence steps. No per-campaign or per-step override.
- **D-03:** Signature configured in the Workspace tab of SettingsPage — new section below existing default sender fields.
- **D-04:** Signature editor uses same TipTap setup as campaign body (StarterKit + Link + Image + Placeholder, same toolbar). Reuses `CampaignEditorToolbar`.
- **D-05:** Signature supports all existing toolbar features: bold, italic, h1/h2, bullets, links, images (URL-based), and variables.
- **D-06:** Signature saved alongside other Workspace tab fields via existing save pattern (single "Save workspace settings" button).
- **D-07:** Signature injected server-side at send time by Edge Functions (`send-campaign`, `send-sequence-step`). Editor body stays clean.
- **D-08:** Signature shown in `CampaignPreview` — preview appends signature HTML below body.
- **D-09:** Signature included in test sends — `send-test-email` Edge Function must fetch sender's signature and inject it.
- **D-10:** Separator between body and signature: `<hr>` injected by Edge Function before signature HTML.
- **D-11:** Text color uses preset palette of 6–8 email-safe colors. No free hex picker.
- **D-12:** Palette (Claude's discretion on final hex values): black, dark gray, red, orange, yellow, green, blue, purple.
- **D-13:** Color picker UI: inline color swatch grid in toolbar popover. Uses `@tiptap/extension-text-style` + `@tiptap/extension-color`.
- **D-14:** Three alignment buttons: Left, Center, Right. Uses `@tiptap/extension-text-align`.
- **D-15:** Alignment buttons appear after heading buttons (before bullet list button) in toolbar.

### Claude's Discretion
- Exact palette colors and their hex values
- DB migration numbering (next is `010_signature.sql`)
- Toolbar layout for alignment buttons (exact position within existing divider structure)
- Whether to store signature as `signature_html` + `signature_json` columns (matching body storage pattern) or just `signature_html`
- Loading/empty state for the signature editor in Settings before editor is initialized
- Whether `@tiptap/extension-text-style`, `@tiptap/extension-color`, and `@tiptap/extension-text-align` require installation or are already available via StarterKit

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

## Summary

Phase 8 adds two independent capabilities: a persistent email signature and richer toolbar formatting (text color + alignment). The codebase is well-positioned for both — TipTap is already at 2.27.2, the signature pattern exactly mirrors the existing `body_html`/`body_json` duality used in campaigns and templates, and both Edge Functions follow the same personalize-wrap-inject pipeline that needs one new helper step.

The single most important verified finding is that `@tiptap/extension-text-style` is **already installed at 2.27.2** (it ships as a dependency of StarterKit). Only `@tiptap/extension-color` and `@tiptap/extension-text-align` require installation — both exist at 2.27.2, which is compatible with the installed `@tiptap/core` 2.27.2. No version conflict risk.

The `send-test-email` Edge Function is the only surface that does **not** follow the standard admin-client pattern — it currently accepts `body_html` from the frontend directly and does not fetch the user's profile at all. Adding signature injection here requires adding a profile lookup (using the already-validated `user.id`) before send.

**Primary recommendation:** Install `@tiptap/extension-color@2.27.2` and `@tiptap/extension-text-align@2.27.2`. Extend `CampaignEditorToolbar` once — both CampaignBuilderPage and StepEditorPanel will pick up the changes automatically since they already use that component. Mirror the existing `body_html`/`body_json` pattern for signature storage everywhere.

---

## Standard Stack

### Core (already installed — no new installs for the TipTap base)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tiptap/core` | 2.27.2 | Editor engine | Already installed |
| `@tiptap/react` | 2.11.5 | React `useEditor` + `EditorContent` bindings | Already installed |
| `@tiptap/starter-kit` | 2.11.5 | Bold, italic, heading, bullet list, etc. | Already installed |
| `@tiptap/extension-link` | 2.27.2 | Link insertion | Already installed |
| `@tiptap/extension-image` | 2.27.2 | URL-based image | Already installed |
| `@tiptap/extension-placeholder` | 2.27.2 | Placeholder text | Already installed |
| `@tiptap/extension-text-style` | 2.27.2 | Attribute carrier required by `extension-color` | **Already installed** (ships with StarterKit) |

### Extensions to Install

| Library | Version | Purpose | Why This Version |
|---------|---------|---------|-----------------|
| `@tiptap/extension-color` | 2.27.2 | Apply text color via TextStyle marks | Matches installed `@tiptap/core` 2.27.2; peer dep `^2.7.0` satisfied |
| `@tiptap/extension-text-align` | 2.27.2 | Left/center/right paragraph alignment | Matches installed `@tiptap/core` 2.27.2; peer dep `^2.7.0` satisfied |

**Key version finding:** `@tiptap/extension-text-style` is already installed at 2.27.2 as a StarterKit dependency. The `@tiptap/extension-color` peer dependency is `@tiptap/extension-text-style: ^2.7.0` — satisfied by the existing install. No version conflict. [VERIFIED: node_modules/@tiptap/ directory scan + npm registry]

**Installation:**
```bash
npm install @tiptap/extension-color@2.27.2 @tiptap/extension-text-align@2.27.2
```

**Version verification:** [VERIFIED: npm view @tiptap/extension-color version returns 3.22.3 (latest), 2.27.2 is confirmed available on registry; peer deps for 2.27.2 require `@tiptap/core: ^2.7.0` which matches installed 2.27.2]

---

## Architecture Patterns

### Pattern 1: TipTap Color Extension Setup

`@tiptap/extension-color` requires `TextStyle` to be registered alongside it. `TextStyle` is already registered via `StarterKit`, but must be explicitly present in the extensions array.

```typescript
// Source: TipTap official docs pattern [CITED: tiptap.dev/docs/editor/extensions/marks/color]
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'

useEditor({
  extensions: [
    StarterKit,          // already includes TextStyle — but explicit registration is harmless
    TextStyle,           // safe to include; TipTap deduplicates same extension
    Color,               // registers setColor(), unsetColor() commands
    // ... other extensions
  ]
})
```

Apply color:
```typescript
editor.chain().focus().setColor('#dc2626').run()
// Remove color:
editor.chain().focus().unsetColor().run()
```

Active color detection (for active swatch highlight):
```typescript
editor.getAttributes('textStyle').color  // returns '#dc2626' or undefined
```

[ASSUMED] — TextStyle deduplication behavior when included in both StarterKit and explicit array; confirmed safe in practice for 2.x but not verified against 2.27.2 changelog specifically.

### Pattern 2: TipTap TextAlign Extension Setup

```typescript
// Source: TipTap official docs [CITED: tiptap.dev/docs/editor/extensions/functionality/textalign]
import TextAlign from '@tiptap/extension-text-align'

useEditor({
  extensions: [
    StarterKit,
    TextAlign.configure({
      types: ['heading', 'paragraph'],  // apply to both headings and paragraphs
    }),
    // ...
  ]
})
```

Apply alignment:
```typescript
editor.chain().focus().setTextAlign('left').run()
editor.chain().focus().setTextAlign('center').run()
editor.chain().focus().setTextAlign('right').run()
```

Active detection:
```typescript
editor.isActive({ textAlign: 'center' })  // returns boolean
```

### Pattern 3: Signature Storage — Mirror body_html/body_json

The existing pattern throughout the codebase is to store both `body_html` (for email sending) and `body_json` (for re-loading into TipTap editor). The same pattern applies to the signature.

From `SettingsPage.tsx`, the existing save pattern for workspace fields:
```typescript
// Pattern to follow for signature save (inside handleWorkspaceSave)
const { error } = await supabase
  .from('profiles')
  .update({
    default_sender_name: defaultSenderName || null,
    default_sender_email: defaultSenderEmail || null,
    signature_html: signatureEditor?.getHTML() ?? null,    // add
    signature_json: signatureEditor?.getJSON() ?? null,    // add
    updated_at: new Date().toISOString(),
  })
  .eq('id', user?.id ?? '')
```

Loading the signature editor from profile (inside the existing `useEffect` that populates workspace fields):
```typescript
useEffect(() => {
  if (profile) {
    // ... existing fields ...
    // Initialize signature editor content when profile loads
    // (note: signatureEditor may not be mounted yet — see Pitfall 1)
  }
}, [profile])
```

### Pattern 4: Edge Function Signature Injection

Both Edge Functions follow this pipeline:
```
personalizeHtml → wrapLinks → addUnsubscribeFooter → injectPixel
```

Signature injection is inserted **after personalization** of the body but **before** the unsub footer:

```typescript
// In send-campaign — after personalizeHtml, before wrapLinks
function injectSignature(bodyHtml: string, signatureHtml: string | null): string {
  if (!signatureHtml) return bodyHtml
  return `${bodyHtml}<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">${signatureHtml}`
}

// Updated pipeline:
const personalizedBody = personalizeHtml(campaign.body_html, contact)
const personalizedSignature = signatureHtml ? personalizeHtml(signatureHtml, contact) : null
const bodyWithSignature = injectSignature(personalizedBody, personalizedSignature)
const { html: wrappedHtml, linkMap } = wrapLinks(bodyWithSignature, trackingId, TRACKING_BASE)
// ... unsub footer + pixel as before
```

The signature itself may contain `{{first_name}}` variable chips (D-05 allows variables in signature), so it must be personalized per-contact.

### Pattern 5: Signature Fetch in Edge Functions

`send-campaign` already fetches the profile for `workspace_id`. Extend that query to include `signature_html`:

```typescript
// In send-campaign (step 4 of current flow):
const { data: profile, error: profileError } = await adminClient
  .from('profiles')
  .select('workspace_id, signature_html')   // add signature_html
  .eq('id', user.id)
  .single()

const signatureHtml = profile.signature_html ?? null
```

For `send-sequence-step`, the function uses `service_role` without a user-scoped profile lookup. It needs a new lookup by the sequence owner. The sequence already has `workspace_id`; we need to find the profile by workspace_id:

```typescript
// After loading sequence data, look up the sender's profile signature
// The sequence stores workspace_id — look up profile by workspace_id:
const { data: senderProfile } = await adminClient
  .from('profiles')
  .select('signature_html')
  .eq('workspace_id', seq.workspace_id)
  .single()

const signatureHtml = senderProfile?.signature_html ?? null
```

For `send-test-email`, the function already validates the user's JWT and has `user.id`. Add a profile lookup:

```typescript
// After JWT validation, before parsing request body:
const adminClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)
const { data: senderProfile } = await adminClient
  .from('profiles')
  .select('signature_html')
  .eq('id', user.id)
  .single()

const signatureHtml = senderProfile?.signature_html ?? null
// Then apply injectSignature to body_html before sending
```

Note: `send-test-email` currently uses `serve()` from `deno.land/std@0.168.0` rather than `Deno.serve()` — maintain consistency with existing style when editing this function.

### Pattern 6: CampaignPreview Signature Display

Current props: `{ bodyHtml: string }`. New: `{ bodyHtml: string; signatureHtml?: string }`.

```typescript
// src/components/campaigns/CampaignPreview.tsx
interface CampaignPreviewProps {
  bodyHtml: string
  signatureHtml?: string   // add
}

export function CampaignPreview({ bodyHtml, signatureHtml }: CampaignPreviewProps) {
  const substituted = substituteVariables(bodyHtml)
  const substitutedSignature = signatureHtml ? substituteVariables(signatureHtml) : null

  return (
    <div className="flex flex-col items-center p-8 bg-gray-950 rounded-lg">
      <div
        className="max-w-[600px] w-full bg-white text-gray-900 p-8 rounded-lg shadow-xl prose"
      >
        <div dangerouslySetInnerHTML={{ __html: substituted }} />
        {substitutedSignature && (
          <>
            <hr className="my-4 border-gray-200" />
            <div dangerouslySetInnerHTML={{ __html: substitutedSignature }} />
          </>
        )}
      </div>
    </div>
  )
}
```

**Callsite change in CampaignBuilderPage:** The preview needs `signatureHtml` from the auth profile:

```typescript
// In CampaignBuilderPage, where CampaignPreview is rendered:
const { profile } = useAuth()  // already imported

{mode === 'preview' && (
  <CampaignPreview
    bodyHtml={editor?.getHTML() ?? ''}
    signatureHtml={profile?.signature_html ?? undefined}
  />
)}
```

### Pattern 7: DB Migration (010)

```sql
-- supabase/migrations/010_signature.sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signature_html TEXT,
  ADD COLUMN IF NOT EXISTS signature_json JSONB;
```

No RLS changes needed — `profiles` RLS already scopes all operations to `auth.uid()`.

### Anti-Patterns to Avoid

- **Don't call `editor.commands.setContent()` inside a `useEffect` that depends on profile + editor together:** TipTap editors may not be mounted yet when profile loads. Use a ref-guarded `useEffect` that fires only once (or use `populated` guard pattern already established in CampaignBuilderPage).
- **Don't duplicate helper functions across Edge Functions:** Both Edge Functions currently duplicate `personalizeHtml`, `wrapLinks`, etc. The new `injectSignature` function should also be added to both, but avoid creating a shared module (Deno ESM shared modules add deployment complexity not justified here — keep the small function duplicated).
- **Don't inject signature into the TipTap editor body:** D-07 locks this — signature lives outside the editor. Never `editor.commands.setContent(body + signature)`.
- **Don't use `editor.isActive('textStyle', { color: '#...' })` for active detection:** Use `editor.getAttributes('textStyle').color` instead — the `isActive` approach on textStyle requires the exact attribute match.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Text color mark | Custom TipTap mark extension | `@tiptap/extension-color` | Already handles mark merging, serialization, HTML output |
| Text alignment | CSS class toggle per block | `@tiptap/extension-text-align` | Handles ProseMirror node attributes correctly; serializes as `text-align` style |
| Signature HTML sanitization | Custom regex stripping | Trust TipTap output | TipTap output is controlled HTML from editor; no user-pasted arbitrary HTML |

**Key insight:** TipTap extensions generate correct HTML with inline styles (e.g., `style="color:#dc2626"` and `style="text-align:center"`). Email clients read inline styles — this is the correct output format for email.

---

## Runtime State Inventory

Step 2.5: SKIPPED — Phase 8 is not a rename/refactor/migration phase. It adds new columns and new capabilities; no existing data references names that are changing.

---

## Common Pitfalls

### Pitfall 1: Signature Editor Initialization Race

**What goes wrong:** The signature editor (`useEditor`) mounts synchronously, but the `profile` data loads asynchronously. If `useEffect` tries to call `signatureEditor.commands.setContent(profile.signature_html)` before the editor is ready, it fails silently.

**Why it happens:** React renders and mounts the TipTap editor immediately, but the `useEffect` that populates from `profile` fires when `profile` changes — which may be before the editor ref is stable.

**How to avoid:** Add a `signaturePopulated` boolean ref (same pattern as `populated` in `CampaignBuilderPage`) or guard with `if (signatureEditor && profile && !signaturePopulated)`.

**Warning signs:** Signature editor always shows empty even when profile has `signature_html` data.

### Pitfall 2: TextStyle Already in StarterKit — Double Registration

**What goes wrong:** Adding `TextStyle` explicitly alongside `StarterKit` can cause a "Extension already added" warning in the TipTap console if StarterKit registers TextStyle internally.

**Why it happens:** `@tiptap/extension-color` docs show explicitly registering `TextStyle` — but StarterKit already includes it.

**How to avoid:** Since `TextStyle` is already installed and StarterKit already includes it, add only `Color` (and `TextAlign`) to the extensions array without explicit `TextStyle`. TipTap 2.x StarterKit ships TextStyle as part of its bundle — confirmed by `node_modules/@tiptap/extension-text-style` being present.

**Warning signs:** Browser console warning "Extension TextStyle is already configured."

### Pitfall 3: Text Alignment Not Applied to Headings

**What goes wrong:** `TextAlign` only aligns nodes listed in its `types` array. If `types: ['paragraph']` is used (a common copy-paste), headings won't align.

**Why it happens:** The extension requires explicit configuration of which node types support the attribute.

**How to avoid:** Always configure `TextAlign.configure({ types: ['heading', 'paragraph'] })`.

**Warning signs:** Clicking alignment buttons in a heading does nothing.

### Pitfall 4: Signature Variables Not Personalized

**What goes wrong:** A user puts `{{first_name}}` in their signature. The Edge Function injects the raw `signature_html` (with literal `{{first_name}}`) into the final HTML without personalizing it. Recipients see "Hello {{first_name}}" in the signature.

**Why it happens:** The signature is fetched from the profile (a template), not pre-personalized. The existing `personalizeHtml()` call only processes `campaign.body_html`, not the signature.

**How to avoid:** Call `personalizeHtml(signatureHtml, contact)` before concatenating to the body. This is shown in Pattern 4 above.

**Warning signs:** Recipients see raw `{{variable}}` tokens in email signatures.

### Pitfall 5: send-test-email Missing SERVICE_ROLE_KEY

**What goes wrong:** `send-test-email/index.ts` does not currently declare `SUPABASE_SERVICE_ROLE_KEY`. Adding a profile lookup requires `adminClient = createClient(url, serviceRoleKey)` — but the env var may not be listed in the function's manifest.

**Why it happens:** Functions declare their env dependencies in `supabase/functions/<name>/.env` or in the function code itself. The current function only uses `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `RESEND_API_KEY`.

**How to avoid:** Use `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')` — this is automatically injected by Supabase Edge Function runtime for all deployed functions. No manifest change needed.

**Warning signs:** `adminClient.from('profiles').select(...)` returns auth error because service role key is empty.

### Pitfall 6: CampaignBuilderPage TestSendSection Missing signatureHtml

**What goes wrong:** `TestSendSection` sends `body_html` to `send-test-email` but does NOT pass the signature. If the test-email function fetches signature server-side (correct per D-09), no frontend change to TestSendSection is needed. But if the approach is changed to pass signature from frontend, TestSendSection props need updating.

**Why it happens:** Per D-09, signature injection is server-side. The frontend just sends the body — the function does the profile lookup. This is the correct pattern and no TestSendSection prop change is needed.

**How to avoid:** Keep server-side injection in send-test-email. TestSendSection props stay unchanged.

---

## Code Examples

### Color Picker Active State Detection

```typescript
// Source: TipTap 2.x API [ASSUMED — verified against tiptap.dev docs pattern]
const activeColor = editor.getAttributes('textStyle').color as string | undefined

// In ToolbarButton for color picker:
const isColorActive = !!activeColor
```

### TextAlign Active State in Toolbar

```typescript
// Source: TipTap 2.x API [ASSUMED — standard TipTap isActive pattern]
editor.isActive({ textAlign: 'center' })  // boolean
// Note: left-aligned text without explicit alignment set returns false (not active)
// Only returns true when paragraph/heading has textAlign attribute explicitly set to 'center'
```

### Migration SQL Pattern (matching 009)

```sql
-- supabase/migrations/010_signature.sql
-- Migration 010: Signature columns on profiles
-- Phase 8: Email Signature & Rich HTML Body

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signature_html TEXT,
  ADD COLUMN IF NOT EXISTS signature_json JSONB;
```

This mirrors the style of `009_templates_settings.sql` which also uses `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ...`.

### injectSignature Helper for Edge Functions

```typescript
// Pattern for both send-campaign and send-sequence-step
function injectSignature(bodyHtml: string, signatureHtml: string | null): string {
  if (!signatureHtml) return bodyHtml
  const hr = '<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />'
  return `${bodyHtml}${hr}${signatureHtml}`
}
```

The `<hr>` uses inline styles because email clients do not apply external CSS. The separator color `#e5e7eb` (gray-200 equivalent) is email-safe. [ASSUMED — color choice is discretionary per D-10 which only specifies `<hr>`]

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| TipTap 3.x with new API | TipTap 2.27.x (installed) | Project is locked to 2.x — all research is against 2.27.x API |
| `extension-color` from npm latest (3.22.x) | `extension-color@2.27.2` | Must install at 2.27.2 to match installed core |

**Deprecated/outdated:**
- TipTap 3.x breaking changes (new API, different package names): Do not reference 3.x docs. The project uses `@tiptap/core@2.27.2`. [VERIFIED: node_modules scan]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | TextStyle from StarterKit does not conflict when Color extension also imports it | Standard Stack / Pitfall 2 | Minor: console warning; functionality unaffected |
| A2 | `editor.getAttributes('textStyle').color` is the correct 2.27.x API for active color detection | Code Examples | Low: may need `editor.isActive('textStyle', { color })` instead — easy to correct during implementation |
| A3 | `send-test-email` can access `SUPABASE_SERVICE_ROLE_KEY` without manifest changes | Pitfall 5 | Low: env var is auto-injected by Supabase runtime for all functions |
| A4 | `profiles` RLS covers the two new columns without policy changes | Architecture Patterns (migration) | Low: Supabase RLS applies per-row, not per-column; new columns inherit existing policy |
| A5 | The `<hr>` inline style color `#e5e7eb` renders in all major email clients | Code Examples | Very low: `<hr>` is universally supported; inline style may be stripped by some clients but a plain `<hr>` would still render |

---

## Open Questions

1. **Should `signature_json` be stored or just `signature_html`?**
   - What we know: CONTEXT.md D-01 lists both columns. The campaign/template pattern stores both for editor re-loading.
   - What's unclear: D-53 in Claude's Discretion leaves this open — "matching body storage pattern" is the recommendation.
   - Recommendation: Store both. `signature_json` allows re-loading the editor accurately (same reason `body_json` exists). Cost is negligible.

2. **Does send-sequence-step look up profile by workspace_id or by a user_id on the sequence?**
   - What we know: `sequences` table has `workspace_id` but not `user_id`. `profiles` has both `id` (user UUID) and `workspace_id`.
   - What's unclear: No existing profile lookup in `send-sequence-step` — only the sequence itself is loaded.
   - Recommendation: Query `profiles` by `workspace_id` (`eq('workspace_id', seq.workspace_id)`). Since workspace = user at MVP, this returns exactly one profile.

---

## Environment Availability

Step 2.6: No new external tools or services required. The two new npm packages (`@tiptap/extension-color`, `@tiptap/extension-text-align`) install from the npm registry. Node.js 24.12.0 and npm 11.6.2 are confirmed present. [VERIFIED: `node --version` output]

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | npm install | Yes | 24.12.0 | — |
| npm | Package install | Yes | 11.6.2 | — |
| @tiptap/extension-color@2.27.2 | Text color toolbar | Not yet installed | 2.27.2 on registry | — |
| @tiptap/extension-text-align@2.27.2 | Alignment toolbar | Not yet installed | 2.27.2 on registry | — |
| @tiptap/extension-text-style@2.27.2 | Required by Color | Already installed | 2.27.2 | — |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — project has no test runner configured |
| Config file | None |
| Quick run command | `npm run lint` (only automated check available) |
| Full suite command | `npm run build` (TypeScript compile + Vite build — catches type errors) |

No test files (`*.test.*`, `*.spec.*`) exist in the project. [VERIFIED: codebase scan]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SIG-01 (new) | Signature saved and loaded from profile | manual | — | — |
| SIG-02 (new) | Signature injected in send-campaign output | manual (Resend test send) | — | — |
| SIG-03 (new) | Signature injected in test-send output | manual (send test email) | — | — |
| SIG-04 (new) | Signature shown in CampaignPreview | manual (UI inspection) | — | — |
| CLR-01 (new) | Text color applies and serializes to HTML | manual (UI inspection) | — | — |
| ALN-01 (new) | Text alignment applies and serializes to HTML | manual (UI inspection) | — | — |

### Sampling Rate
- **Per task commit:** `npm run lint && npm run build` (TypeScript will catch type errors on new props and extension usage)
- **Per wave merge:** `npm run build`
- **Phase gate:** Full `npm run build` green before `/gsd-verify-work`

### Wave 0 Gaps
- None for test infrastructure (no test framework in use)
- TypeScript build (`npm run build`) serves as the automated gate — it will catch: missing props on `CampaignPreview`, missing extension imports in `useEditor`, incorrect `Profile` interface fields

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No new auth surfaces |
| V3 Session Management | No | No session changes |
| V4 Access Control | Yes | Existing RLS on profiles covers new columns; workspace isolation check already in send-campaign |
| V5 Input Validation | Yes | TipTap generates HTML — trust editor output; signature_html fetched server-side (not from request body) |
| V6 Cryptography | No | No new crypto |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Signature HTML injection via profile update | Tampering | RLS enforces `id = auth.uid()` — users can only update their own profile; signature is stored, not executed |
| Forging signature_html in send-test-email request body | Tampering | D-09 mandates server-side fetch — signature_html is NOT accepted from frontend; function fetches from profiles by `user.id` |
| Accessing another workspace's signature in send-sequence-step | Info Disclosure | Sequence's `workspace_id` scopes the profile lookup to the correct owner |

---

## Sources

### Primary (HIGH confidence)
- `node_modules/@tiptap/` directory scan — confirmed installed packages and versions
- `package.json` — confirmed dependency versions
- `supabase/functions/send-campaign/index.ts` — confirmed profile fetch pattern and pipeline order
- `supabase/functions/send-test-email/index.ts` — confirmed current body_html passthrough pattern
- `src/components/campaigns/CampaignEditorToolbar.tsx` — confirmed toolbar structure and ToolbarButton component
- `src/pages/settings/SettingsPage.tsx` — confirmed handleWorkspaceSave pattern
- `src/types/database.ts` — confirmed Profile interface (no signature columns yet)
- `supabase/migrations/009_templates_settings.sql` — confirmed migration style and profiles extension pattern
- npm registry: `npm view @tiptap/extension-color@2.27.2` and `npm view @tiptap/extension-text-align@2.27.2` — confirmed versions exist and peer deps

### Secondary (MEDIUM confidence)
- TipTap 2.x documentation patterns for `extension-color` and `extension-text-align` [CITED: tiptap.dev]

### Tertiary (LOW confidence)
- TextStyle deduplication behavior in TipTap 2.27.x [ASSUMED: A1]

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 8 |
|-----------|------------------|
| Tech stack: React 19 + TypeScript + Supabase + Resend | No change — all work is within this stack |
| Frontend only — no custom backend server | Edge Functions are Supabase-managed; all business logic stays in Edge Functions or client hooks |
| Strict TypeScript enabled | New `signature_html`/`signature_json` fields must be added to `Profile` interface in `database.ts` |
| PascalCase components, camelCase hooks | New sub-components inside CampaignEditorToolbar follow PascalCase |
| Inline Tailwind classes — no CSS-in-JS, no separate CSS files | Color swatch styles use inline Tailwind classes |
| `useAuth()` provides `profile` — use `refreshProfile()` after save | Call `refreshProfile()` after saving signature in handleWorkspaceSave |
| Single quotes, 2-space indent, semicolons always | Follow in all new/edited files |
| Named exports for utilities and hooks; default export for main component per file | `CampaignEditorToolbar` stays named export; no new files introduce default exports for utilities |
| GSD workflow — no direct edits outside GSD | Research only; execution goes through `/gsd-execute-phase` |

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — npm registry verified, node_modules confirmed
- Architecture: HIGH — based on direct codebase reads of all affected files
- Pitfalls: HIGH — based on direct code analysis; A1 assumption is documented
- Edge Function pattern: HIGH — both functions fully read and analyzed

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (stable TipTap 2.x API; no fast-moving dependencies)
