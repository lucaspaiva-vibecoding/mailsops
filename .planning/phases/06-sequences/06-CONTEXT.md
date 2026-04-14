---
phase: 06-sequences
created: 2026-04-14
requirements: SEQN-01, SEQN-02, SEQN-03, SEQN-04
---

# Phase 6: Sequences — Implementation Context

## Phase Boundary

Build multi-step drip campaigns with time-based delays and per-step delivery stats.

**This phase delivers:**
- Sequence builder (create/edit sequence with N steps, each with subject, body, delay)
- Enrollment: assign a contact list, then explicitly start the sequence
- Automatic step sending via Supabase pg_cron + new Edge Function
- Sequences list page with enrollment counts and per-step stats

**Out of scope for this phase:**
- Sequences triggered by events (contact signs up, opens email, etc.) — deferred
- Conditions / branching (if opened step 1, send X, else send Y) — deferred
- Adding contacts to a running sequence after it starts — deferred
- Stop condition other than unsubscribe/bounce — deferred

---

## Implementation Decisions

### D-01: Scheduling mechanism — pg_cron + Edge Function

Automatic step sending uses **Supabase pg_cron** (built-in PostgreSQL scheduler). A cron job runs on a schedule (every hour is sufficient for day-granularity delays) and invokes a new `send-sequence-step` Edge Function.

The cron job selects all enrollments where:
- `status = 'active'`
- `next_send_at <= now()`
- `current_step <= total_steps`

For each matching enrollment, it invokes the Edge Function, which sends the email via Resend and advances `current_step` + computes the next `next_send_at`.

**Enabling pg_cron:** Requires enabling the `pg_cron` extension in the Supabase dashboard (Database → Extensions). The cron schedule is defined in a migration file using `cron.schedule()`.

### D-02: Data model — dedicated tables (NOT campaigns table reuse)

Three new tables:

**`sequences`**
- `id` UUID PK
- `workspace_id` UUID NOT NULL (RLS scope)
- `name` TEXT NOT NULL
- `status` TEXT NOT NULL DEFAULT 'draft' — CHECK ('draft', 'active', 'paused', 'archived')
- `contact_list_id` UUID REFERENCES contact_lists(id)
- `from_name` TEXT NOT NULL
- `from_email` TEXT NOT NULL
- `reply_to_email` TEXT
- `created_at` TIMESTAMPTZ
- `updated_at` TIMESTAMPTZ

**`sequence_steps`**
- `id` UUID PK
- `sequence_id` UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE
- `step_number` INT NOT NULL — 1-indexed, determines order
- `delay_days` INT NOT NULL DEFAULT 0 — days after enrollment to send this step
- `subject` TEXT NOT NULL
- `body_html` TEXT NOT NULL DEFAULT ''
- `body_json` JSONB — TipTap JSON
- `created_at` TIMESTAMPTZ

**`sequence_enrollments`**
- `id` UUID PK
- `sequence_id` UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE
- `contact_id` UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE
- `workspace_id` UUID NOT NULL (denormalized for RLS)
- `status` TEXT NOT NULL DEFAULT 'active' — ('active', 'completed', 'unsubscribed', 'bounced')
- `current_step` INT NOT NULL DEFAULT 1 — next step to send (1-indexed)
- `enrolled_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- `next_send_at` TIMESTAMPTZ NOT NULL — when to send current_step
- `completed_at` TIMESTAMPTZ
- UNIQUE(sequence_id, contact_id)

Per-step stats are read from `campaign_recipients` joined on a tracking mechanism — see D-05.

### D-03: Delay model — from enrollment date

All step delays are computed relative to `enrolled_at`, not the previous step's actual send time:

```
next_send_at = enrolled_at + interval '${delay_days} days'
```

When a step is sent, `current_step` is incremented and `next_send_at` is set to `enrolled_at + next_step.delay_days days`. If there is no next step, `status` is set to `'completed'`.

This means delay_days must be strictly increasing across steps (step 1 = day 1, step 2 = day 4, step 3 = day 7). Researcher/planner should validate and enforce this in the UI.

### D-04: Enrollment flow — explicit Start button

The sequence lifecycle:

1. **Draft** — user creates/edits sequence (steps, settings). No emails sent. No enrollments exist yet.
2. **Start sequence** (user clicks button) — Edge Function or RPC:
   - Inserts `sequence_enrollments` for all `active` contacts in `contact_list_id`
   - Computes `next_send_at = now() + interval '${step_1.delay_days} days'` for each
   - Sets `sequences.status = 'active'`
3. **Active** — pg_cron sends steps automatically
4. **Paused** — user can pause; cron skips enrollments where sequence.status = 'paused'
5. **Archived** — sequence retired (not deletable if enrollments exist)

Contacts added to the list AFTER the sequence starts are NOT auto-enrolled (deferred). The enrollment snapshot is taken at Start time.

### D-05: Per-step stats tracking

Each sequence step send creates a `campaign_recipients` row (reusing the existing tracking infrastructure). To correlate, the `sequence_enrollments` or a new `sequence_step_sends` linking table tracks which `campaign_recipients` row corresponds to which step.

**Claude's Discretion:** Whether to add a `sequence_step_sends` bridge table or store `step_number` in `campaign_recipients` settings JSONB. Researcher should investigate the least-invasive approach that lets SEQN-04 (per-step stats) query work cleanly.

### D-06: Navigation — new sidebar item

Add "Sequences" to the sidebar between Campaigns and Templates. Use `Workflow` or `ListOrdered` from lucide-react as the icon. Route: `/sequences`.

Routes to add in App.tsx:
- `/sequences` — SequencesPage (list of all sequences)
- `/sequences/new` — SequenceBuilderPage (create mode)
- `/sequences/:id/edit` — SequenceBuilderPage (edit mode)
- `/sequences/:id/results` — SequenceResultsPage (enrollment + per-step stats)

### D-07: Sequence builder step editor

Each step has:
- Delay (number input, in days, default 0 = same day)
- Subject line with variable insertion (same `{{ }}` button from CampaignBuilderPage)
- TipTap editor body (same extension set as CampaignBuilderPage)

Steps are displayed as a vertical ordered list. User can add steps (button at bottom) and reorder (drag or up/down arrows — Claude's Discretion on interaction).

The sequence-level shared settings (from_name, from_email, reply_to, contact_list) are shown once at the top of the builder (same pattern as AbTestBuilderPage shared settings card).

### D-08: Unsubscribe / bounce stop conditions

When a contact unsubscribes or bounces during a sequence:
- The existing tracking Edge Function (`t`) already marks contacts as `unsubscribed`
- The `send-sequence-step` Edge Function must check `contacts.status = 'active'` before sending each step
- On unsubscribe/bounce detected at send time, set `sequence_enrollments.status = 'unsubscribed'` or `'bounced'`

### Claude's Discretion

- Step reorder UX (drag-and-drop vs. up/down arrow buttons)
- Whether `sequence_step_sends` is a bridge table or JSONB metadata in campaign_recipients
- Whether pg_cron runs every hour or every 15 minutes (hour is sufficient for day-level delays)
- Pagination/loading pattern for the sequences list page
- Empty state design for sequence with no steps yet

---

## Canonical References

### Project
- `.planning/PROJECT.md` — constraints, tech stack, Supabase project ID
- `.planning/REQUIREMENTS.md` — SEQN-01 through SEQN-04
- `.planning/ROADMAP.md` — Phase 6 goal and success criteria

### Prior phase patterns
- `.planning/phases/05-a-b-testing/05-01-PLAN.md` — migration pattern, RLS, CampaignType extension
- `.planning/phases/05-a-b-testing/05-02-PLAN.md` — shared settings card + per-variant editors (builder pattern)
- `.planning/phases/03-email-delivery-engine/03-03-PLAN.md` — send-campaign Edge Function (Resend batch, tracking injection)
- `.planning/phases/03-email-delivery-engine/03-02-PLAN.md` — tracking Edge Function `t` (pixel/click/unsub)

### Codebase entry points
- `src/App.tsx` — route declarations (add `/sequences/*` routes here)
- `src/components/layout/Sidebar.tsx` — nav items (add Sequences entry)
- `src/components/layout/AppLayout.tsx` — pageTitles map (add `/sequences` title)
- `src/types/database.ts` — Campaign, CampaignType, AbTestSettings (pattern reference for new types)
- `src/hooks/campaigns/useCampaigns.ts` — hook pattern for list + mutations
- `src/pages/campaigns/AbTestBuilderPage.tsx` — shared settings + per-step editor pattern
- `supabase/functions/send-campaign/index.ts` — Resend send logic to reuse in send-sequence-step
- `supabase/migrations/007_ab_test_columns.sql` — latest migration (naming convention: 008_sequences.sql)

---

## Existing Code Insights

### Reusable Assets
- `src/components/campaigns/CampaignEditorToolbar.tsx` — TipTap toolbar (reuse per step)
- `src/components/campaigns/VariableChipNode.tsx` + `VariableSlashCommand.tsx` — variable insertion extensions
- `src/components/campaigns/VariableDropdown.tsx` — `VARIABLES` constant + dropdown for subject variable insertion
- `src/components/ui/Button.tsx`, `Card.tsx`, `Input.tsx`, `Spinner.tsx`, `Badge.tsx` — full UI kit
- `src/components/analytics/StatCard.tsx` — for per-step stats display (open rate, sent)
- `src/lib/analyticsUtils.ts` — `formatRate()` for open/click rate display

### Established Patterns
- Hooks in `src/hooks/{domain}/use{Entity}.ts` — create `src/hooks/sequences/useSequences.ts` + `useSequence.ts`
- Pages in `src/pages/{domain}/{Entity}Page.tsx` — create `src/pages/sequences/`
- Migration naming: `008_sequences.sql` (next after 007)
- RLS pattern: all tables require `workspace_id` + matching policy checking `profiles.workspace_id`
- `useAuth()` → `profile.workspace_id` for all workspace-scoped queries

### Integration Points
- `supabase/functions/send-campaign/index.ts` — `contact_ids` override (added in Phase 5) can be reused for per-contact step sends
- `supabase/migrations/004_campaign_recipients.sql` — `campaign_recipients` table (reuse for step tracking)
- `contacts.status = 'active'` check pattern — used by send-campaign, must be checked in send-sequence-step too
- `supabase/config.toml` — Edge Function registration pattern for new `send-sequence-step` function

---

## Specific Ideas

None captured during discussion — no "I want it like X" references provided.

---

## Deferred Ideas

- **Event-triggered enrollment** — enroll when contact performs an action (signup form, link click). Deferred.
- **Branching sequences** — if/else logic based on whether step was opened. Deferred.
- **Enroll new contacts after start** — contacts added to list after sequence starts join automatically. Deferred.
- **Auto-win after N hours** — similar to ABTS-V2-01. Deferred.
- **Stop on reply** — stop sending to contacts who replied. Requires reply webhook. Deferred.
