# Roadmap: MailOps

## Overview

MailOps builds outward from its core: contacts exist, campaigns get built, emails go out, results get measured. Each phase delivers a complete, usable capability — starting with the contact foundation (Module 2), layering the campaign builder and delivery engine (Modules 3–4), then adding analytics, A/B testing, sequences, and finally templates and settings (Modules 5–10). Auth (Module 1) is already shipped.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Contact Lists** - Upload contacts via CSV, manage individual contacts, and organize them into named lists
- [ ] **Phase 2: Campaign Builder** - Create campaigns with TipTap editor, personalization variables, scheduling, and test sends
- [ ] **Phase 3: Email Delivery Engine** - Send campaigns via Resend API with open/click/unsubscribe tracking via Edge Functions
- [ ] **Phase 4: Analytics & Dashboard** - Per-campaign analytics, event timeline, link breakdown, recipient engagement, and account-wide dashboard
- [ ] **Phase 5: A/B Testing** - Create variant campaigns, set split percentages, compare results, and send the winning variant
- [x] **Phase 6: Sequences** - Build multi-step drip campaigns with time-based delays and per-step delivery stats (completed 2026-04-14)
- [ ] **Phase 7: Templates & Settings** - Save reusable templates from campaigns and configure workspace/Resend settings
- [ ] **Phase 8: Email Signature & Rich HTML Body** - Persistent email signature in Settings, text color picker, and text alignment in toolbar

## Phase Details

### Phase 1: Contact Lists
**Goal**: Users can import, manage, and organize contacts into lists ready for campaign targeting
**Depends on**: Nothing (Module 1 Auth already shipped)
**Requirements**: CONT-01, CONT-02, CONT-03, CONT-04, CONT-05, CONT-06, CONT-07, CONT-08, CONT-09, LIST-01, LIST-02, LIST-03, LIST-04, LIST-05
**Success Criteria** (what must be TRUE):
  1. User can upload a CSV, map columns to contact fields, and see the imported contacts appear in their account
  2. User can manually create, edit, and delete individual contacts
  3. User can search and filter contacts by email, name, tag, status, or custom field value
  4. User can create and manage named contact lists and add or remove contacts from them
  5. Contact list pages display accurate contact counts
**Plans**: 5 plans

Plans:
- [x] 01-01-PLAN.md — DB migrations (import_logs table, contact_count trigger) + papaparse install
- [x] 01-02-PLAN.md — TypeScript type interfaces + useContacts/useContactLists data hooks
- [x] 01-03-PLAN.md — ContactsPage shell with tabs + Lists tab (ListsGrid, CreateListModal, ColorPicker)
- [x] 01-04-PLAN.md — ContactsTable + ContactsFilters + ContactDrawer (CRUD + list membership)
- [x] 01-05-PLAN.md — CSV import wizard + import history modal

**UI hint**: yes

### Phase 2: Campaign Builder
**Goal**: Users can build a complete email campaign — content, sender settings, targeting, and scheduling — before it is sent
**Depends on**: Phase 1
**Requirements**: CAMP-01, CAMP-02, CAMP-03, CAMP-04, CAMP-05, CAMP-06, CAMP-07, CAMP-08
**Success Criteria** (what must be TRUE):
  1. User can create a campaign with name, subject, preview text, sender name, and sender email
  2. User can compose the email body using the TipTap rich text editor with personalization variables
  3. User can select a contact list as the campaign target and schedule it for future delivery
  4. User can send a test email to themselves before launching
  5. User can save drafts, return to edit them, and duplicate existing campaigns
**Plans**: 4 plans

Plans:
- [x] 02-01-PLAN.md — Campaign types, data hooks (useCampaigns/useCampaign), TIMEZONES extraction, route wiring
- [x] 02-02-PLAN.md — TipTap editor components: VariableChipNode extension, toolbar, variable dropdown, preview
- [x] 02-03-PLAN.md — Campaign builder page: form layout, scheduling, test send Edge Function, save/schedule
- [ ] 02-04-PLAN.md — Campaign list page: table with status badges, duplicate/delete actions, empty state

**UI hint**: yes

### Phase 3: Email Delivery Engine
**Goal**: Users can launch a campaign and emails are sent, tracked, and status-updated automatically
**Depends on**: Phase 2
**Requirements**: DELV-01, DELV-02, DELV-03, DELV-04, DELV-05, DELV-06, DELV-07
**Success Criteria** (what must be TRUE):
  1. User can send a campaign and all active contacts in the target list receive the email via Resend API
  2. Every sent email contains a tracking pixel and wrapped click-redirect URLs
  3. Opens are recorded in the database when the pixel loads in an email client
  4. Clicks are recorded and the recipient is redirected to the original URL
  5. Contacts who click the unsubscribe link are automatically marked unsubscribed; bounces are reflected via Resend webhooks
**Plans**: 5 plans

Plans:
- [x] 03-01-PLAN.md — DB migrations (campaign_recipients + tracking_events), TypeScript types, config.toml, schema push
- [x] 03-02-PLAN.md — Tracking Edge Function `t` (Hono router: pixel/click/unsub endpoints)
- [x] 03-03-PLAN.md — send-campaign Edge Function (batch Resend sends with tracking injection + personalization)
- [x] 03-04-PLAN.md — resend-webhook Edge Function (Svix signature verification + delivery status updates)
- [ ] 03-05-PLAN.md — Frontend integration (sendCampaign hook + CampaignBuilderPage send flow + E2E verification)

### Phase 4: Analytics & Dashboard
**Goal**: Users can see exactly how each campaign performed and get an account-wide overview on the dashboard
**Depends on**: Phase 3
**Requirements**: ANLX-01, ANLX-02, ANLX-03, ANLX-04, DASH-01, DASH-02, DASH-03
**Success Criteria** (what must be TRUE):
  1. User can view per-campaign summary stats: sent, delivered, open rate, click rate, bounce rate, unsubscribe rate
  2. User can explore a chronological event timeline for any campaign
  3. User can see per-link click counts and unique clicks, and drill into per-recipient engagement
  4. The dashboard displays total contacts, total campaigns sent, average open rate, recent campaigns, and list/unsubscribe counts
**Plans**: 3 plans

Plans:
- [x] 04-01-PLAN.md — Fix database.ts types + analytics utility helpers + useCampaignAnalytics and useDashboardStats hooks
- [ ] 04-02-PLAN.md — Campaign Analytics Page: StatCard, EventTimeline, LinkBreakdown, RecipientTable components
- [x] 04-03-PLAN.md — Dashboard live data + recent campaigns table + analytics route wiring + View analytics action

**UI hint**: yes

### Phase 5: A/B Testing
**Goal**: Users can test two email variants against part of a list, compare results, and send the winner to the rest
**Depends on**: Phase 3
**Requirements**: ABTS-01, ABTS-02, ABTS-03, ABTS-04
**Success Criteria** (what must be TRUE):
  1. User can create an A/B test campaign with two variants (different subject lines and/or bodies)
  2. User can set the split percentage between variants before sending
  3. User can view open rate and click rate side-by-side for each variant
  4. User can pick a winning variant and send it to the remaining unsent contacts
**Plans**: 3 plans

Plans:
- [x] 05-01-PLAN.md — DB migration (campaign_type + parent_campaign_id), TypeScript types, useAbTest hook, useCampaigns extensions, Edge Function contact_ids override, route wiring
- [x] 05-02-PLAN.md — A/B test builder page: VariantTabStrip, SplitPercentageInput, dual TipTap editors, save/send flow
- [x] 05-03-PLAN.md — A/B test results page with side-by-side stats, SendWinnerModal, CampaignsPage integration (button, badge, routing)

**UI hint**: yes

### Phase 6: Sequences
**Goal**: Users can automate multi-step email follow-up sequences that send on a time-based schedule
**Depends on**: Phase 3
**Requirements**: SEQN-01, SEQN-02, SEQN-03, SEQN-04
**Success Criteria** (what must be TRUE):
  1. User can create a sequence with multiple steps, each with its own subject, body, and delay (e.g., Day 1, Day 3, Day 7)
  2. User can assign a contact list to a sequence to enroll all active contacts
  3. Sequence steps are sent automatically after their configured delay without manual action
  4. User can view enrollment count per sequence and delivery/open stats per step
**Plans**: 5 plans

Plans:
- [x] 06-01-PLAN.md — DB migration (4 tables + RLS), TypeScript types, data hooks (useSequences/useSequence), sidebar nav, route wiring
- [x] 06-02-PLAN.md — Sequence builder page: StepEditorPanel (TipTap per step), StartSequenceModal, shared settings, save/start flow
- [x] 06-03-PLAN.md — send-sequence-step Edge Function (pg_cron triggered, Resend send, tracking, enrollment advancement)
- [x] 06-04-PLAN.md — Sequences list page (table + actions) + Results page (enrollment count + per-step stats)
- [x] 06-05-PLAN.md — [BLOCKING] Schema push to live Supabase + full build/lint verification

**UI hint**: yes

### Phase 7: Templates & Settings
**Goal**: Users can save reusable email templates and configure their workspace and Resend integration
**Depends on**: Phase 2
**Requirements**: TMPL-01, TMPL-02, TMPL-03, TMPL-04, SETT-01, SETT-02, SETT-03, SETT-04
**Success Criteria** (what must be TRUE):
  1. User can save any campaign as a template and browse saved templates with name and preview
  2. User can start a new campaign pre-filled from a saved template, and delete templates they no longer need
  3. User can update workspace settings: company name, timezone, default sender name and email
  4. User can save their Resend API key and configure the unsubscribe footer text for all outgoing emails
**Plans**: 5 plans

Plans:
- [x] 07-01-PLAN.md — DB migration (templates table + profiles extensions), TypeScript types, useTemplates data hook
- [x] 07-02-PLAN.md — TemplatesPage with table layout, row actions (Use template + Delete), route wiring
- [x] 07-03-PLAN.md — SaveAsTemplateModal, CampaignsPage/CampaignBuilderPage entry points, template pre-fill
- [x] 07-04-PLAN.md — SettingsPage with Profile/Workspace/Integrations tabs, routing + sidebar updates
- [ ] 07-05-PLAN.md — [BLOCKING] Schema push to live Supabase + build/lint verification + smoke test

**UI hint**: yes

### Phase 8: Email Signature & Rich HTML Body
**Goal**: Users can define a persistent email signature and use text color and alignment formatting in all editors
**Depends on**: Phase 7
**Requirements**: SIG-01, SIG-02, SIG-03, SIG-04, SIG-05, CLR-01, ALN-01
**Success Criteria** (what must be TRUE):
  1. User can create and edit a rich-text email signature in the Settings Workspace tab
  2. Signature is automatically injected into all outgoing emails (campaigns, sequences, test sends)
  3. Signature appears in the campaign preview panel with an hr separator
  4. User can apply text color from a preset palette of 8 email-safe colors in the editor toolbar
  5. User can set text alignment (left, center, right) in the editor toolbar
**Plans**: 4 plans

Plans:
- [x] 08-01-PLAN.md — DB migration (signature columns), TipTap extension installs, TypeScript types, toolbar color picker + alignment buttons
- [ ] 08-02-PLAN.md — Signature editor in Settings Workspace tab, CampaignPreview signature display, builder preview wiring
- [x] 08-03-PLAN.md — Edge Function signature injection (send-campaign, send-sequence-step, send-test-email)
- [ ] 08-04-PLAN.md — [BLOCKING] Schema push + build/lint verification + smoke test

**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Contact Lists | 5/5 | Complete |  |
| 2. Campaign Builder | 2/4 | In Progress|  |
| 3. Email Delivery Engine | 0/5 | Not started | - |
| 4. Analytics & Dashboard | 2/3 | In Progress|  |
| 5. A/B Testing | 0/3 | Not started | - |
| 6. Sequences | 5/5 | Complete   | 2026-04-14 |
| 7. Templates & Settings | 4/5 | In Progress|  |
| 8. Email Signature & Rich HTML Body | 2/4 | In Progress|  |
