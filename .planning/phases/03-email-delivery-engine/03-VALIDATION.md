---
phase: 03
slug: email-delivery-engine
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-13
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compiler (tsc) + ESLint + file existence checks |
| **Config file** | `tsconfig.json`, `eslint.config.js` |
| **Quick run command** | `npx tsc --noEmit 2>&1 | head -20` |
| **Full suite command** | `npx tsc --noEmit && npm run lint` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit 2>&1 | head -20`
- **After every plan wave:** Run `npx tsc --noEmit && npm run lint`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | DELV-01, DELV-04, DELV-05, DELV-06, DELV-07 | T-03-01, T-03-02, T-03-03 | RLS enabled on both tables; config.toml disables JWT only for anonymous endpoints (t, resend-webhook) | compile | `npx tsc --noEmit 2>&1 | head -20` | N/A (new files) | ⬜ pending |
| 03-01-02 | 01 | 1 | DELV-01 | — | N/A (schema push) | infra | `supabase db push 2>&1 | tail -5` | N/A | ⬜ pending |
| 03-02-01 | 02 | 1 | DELV-04, DELV-05, DELV-06 | T-03-04, T-03-05, T-03-06, T-03-07, T-03-08 | UUID tracking IDs prevent enumeration; click redirect uses DB-stored URLs only (no open redirect); service_role key used (not anon) | file+grep | `test -f supabase/functions/t/index.ts && grep -c "app.get" supabase/functions/t/index.ts` | N/A (new file) | ⬜ pending |
| 03-03-01 | 03 | 2 | DELV-01, DELV-02, DELV-03 | T-03-09, T-03-10, T-03-11, T-03-12, T-03-13 | JWT auth required; workspace isolation enforced; API key server-side only; rate limiting on batch sends | file+grep | `test -f supabase/functions/send-campaign/index.ts && grep -c "api.resend.com" supabase/functions/send-campaign/index.ts` | N/A (new file) | ⬜ pending |
| 03-04-01 | 04 | 2 | DELV-07 | T-03-14, T-03-15, T-03-16, T-03-17, T-03-18 | Svix HMAC signature verification before processing; raw body read (not JSON parsed); invalid signatures rejected with 400 | file+grep | `test -f supabase/functions/resend-webhook/index.ts && grep -c "Webhook" supabase/functions/resend-webhook/index.ts` | N/A (new file) | ⬜ pending |
| 03-05-01 | 05 | 3 | DELV-01 | — | N/A | grep | `grep -c "sendCampaign" src/hooks/campaigns/useCampaign.ts` | Exists | ⬜ pending |
| 03-05-02 | 05 | 3 | DELV-01 | T-03-19, T-03-20, T-03-21 | Send button disabled during send (prevents double-click); confirmation dialog before sending | compile+lint | `npx tsc --noEmit 2>&1 | head -20 && npm run lint` | Exists | ⬜ pending |
| 03-05-03 | 05 | 3 | DELV-01 | — | N/A (manual checkpoint) | manual | N/A | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. TypeScript compiler and ESLint are already configured. Edge Function tasks use file existence and grep checks since Deno Edge Functions run in a separate runtime (not testable via local Node.js test runner). No additional test framework installation needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tracking pixel returns 1x1 PNG in email client | DELV-04 | Requires deployed Edge Function + real email delivery | Deploy `t` function, send test campaign, inspect email HTML source for pixel img tag, verify image loads |
| Click redirect returns 302 to original URL | DELV-05 | Requires deployed Edge Function + real click from email | Click a link in received campaign email, verify browser redirects to original URL |
| Unsubscribe renders HTML confirmation page | DELV-06 | Requires deployed Edge Function + real unsubscribe action | Click unsubscribe link in received email, verify HTML confirmation page appears |
| send-campaign sends real emails via Resend | DELV-01 | Requires Resend API key + live Supabase + recipient inbox | Create campaign with real contact, send, check recipient inbox for email |
| Resend webhook updates delivery status | DELV-07 | Requires Resend dashboard webhook config + real email delivery event | Send campaign, wait for Resend webhook events, check campaign_recipients table for status updates |
| E2E campaign send flow from UI | DELV-01 | Full integration across all plans | Task 03-05-03 checkpoint: create campaign in UI, click Send Now, verify email received with tracking, verify DB records |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
