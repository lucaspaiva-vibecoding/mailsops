# Phase 9: CSV-Personalized Campaigns - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning
**Source:** User specification (all decisions locked)

<domain>
## Phase Boundary

Users upload a CSV where each row is a fully pre-composed email (first_name, last_name, email, subject, body as HTML). The platform upserts contacts, creates a campaign, creates one campaign_recipient per row with the per-row subject and body stored, then sends — using the existing tracking pipeline unchanged.

This bypasses the TipTap editor and contact list selection flow entirely. Body arrives pre-finalized; no variable substitution, no signature injection.

</domain>

<decisions>
## Implementation Decisions

### DB Schema (Migration 011)

- Extend `campaigns.campaign_type` check constraint to include `'csv_personalized'` (alongside existing `'standard'`, `'ab_test'`)
- Add `personalized_subject TEXT NULL` to `campaign_recipients` — NULL for standard/A-B campaigns
- Add `personalized_body TEXT NULL` to `campaign_recipients` — NULL for standard/A-B campaigns
- Migration file: `supabase/migrations/011_csv_personalized.sql`

### CSV Schema

Exact column names (case-sensitive validation required):
- `first_name` — upserted to contacts.first_name
- `last_name` — upserted to contacts.last_name
- `email` — upsert key alongside workspace_id
- `subject` — stored in campaign_recipients.personalized_subject
- `body` — HTML string, stored in campaign_recipients.personalized_body

### Contact Upsert

- Upsert rows into `contacts` by `(workspace_id, email)` — same pattern as CSV import in Phase 1
- Use `onConflict: 'workspace_id,email'` with update of first_name/last_name

### Campaign Creation

- `campaign_type = 'csv_personalized'`
- Sender name + email come from `profiles.default_sender_name` / `profiles.default_sender_email`
- No contact_list_id selection — campaign is self-contained
- `body_html` and `body_json` on campaigns table remain NULL for csv_personalized type

### Edge Function: send-campaign Branch

- If `recipient.personalized_body IS NOT NULL`: use `recipient.personalized_body` as html and `recipient.personalized_subject` as subject
- Tracking pipeline unchanged: pixel injection, link wrapping via `t` Edge Function, unsubscribe footer all apply
- No signature injection for csv_personalized (body is already final)
- No `{{variable}}` substitution — body is sent as-is

### UI Flow

1. CampaignsPage "New campaign" button becomes a dropdown with 3 options:
   - Standard
   - A/B Test → existing route
   - CSV Personalized → `/campaigns/new/csv`
2. Route `/campaigns/new/csv`: dropzone → papaparse (already installed) → column validation → preview first 5 rows → create campaign + recipients in one operation
3. Post-create: redirect to a review page showing recipient list + send-now / schedule controls
4. Campaign list: CSV campaigns show a "CSV" badge (distinct from standard/A-B badges)
5. Analytics: reuses existing `CampaignAnalyticsPage` — tracking events keyed by `campaign_recipient_id` work as-is

### Out of Scope (this phase)

- Variable substitution inside CSV body
- Per-row sender override
- Scheduling individual rows at different times
- CSV re-run/resume on partial failure

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Delivery Pipeline
- `supabase/functions/send-campaign/index.ts` — Edge Function to be branched for personalized_body
- `supabase/migrations/010_signature.sql` — Most recent migration (next is 011)
- `supabase/migrations/007_ab_test_columns.sql` — Pattern for extending campaign_type constraint

### Frontend Patterns
- `src/pages/campaigns/CampaignsPage.tsx` — "New campaign" button location; needs dropdown
- `src/pages/campaigns/CampaignBuilderPage.tsx` — Reference for campaign creation flow
- `src/hooks/useCampaigns.ts` — Data hook pattern to follow for useCsvCampaign
- `src/components/campaigns/CampaignEditorToolbar.tsx` — Existing toolbar (NOT used in this phase)

### Phase 1 CSV Import (reuse patterns)
- `src/pages/contacts/ContactsPage.tsx` — CSV import wizard reference (papaparse, dropzone, validation)
- `supabase/migrations/001_contact_import_logs.sql` — Contact upsert migration pattern

### Prior Phase Context
- `.planning/phases/05-a-b-testing/05-CONTEXT.md` — campaign_type extension pattern (A-B)
- `.planning/phases/07-templates-settings/07-CONTEXT.md` — workspace default sender fields
- `.planning/phases/08-email-signature-rich-html-body/08-CONTEXT.md` — signature injection (NOT applied in this phase)

</canonical_refs>

<specifics>
## Specific Implementation Notes

- papaparse is already installed — no new npm dependency needed for CSV parsing
- The 5-row preview must show truncated body (first 100 chars of HTML stripped to plain text) to avoid rendering raw HTML in the UI
- Column validation must reject the CSV if any of the 5 required columns are missing (show user-friendly error listing missing columns)
- `personalized_subject` and `personalized_body` are NULL on campaign_recipients for non-csv_personalized campaigns — existing queries are unaffected

</specifics>

<deferred>
## Deferred Ideas

- Variable substitution inside CSV body (e.g. allowing `{{custom_field}}`) — v2
- Per-row sender override (different from_name / from_email per row) — v2
- Scheduling individual rows at different times — v2
- CSV re-run/resume on partial failure — v2
- Attachment support per row — v2

</deferred>

---

*Phase: 09-csv-personalized-campaigns*
*Context gathered: 2026-04-15 via user specification (PRD-style, all decisions locked)*
