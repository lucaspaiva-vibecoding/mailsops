# MailOps

## What This Is

MailOps is an Email Campaign Management SaaS built for marketers and founders who need to manage contact lists, build and send email campaigns, and understand how their audience engages with their content. It ships with open/click/reply tracking, A/B testing, drip sequences, and a template library — all on top of Supabase + Resend API, deployed to Vercel.

## Core Value

Marketers can send targeted email campaigns and see exactly who opened, clicked, or replied — without leaving the app.

## Requirements

### Validated

- ✓ User authentication (sign up, sign in, password reset, session persistence) — Module 1

### Active

- [ ] User can create and manage contact lists with CSV upload and tagging
- [ ] User can filter/segment contacts by tags, status, and custom fields
- [ ] User can build campaigns with a rich text editor (TipTap), including variable insertion
- [ ] User can schedule campaigns for future delivery
- [ ] User can send test emails before launching a campaign
- [ ] User can send campaigns via Resend API with per-recipient tracking
- [ ] User can track opens (pixel), clicks (redirect), and unsubscribes per recipient
- [ ] User can view per-campaign analytics (open rate, click rate, bounce rate, unsubscribes)
- [ ] User can view a dashboard summarizing account-wide activity
- [ ] User can run A/B tests on subject lines or email body variants
- [ ] User can create drip/sequence campaigns with time-based step delays
- [ ] User can save and reuse email templates
- [ ] User can configure workspace settings and Resend API integration

### Out of Scope

- Team / multi-user workspaces — workspace = user for MVP; add teams in Module 10 later
- Custom sending domain (DKIM/SPF) — start with Resend shared domain; custom domain in Module 10
- Mobile app — web-first SaaS
- Real-time collaboration on campaigns
- AI-generated email content

## Context

**Stack:** React 19 + TypeScript + Vite + Tailwind v4 + Supabase + React Router v7. TipTap already installed for the campaign editor.

**What's built:** Module 1 (Auth) is complete. Supabase has 8 tables with RLS covering modules 1–4: `profiles`, `contacts`, `contact_lists`, `contact_list_members`, `campaigns`, `campaign_recipients`, `campaign_events`, `campaign_links`. Full schema at `docs/schema-v1.md`.

**Tracking architecture:** Opens via 1×1 pixel at `/t/pixel/{tracking_id}`, clicks via redirect at `/t/click/{tracking_id}/{link_index}`, unsubscribes via `/t/unsub/{tracking_id}` — all handled by Supabase Edge Functions using service_role key (no auth required for email client hits).

**Workspace model:** `workspace_id` on every table, currently 1:1 with `profiles.id`. RLS uses `auth.uid() = workspace_id` pattern. Designed to support teams later without schema changes.

**Deployment:** React SPA → Vercel. Supabase Edge Functions deployed alongside. Resend API for email delivery (shared domain initially).

## Constraints

- **Tech Stack**: React 19 + TypeScript + Supabase + Resend — established, no changes
- **Database**: Schema for modules 1–4 is live in production with RLS; new modules (5–10) will require additional tables/migrations
- **Email Delivery**: Resend API shared domain for MVP; rate limits and deliverability apply
- **Frontend only**: No custom backend server — all business logic via Supabase (RLS + Edge Functions)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Workspace = user for MVP | Simpler RLS, ships faster; schema is team-ready when needed | — Pending |
| Resend shared domain first | No DKIM/SPF setup required; custom domain moved to Module 10 | — Pending |
| TipTap for campaign editor | Best React-native rich text editor; already installed; supports variable insertion + JSON storage | — Pending |
| Denormalized stats on campaigns table | Avoid expensive aggregation queries on event tables; increment via triggers/edge functions | — Pending |
| Supabase Edge Functions for tracking | Tracking hits come from unauthenticated email clients; service_role key bypasses RLS safely | — Pending |
| Soft deletes on all tables | Email platforms need audit trails for compliance | — Pending |

---

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-12 after initialization*
