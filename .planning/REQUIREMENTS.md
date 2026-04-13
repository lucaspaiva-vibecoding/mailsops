# Requirements: MailOps

**Defined:** 2026-04-13
**Core Value:** Marketers can send targeted email campaigns and see exactly who opened, clicked, or replied — without leaving the app.

## v1 Requirements

Requirements for full build (Modules 2–10). Module 1 (Auth) already shipped.

### Contacts (Module 2)

- [x] **CONT-01**: User can upload a CSV file and map columns to contact fields (email, first name, last name, company)
- [x] **CONT-02**: CSV import handles duplicates — skip or update existing contacts by email
- [x] **CONT-03**: User can apply tags to all contacts during CSV import
- [x] **CONT-04**: User can view import history with row counts and error details
- [x] **CONT-05**: User can manually create, edit, and delete individual contacts
- [x] **CONT-06**: User can search contacts by email or name
- [x] **CONT-07**: User can filter contacts by tag
- [x] **CONT-08**: User can filter contacts by status (active, unsubscribed, bounced)
- [x] **CONT-09**: User can filter contacts by custom field values

### Contact Lists (Module 2)

- [x] **LIST-01**: User can create a contact list with name, description, and color
- [x] **LIST-02**: User can rename and delete contact lists
- [x] **LIST-03**: User can add and remove contacts from a list
- [x] **LIST-04**: User can view contacts within a specific list
- [x] **LIST-05**: Contact lists display contact count

### Campaign Builder (Module 3)

- [x] **CAMP-01**: User can create a campaign with name, subject line, preview text, sender name, and sender email
- [x] **CAMP-02**: User can build email body with TipTap rich text editor (bold, italic, links, headings, bullets, images)
- [x] **CAMP-03**: User can insert personalization variables ({{first_name}}, {{last_name}}, {{company}}) into subject or body
- [x] **CAMP-04**: User can select a contact list as campaign target
- [x] **CAMP-05**: User can schedule a campaign for future delivery
- [x] **CAMP-06**: User can send a test email to their own address before launching
- [x] **CAMP-07**: User can save campaign as draft and return to edit later
- [x] **CAMP-08**: User can duplicate an existing campaign

### Email Delivery (Module 4)

- [ ] **DELV-01**: User can send a campaign to all active contacts in the target list via Resend API
- [ ] **DELV-02**: System wraps all links in campaign body with tracking redirect URLs before sending
- [ ] **DELV-03**: System embeds a 1×1 transparent tracking pixel in every campaign email
- [ ] **DELV-04**: Open events are recorded via Supabase Edge Function when pixel loads
- [ ] **DELV-05**: Click events are recorded and recipient is redirected to the original URL
- [ ] **DELV-06**: Contacts who load the unsubscribe URL are marked as unsubscribed automatically
- [ ] **DELV-07**: Resend webhooks update delivered/bounced status for each recipient

### Analytics & Metrics (Module 5)

- [ ] **ANLX-01**: User can view per-campaign summary stats (sent, delivered, open rate, click rate, bounce rate, unsubscribe rate)
- [ ] **ANLX-02**: User can see a chronological event timeline for a campaign
- [ ] **ANLX-03**: User can see per-link click breakdown with click count and unique clicks
- [ ] **ANLX-04**: User can see per-recipient engagement — who opened, clicked, bounced, or unsubscribed

### Dashboard (Module 6)

- [ ] **DASH-01**: User sees account-wide summary stats: total contacts, total campaigns sent, average open rate
- [ ] **DASH-02**: User sees a list of recent campaigns with name, status, sent date, and open/click rates
- [ ] **DASH-03**: User sees total number of contact lists and unsubscribe count

### A/B Testing (Module 7)

- [ ] **ABTS-01**: User can create an A/B test campaign with 2 variants (different subject lines and/or bodies)
- [ ] **ABTS-02**: User can set the test split percentage between variants (e.g., 50/50)
- [ ] **ABTS-03**: User can view A/B test results comparing open rate and click rate per variant
- [ ] **ABTS-04**: User can manually select a winning variant and send it to the remaining contacts

### Sequences / Drip Campaigns (Module 8)

- [ ] **SEQN-01**: User can create a sequence with multiple email steps, each with its own subject, body, and delay
- [ ] **SEQN-02**: User can assign a contact list to a sequence to enroll all active contacts
- [ ] **SEQN-03**: System sends each sequence step automatically after the configured delay (e.g., Day 1, Day 3, Day 7)
- [ ] **SEQN-04**: User can view per-sequence enrollment count and per-step delivery/open stats

### Template Library (Module 9)

- [ ] **TMPL-01**: User can save any campaign as a reusable template
- [ ] **TMPL-02**: User can browse saved templates with name preview
- [ ] **TMPL-03**: User can create a new campaign pre-filled from a selected template
- [ ] **TMPL-04**: User can delete templates they no longer need

### Settings & Integrations (Module 10)

- [ ] **SETT-01**: User can update workspace settings: company name, timezone, default sender name and email
- [ ] **SETT-02**: User can configure and save their Resend API key
- [ ] **SETT-03**: User can view the active sending domain (shared Resend domain displayed)
- [ ] **SETT-04**: User can configure unsubscribe footer text included in all outgoing emails

## v2 Requirements

Deferred — not in current roadmap.

### Advanced Delivery

- **DELV-V2-01**: Custom sending domain with DKIM/SPF setup in Resend
- **DELV-V2-02**: Automatic send-time optimization based on recipient engagement history

### Teams

- **TEAM-V2-01**: Workspace owner can invite team members via email
- **TEAM-V2-02**: Team members can access shared contacts and campaigns
- **TEAM-V2-03**: Role-based access control (owner, editor, viewer)

### Advanced Analytics

- **ANLX-V2-01**: GeoIP breakdown (opens/clicks by country)
- **ANLX-V2-02**: Email client breakdown (Gmail, Outlook, Apple Mail, etc.)
- **ANLX-V2-03**: Engagement over time chart (opens/clicks by day)

### Advanced A/B Testing

- **ABTS-V2-01**: Auto-send winner after N hours based on open rate threshold

### Segmentation

- **SEG-V2-01**: Save contact filter as a named reusable segment
- **SEG-V2-02**: Use saved segments as campaign targets

## Out of Scope

| Feature | Reason |
|---------|--------|
| Custom email sending domain | Start with Resend shared domain; add in v2 |
| Multi-user team workspaces | Workspace = user for MVP; schema is team-ready for v2 |
| Mobile app | Web-first SaaS |
| Real-time collaboration | High complexity, not core to v1 value |
| AI-generated email content | Out of scope for v1 |
| Auto send-time optimization | v2 feature |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONT-01 | Phase 1 — Contact Lists | Complete |
| CONT-02 | Phase 1 — Contact Lists | Complete |
| CONT-03 | Phase 1 — Contact Lists | Complete |
| CONT-04 | Phase 1 — Contact Lists | Complete |
| CONT-05 | Phase 1 — Contact Lists | Complete |
| CONT-06 | Phase 1 — Contact Lists | Complete |
| CONT-07 | Phase 1 — Contact Lists | Complete |
| CONT-08 | Phase 1 — Contact Lists | Complete |
| CONT-09 | Phase 1 — Contact Lists | Complete |
| LIST-01 | Phase 1 — Contact Lists | Complete |
| LIST-02 | Phase 1 — Contact Lists | Complete |
| LIST-03 | Phase 1 — Contact Lists | Complete |
| LIST-04 | Phase 1 — Contact Lists | Complete |
| LIST-05 | Phase 1 — Contact Lists | Complete |
| CAMP-01 | Phase 2 — Campaign Builder | Complete |
| CAMP-02 | Phase 2 — Campaign Builder | Complete |
| CAMP-03 | Phase 2 — Campaign Builder | Complete |
| CAMP-04 | Phase 2 — Campaign Builder | Complete |
| CAMP-05 | Phase 2 — Campaign Builder | Complete |
| CAMP-06 | Phase 2 — Campaign Builder | Complete |
| CAMP-07 | Phase 2 — Campaign Builder | Complete |
| CAMP-08 | Phase 2 — Campaign Builder | Complete |
| DELV-01 | Phase 3 — Email Delivery Engine | Pending |
| DELV-02 | Phase 3 — Email Delivery Engine | Pending |
| DELV-03 | Phase 3 — Email Delivery Engine | Pending |
| DELV-04 | Phase 3 — Email Delivery Engine | Pending |
| DELV-05 | Phase 3 — Email Delivery Engine | Pending |
| DELV-06 | Phase 3 — Email Delivery Engine | Pending |
| DELV-07 | Phase 3 — Email Delivery Engine | Pending |
| ANLX-01 | Phase 4 — Analytics & Dashboard | Pending |
| ANLX-02 | Phase 4 — Analytics & Dashboard | Pending |
| ANLX-03 | Phase 4 — Analytics & Dashboard | Pending |
| ANLX-04 | Phase 4 — Analytics & Dashboard | Pending |
| DASH-01 | Phase 4 — Analytics & Dashboard | Pending |
| DASH-02 | Phase 4 — Analytics & Dashboard | Pending |
| DASH-03 | Phase 4 — Analytics & Dashboard | Pending |
| ABTS-01 | Phase 5 — A/B Testing | Pending |
| ABTS-02 | Phase 5 — A/B Testing | Pending |
| ABTS-03 | Phase 5 — A/B Testing | Pending |
| ABTS-04 | Phase 5 — A/B Testing | Pending |
| SEQN-01 | Phase 6 — Sequences | Pending |
| SEQN-02 | Phase 6 — Sequences | Pending |
| SEQN-03 | Phase 6 — Sequences | Pending |
| SEQN-04 | Phase 6 — Sequences | Pending |
| TMPL-01 | Phase 7 — Templates & Settings | Pending |
| TMPL-02 | Phase 7 — Templates & Settings | Pending |
| TMPL-03 | Phase 7 — Templates & Settings | Pending |
| TMPL-04 | Phase 7 — Templates & Settings | Pending |
| SETT-01 | Phase 7 — Templates & Settings | Pending |
| SETT-02 | Phase 7 — Templates & Settings | Pending |
| SETT-03 | Phase 7 — Templates & Settings | Pending |
| SETT-04 | Phase 7 — Templates & Settings | Pending |

**Coverage:**
- v1 requirements: 49 total
- Mapped to phases: 49
- Unmapped: 0

---
*Requirements defined: 2026-04-13*
*Last updated: 2026-04-13 after roadmap creation*
