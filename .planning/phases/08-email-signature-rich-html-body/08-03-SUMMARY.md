---
phase: 08-email-signature-rich-html-body
plan: 03
subsystem: edge-functions
tags: [signature, edge-function, send-campaign, send-sequence-step, send-test-email, personalization]
dependency_graph:
  requires:
    - 08-01 (signature_html column on profiles table)
  provides:
    - Server-side signature injection in all three Edge Functions
  affects:
    - supabase/functions/send-campaign/index.ts
    - supabase/functions/send-sequence-step/index.ts
    - supabase/functions/send-test-email/index.ts
tech_stack:
  added: []
  patterns:
    - injectSignature helper with hr inline-style separator
    - Per-contact signature personalization (personalizeHtml applied to signature before injection)
    - Workspace-scoped signature cache map in send-sequence-step
    - Server-side profile lookup by user.id in send-test-email (T-08-05 mitigated)
key_files:
  created: []
  modified:
    - supabase/functions/send-campaign/index.ts
    - supabase/functions/send-sequence-step/index.ts
    - supabase/functions/send-test-email/index.ts
decisions:
  - "injectSignature duplicated across all three functions (not shared module) — Deno ESM shared modules add deployment complexity not justified for a small helper"
  - "signature fetched server-side in send-test-email by user.id via service_role — prevents forged signature injection (T-08-05)"
  - "signatureCache Map scoped per-invocation in send-sequence-step — avoids repeated DB round-trips when multiple enrollments share a workspace_id"
  - "null/empty signature_html is a graceful no-op — injectSignature returns bodyHtml unchanged"
metrics:
  duration: "3 minutes"
  completed: "2026-04-14T23:30:00Z"
  tasks_completed: 2
  files_changed: 3
---

# Phase 8 Plan 03: Server-Side Signature Injection in Edge Functions Summary

**One-liner:** All three Edge Functions (send-campaign, send-sequence-step, send-test-email) now fetch signature_html from the sender's profile server-side and inject it after the body with an hr separator, personalizing signature variables per-contact before link wrapping.

## What Was Built

### Task 1: Signature Injection in send-campaign

- **`supabase/functions/send-campaign/index.ts`** — Three changes:
  1. Added `injectSignature(bodyHtml, signatureHtml)` helper after `addUnsubscribeFooter`. Returns bodyHtml unchanged when signatureHtml is null. Separator: `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />` (inline styles — email clients don't support external CSS).
  2. Extended profile SELECT from `'workspace_id'` to `'workspace_id, signature_html'` and extracted `const signatureHtml = profile.signature_html ?? null`.
  3. Updated the batch loop pipeline: `personalizeHtml(body)` → `personalizeHtml(signature)` → `injectSignature` → `wrapLinks` → `addUnsubscribeFooter` → `injectPixel`. Signature variables (e.g. `{{first_name}}`) are personalized per-contact before injection; links in the signature are tracked by wrapLinks.

### Task 2: Signature Injection in send-sequence-step and send-test-email

- **`supabase/functions/send-sequence-step/index.ts`** — Three changes:
  1. Added `injectSignature` helper (identical to send-campaign).
  2. Added `signatureCache = new Map<string, string | null>()` and `getSignatureForWorkspace(workspaceId)` after adminClient creation. The cache avoids repeated DB lookups when multiple enrollments in one invocation share a workspace.
  3. Inside the enrollment loop (step 4d): `await getSignatureForWorkspace(seq.workspace_id)` → `personalizeHtml(signature, contact)` → `injectSignature` → `wrapLinks`. Pipeline order preserved.

- **`supabase/functions/send-test-email/index.ts`** — Three changes:
  1. Added `injectSignature` helper before `serve(async (req) => {`. Uses `serve()` from `deno.land/std@0.168.0` — existing style maintained (not changed to `Deno.serve()`).
  2. After JWT validation and before parsing request body: creates `adminClient` with `SUPABASE_SERVICE_ROLE_KEY` (auto-injected by Supabase runtime), queries `profiles.select('signature_html').eq('id', user.id)`.
  3. Resend API call updated: `html: injectSignature(body_html || '<p>No content</p>', signatureHtml)`.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| Task 1 | `402a83b` | feat(phase-08): inject signature server-side in send-campaign Edge Function |
| Task 2 | `0175b24` | feat(phase-08): inject signature server-side in send-sequence-step and send-test-email |

## Verification Results

- `grep -c injectSignature` — 2 occurrences in each of the three functions (definition + call site)
- send-campaign: profile select contains `'workspace_id, signature_html'`
- send-campaign: pipeline order `personalizedBody -> personalizedSig -> bodyWithSignature -> wrappedHtml -> htmlWithUnsub -> finalHtml`
- send-sequence-step: `signatureCache = new Map<string, string | null>()` present
- send-sequence-step: `getSignatureForWorkspace(seq.workspace_id)` called inside enrollment loop
- send-test-email: `.eq('id', user.id)` scopes profile lookup to authenticated user
- send-test-email: `SUPABASE_SERVICE_ROLE_KEY` used for adminClient
- send-test-email: still uses `serve(async (req)` (not `Deno.serve`)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — signature injection is fully wired. The `signature_html` column is populated by Plan 02 (SettingsPage signature editor). When `signature_html` is null (no signature saved), `injectSignature` returns the body unchanged — graceful no-op.

## Threat Flags

None — all three threat mitigations from the plan's threat model were implemented:

| Threat ID | Mitigation Applied |
|-----------|-------------------|
| T-08-05 | send-test-email fetches signature by `user.id` server-side — not accepted from request body |
| T-08-06 | send-sequence-step fetches by `seq.workspace_id` — workspace isolation enforced by sequence ownership |
| T-08-07 | Accepted — TipTap-authored HTML trusted same as campaign body_html |

## Self-Check: PASSED

- `supabase/functions/send-campaign/index.ts` (injectSignature, signature_html select, personalizedSig) — FOUND
- `supabase/functions/send-sequence-step/index.ts` (injectSignature, signatureCache, getSignatureForWorkspace, personalizedSig) — FOUND
- `supabase/functions/send-test-email/index.ts` (injectSignature, SUPABASE_SERVICE_ROLE_KEY, .eq('id', user.id), serve()) — FOUND
- Commit `402a83b` — FOUND
- Commit `0175b24` — FOUND
