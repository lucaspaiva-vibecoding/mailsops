# Phase 6: Sequences — Research

**Researched:** 2026-04-14
**Domain:** Supabase drip sequences — pg_cron scheduling, Edge Functions, multi-step email automation, React multi-editor UI
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01: Scheduling mechanism — pg_cron + Edge Function**
Automatic step sending uses Supabase pg_cron. A cron job runs every hour and invokes a new `send-sequence-step` Edge Function. The cron job selects all enrollments where `status = 'active'`, `next_send_at <= now()`, `current_step <= total_steps`.

**D-02: Data model — dedicated tables (NOT campaigns table reuse)**
Three new tables: `sequences`, `sequence_steps`, `sequence_enrollments`. Per-step stats read from `campaign_recipients` joined on tracking mechanism (see D-05).

**D-03: Delay model — from enrollment date**
All step delays computed relative to `enrolled_at`. `next_send_at = enrolled_at + interval '${delay_days} days'`. delay_days must be strictly increasing across steps.

**D-04: Enrollment flow — explicit Start button**
Lifecycle: Draft → Start (button) → Active → Paused → Archived. Enrollment snapshot taken at Start time. Contacts added after start are NOT auto-enrolled.

**D-05: Per-step stats tracking**
Each sequence step send creates a `campaign_recipients` row. Whether to add a `sequence_step_sends` bridge table or store `step_number` in `campaign_recipients` settings JSONB is Claude's Discretion.

**D-06: Navigation — new sidebar item**
Add "Sequences" to sidebar between Campaigns and Templates. Use `Workflow` or `ListOrdered` icon. Route: `/sequences`. Four routes total.

**D-07: Sequence builder step editor**
Each step: delay (days), subject with variable insertion, TipTap body. Steps as vertical ordered list. Shared settings (from_name, from_email, reply_to, contact_list) once at top.

**D-08: Unsubscribe / bounce stop conditions**
`send-sequence-step` must check `contacts.status = 'active'` before sending. On unsubscribe/bounce: set `sequence_enrollments.status` accordingly.

### Claude's Discretion

- Step reorder UX (drag-and-drop vs. up/down arrow buttons) — UI-SPEC chose up/down arrows
- Whether `sequence_step_sends` is a bridge table or JSONB metadata in campaign_recipients
- Whether pg_cron runs every hour or every 15 minutes
- Pagination/loading pattern for the sequences list page
- Empty state design for sequence with no steps yet

### Deferred Ideas (OUT OF SCOPE)

- Event-triggered enrollment
- Branching sequences (if/else logic)
- Enroll new contacts after start
- Auto-win after N hours
- Stop on reply (requires reply webhook)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEQN-01 | User can create a sequence with multiple email steps, each with its own subject, body, and delay | Sequence builder UI with StepEditorPanel, TipTap per step, delay_days input; sequence_steps table DDL |
| SEQN-02 | User can assign a contact list to a sequence to enroll all active contacts | sequences.contact_list_id FK; enrollment RPC/Edge Function at Start time; contact_list_members query |
| SEQN-03 | System sends each sequence step automatically after the configured delay (e.g., Day 1, Day 3, Day 7) | pg_cron + pg_net + send-sequence-step Edge Function; cron.schedule every hour; next_send_at column |
| SEQN-04 | User can view per-sequence enrollment count and per-step delivery/open stats | SequenceResultsPage; sequence_enrollments count query; campaign_recipients JOIN via sequence_step_sends or JSONB |
</phase_requirements>

---

## Summary

Phase 6 adds multi-step drip sequences to MailOps. The core technical work is a new database schema (3 tables), a new `send-sequence-step` Edge Function, a pg_cron job that triggers it hourly, and a React UI with a sequence builder and results page.

The biggest technical challenge is the pg_cron-to-Edge Function authentication pattern. The standard Supabase approach requires storing credentials in Vault (`vault.decrypted_secrets`) and using `pg_net.http_post()` to call the function endpoint. Since the cron job has no user JWT, the `send-sequence-step` function should be configured with `verify_jwt: false` in `supabase/config.toml` and instead validate an internal secret header to prevent unauthorized calls. This is the same pattern used by the existing `t` and `resend-webhook` functions in this project.

The per-step stats question (D-05 discretion) resolves cleanly by creating a `sequence_step_sends` linking table — a 4-column bridge table (UUID PK, sequence_enrollment_id, sequence_step_id, campaign_recipient_id, step_number) — rather than adding noise to the campaign_recipients JSONB `variables` column. This keeps the stats query a clean JOIN and avoids type coercion.

**Primary recommendation:** Implement pg_cron with `verify_jwt: false` + internal secret header for the Edge Function. Use a `sequence_step_sends` bridge table for clean per-step stats JOINs.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | 2.49.4 (installed) | DB queries, auth, Edge Function invocations | Already in project |
| pg_cron | 1.6.4 (Supabase managed) | Hourly cron job to trigger step sending | Built into Supabase; enabled via Dashboard > Extensions |
| pg_net | Supabase managed | HTTP POST from inside Postgres to invoke Edge Function | Required for pg_cron → Edge Function pattern |
| Deno (Supabase Edge Functions) | Managed | `send-sequence-step` function runtime | Established by send-campaign pattern |
| @tiptap/react + @tiptap/starter-kit | 2.11.5 (installed) | Per-step email body editor | Already in project |
| react-router-dom | 7.5.3 (installed) | Routing for /sequences/* | Already in project |

[VERIFIED: codebase grep — supabase-js 2.49.4, tiptap 2.11.5, react-router-dom 7.5.3 in package.json]
[CITED: https://supabase.com/docs/guides/functions/schedule-functions — pg_cron + pg_net pattern for invoking Edge Functions]
[CITED: https://supabase.com/docs/guides/database/extensions/pg_net — net.http_post signature]

### No New npm Packages Required

All frontend dependencies already installed. pg_cron and pg_net are Supabase-managed Postgres extensions enabled via Dashboard — not npm packages.

**Installation:**
```bash
# No new npm packages — all dependencies already in project
# Enable pg_cron: Supabase Dashboard → Database → Extensions → search "pg_cron" → enable
# Enable pg_net: Supabase Dashboard → Database → Extensions → search "pg_net" → enable
# Both can also be enabled via migration: CREATE EXTENSION IF NOT EXISTS pg_cron;
```

[CITED: https://supabase.com/docs/guides/cron — pg_cron enablement]
[CITED: https://supabase.com/docs/guides/database/extensions/pg_net — pg_net enablement]

---

## Architecture Patterns

### Recommended Project Structure

New files this phase creates:

```
supabase/
├── migrations/
│   └── 008_sequences.sql           # All three tables + RLS + pg_cron schedule
├── functions/
│   └── send-sequence-step/
│       └── index.ts                # New Edge Function (verify_jwt: false)
└── config.toml                     # Add [functions.send-sequence-step] verify_jwt = false

src/
├── types/
│   └── database.ts                 # Add Sequence, SequenceStep, SequenceEnrollment interfaces
├── hooks/
│   └── sequences/
│       ├── useSequences.ts         # List hook (matches useCampaigns pattern)
│       └── useSequence.ts          # Single sequence hook (matches useCampaign pattern)
├── components/
│   └── sequences/
│       ├── StepEditorPanel.tsx     # Per-step: delay input, subject, TipTap editor
│       └── StartSequenceModal.tsx  # Confirmation modal before enrollment
└── pages/
    └── sequences/
        ├── SequencesPage.tsx       # List page
        ├── SequenceBuilderPage.tsx # Create/edit builder
        └── SequenceResultsPage.tsx # Enrollment + per-step stats
```

### Pattern 1: pg_cron Hourly Schedule + pg_net Edge Function Invocation

**What:** Supabase pg_cron calls `cron.schedule()` which uses `pg_net.http_post()` to invoke the `send-sequence-step` Edge Function once per hour. Authentication uses credentials stored in Supabase Vault.

**When to use:** Whenever scheduled background work needs to invoke a Supabase Edge Function without user context.

**Example:**
```sql
-- Source: https://supabase.com/docs/guides/functions/schedule-functions
-- In migration 008_sequences.sql (after enabling extensions):

-- Store project URL and anon key in Vault (one-time manual step in Supabase SQL editor)
-- select vault.create_secret('https://pozqnzhgqmajtaidtpkk.supabase.co', 'project_url');
-- select vault.create_secret('YOUR_ANON_KEY', 'anon_key');

-- Schedule the cron job (inside migration, runs after extensions are enabled)
SELECT cron.schedule(
  'send-sequence-steps-hourly',
  '0 * * * *',  -- every hour at :00
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
           || '/functions/v1/send-sequence-step',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key'),
      'x-internal-secret', current_setting('app.sequence_cron_secret', true)
    ),
    body := jsonb_build_object('triggered_at', now()),
    timeout_milliseconds := 30000
  ) AS request_id;
  $$
);
```

**Important caveat on Vault approach:** The Vault `create_secret` calls CANNOT be included in the migration file because Vault secrets must be seeded manually (or via a separate script). The `cron.schedule` SQL itself can be in the migration, but the vault secrets must pre-exist. The planner should document the `cron.schedule` SQL in the migration and note that Vault secrets require a manual one-time setup step.

[CITED: https://supabase.com/docs/guides/functions/schedule-functions]
[CITED: https://supabase.com/docs/guides/database/extensions/pg_net]

### Pattern 2: verify_jwt: false + Internal Secret Header

**What:** Since pg_cron has no user JWT to attach, `send-sequence-step` uses `verify_jwt: false`. Access control is enforced by checking a pre-shared internal secret in the request header.

**When to use:** Any Edge Function invoked by pg_cron, webhooks, or other non-user callers.

**Example:**
```typescript
// supabase/functions/send-sequence-step/index.ts
// Source: established pattern from t/index.ts and resend-webhook/index.ts in this project

const INTERNAL_SECRET = Deno.env.get('SEQUENCE_CRON_SECRET') ?? ''

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Internal secret check (since verify_jwt: false)
  const internalSecret = req.headers.get('x-internal-secret')
  if (!INTERNAL_SECRET || internalSecret !== INTERNAL_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Use service role for all DB operations
  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )
  // ... rest of function
})
```

```toml
# supabase/config.toml — add this block
[functions.send-sequence-step]
verify_jwt = false
```

[VERIFIED: codebase — supabase/config.toml shows same pattern for `t` and `resend-webhook` functions]

### Pattern 3: send-sequence-step Core Logic

**What:** The Edge Function queries `sequence_enrollments` for due enrollments, sends the email via Resend, records in `campaign_recipients`, inserts a `sequence_step_sends` row, and advances `current_step` + computes `next_send_at`.

**Example:**
```typescript
// Core query — finds enrollments that are due
const { data: dueEnrollments } = await adminClient
  .from('sequence_enrollments')
  .select(`
    *,
    sequences(id, status, from_name, from_email, reply_to_email, workspace_id),
    contacts(id, email, first_name, last_name, company, status)
  `)
  .eq('status', 'active')
  .lte('next_send_at', new Date().toISOString())
  .limit(100)  // safety cap per invocation

// For each enrollment:
// 1. Check sequence.status === 'active' (skip if paused)
// 2. Check contact.status === 'active' (skip if unsubscribed/bounced, update enrollment)
// 3. Load sequence_step where step_number = enrollment.current_step
// 4. Send via Resend (single email, not batch — sequences are per-contact)
// 5. Insert campaign_recipients row (reuse existing schema + tracking infrastructure)
// 6. Insert sequence_step_sends row (bridge for per-step stats)
// 7. Advance: increment current_step, compute next next_send_at
// 8. If no next step exists: set enrollment.status = 'completed'
```

[ASSUMED] The `limit(100)` per-invocation cap is a reasonable safety measure. Actual throughput depends on Resend API rate limits and function timeout. If enrollment count exceeds 100 per hour, multiple cron invocations will drain the queue naturally.

### Pattern 4: sequence_step_sends Bridge Table (Claude's Discretion Resolution)

**What:** A 5-column bridge table linking `sequence_enrollments` to `campaign_recipients` with step metadata. This is the recommended approach over storing step_number in campaign_recipients JSONB.

**Why preferred over JSONB approach:**
- JOINs for SEQN-04 stats are clean: `sequence_step_sends JOIN campaign_recipients ON ...`
- No JSONB casting needed in stats queries
- campaign_recipients.variables column already serves its purpose (link map for tracking)
- Migration is additive — no modification to campaign_recipients schema

```sql
-- Part of migration 008_sequences.sql
CREATE TABLE public.sequence_step_sends (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_enrollment_id UUID NOT NULL REFERENCES sequence_enrollments(id) ON DELETE CASCADE,
  sequence_step_id      UUID NOT NULL REFERENCES sequence_steps(id) ON DELETE CASCADE,
  campaign_recipient_id UUID NOT NULL REFERENCES campaign_recipients(id) ON DELETE CASCADE,
  step_number           INT NOT NULL,
  sent_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  workspace_id          UUID NOT NULL  -- denormalized for RLS
);

CREATE INDEX idx_seq_step_sends_enrollment ON sequence_step_sends(sequence_enrollment_id);
CREATE INDEX idx_seq_step_sends_step ON sequence_step_sends(sequence_step_id);
CREATE INDEX idx_seq_step_sends_recipient ON sequence_step_sends(campaign_recipient_id);
```

Per-step stats query for SEQN-04:
```typescript
// Stats for one step: join sequence_step_sends → campaign_recipients
const { data: stepStats } = await supabase
  .from('sequence_step_sends')
  .select('campaign_recipients(status, opened_at, clicked_at)')
  .eq('sequence_step_id', stepId)
// Aggregate: count total, count opened_at IS NOT NULL, count clicked_at IS NOT NULL
```

[ASSUMED] This query will perform well at typical drip sequence scales (hundreds to low thousands of enrollments per step). For very large sequences (10k+), a materialized view or counter columns on sequence_steps would be needed — deferred per scope.

### Pattern 5: Multiple TipTap Editors (Per-Step)

**What:** Each sequence step has its own TipTap editor instance. For the sequence builder, editors are dynamically created when steps are added. Unlike AbTestBuilderPage (fixed 2 editors), SequenceBuilderPage has a variable number of steps (1-N).

**Approach:** Store steps as an array of state objects, each with its own `useEditor` instance. Since React hooks cannot be called in loops, the `StepEditorPanel` component encapsulates each step's `useEditor` call. The builder renders `{steps.map((step, i) => <StepEditorPanel key={step.id} ... />)}`.

**Example:**
```typescript
// StepEditorPanel.tsx — encapsulates useEditor per step
export function StepEditorPanel({ step, onChange, onRemove, onMoveUp, onMoveDown, isFirst, isLast }) {
  const editor = useEditor({
    extensions: [StarterKit, Link.configure({ openOnClick: false }), Image,
      Placeholder.configure({ placeholder: 'Write your email content here...' }),
      VariableChipNode, VariableSlashCommand],
    content: step.bodyJson ?? step.bodyHtml ?? '',
    onUpdate: ({ editor }) => {
      onChange({ ...step, bodyHtml: editor.getHTML(), bodyJson: editor.getJSON() })
    },
  })
  // ...
}
```

**Key difference from AbTestBuilderPage:** Steps use `key={step.id}` not `key={index}`. Using index as key causes editor remounts on reorder (losing editor content). Using stable UUID keys preserves editor state during reorder.

[VERIFIED: codebase — AbTestBuilderPage uses CSS block/hidden to preserve 2 editors; for N editors the component-per-step pattern is the standard approach in React]
[ASSUMED] TipTap editor instances created inside a child component (StepEditorPanel) are destroyed when that component unmounts. When a step is removed, its editor is unmounted and content is discarded — this is expected behavior.

### Pattern 6: Start Sequence RPC / Edge Function

**What:** When the user clicks "Start Sequence", the app must:
1. Fetch all `active` contacts in `contact_list_id`
2. Insert `sequence_enrollments` rows (one per contact) with `next_send_at = now() + step_1.delay_days days`
3. Set `sequences.status = 'active'`

This can be done client-side via multiple Supabase queries OR via an Edge Function. Given the existing pattern (send-campaign is an Edge Function, A/B test variant sends are also Edge Functions), the start enrollment is a candidate for a Supabase Database Function (RPC) since it only needs data operations — no Resend API calls.

**Recommended approach:** Client-side bulk insert in `useSequences.startSequence()`. The hook:
1. Queries `contact_list_members` for active contact IDs (same pattern as `sendAbTestVariants`)
2. Bulk-inserts `sequence_enrollments` rows (Supabase `.insert([...rows])` handles arrays)
3. Updates `sequences.status = 'active'`

This avoids needing an additional Edge Function and matches the enrollment logic already established in `sendAbTestVariants` in `useCampaigns.ts`.

[VERIFIED: codebase — useCampaigns.ts sendAbTestVariants fetches contact_list_members + inserts in client-side hook, no Edge Function needed for enrollment]

### Anti-Patterns to Avoid

- **Storing step_number in campaign_recipients.variables JSONB:** The `variables` column stores the link map (key: link index, value: original URL). Overloading it with step metadata would require JSONB queries in stats aggregations and break the semantic meaning. Use `sequence_step_sends` bridge table instead.
- **Using React array index as TipTap editor key:** Causes editor remounts on step reorder, losing content and undo history. Always use stable IDs (UUID) as React keys for TipTap editor containers.
- **Hardcoding service_role_key in migration SQL:** The pg_cron job should authenticate with the anon key (or a scoped key from Vault), not the service_role_key. The Edge Function then uses its own service_role environment variable for DB operations — this is the established Supabase pattern.
- **Running pg_cron every minute for day-level delays:** Hourly is sufficient for day-granularity delays and reduces unnecessary function invocations.
- **Allowing enrollment before any steps exist:** Validate that at least one step with a subject and body exists before showing the "Start Sequence" button as enabled.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scheduled background jobs | Custom polling loop, setTimeout on frontend | pg_cron built into Supabase | Postgres-native, survives deploys, no extra infra |
| HTTP POST from Postgres | Custom webhook tables, manual triggers | pg_net (net.http_post) | Async, built-in to Supabase, timeout configurable |
| Per-contact email personalization | String concatenation per contact | Existing `personalizeText()` + `personalizeHtml()` helpers in send-campaign | Already handles {{first_name}}, {{last_name}}, {{company}}, {{email}} |
| Tracking pixel + link wrapping | Custom pixel endpoint | Existing `t` Edge Function (pixel/click/unsub routes) | Per-recipient tracking already wired; reuse tracking_id from campaign_recipients |
| Rich text editing per step | contenteditable div | TipTap (already installed) | Extensions, undo history, variable chip nodes already configured |
| Enrollment bulk insert | Row-by-row loop | Supabase `.insert([...rows])` array insert | Supabase PostgREST handles batch inserts natively |

**Key insight:** The tracking infrastructure (pixel, click redirect, unsubscribe) from Phase 3 is fully reusable for sequence step emails. The `send-sequence-step` function should generate `campaign_recipients` rows with `tracking_id` UUIDs the same way `send-campaign` does — the `t` Edge Function will handle open/click/unsub events for sequence emails automatically with zero changes.

---

## Common Pitfalls

### Pitfall 1: pg_cron Extension Must Be Enabled Before cron.schedule() Migration

**What goes wrong:** Running a migration that includes `SELECT cron.schedule(...)` before `pg_cron` is enabled in the Supabase Dashboard will throw "ERROR: function cron.schedule does not exist."

**Why it happens:** pg_cron is not enabled by default in Supabase. The migration can include `CREATE EXTENSION IF NOT EXISTS pg_cron;` as a safety net, but the extension must be enabled in the Dashboard before the migration runs in production (on Supabase Cloud, extensions are managed via Dashboard, not just SQL).

**How to avoid:** Split the migration: first create tables and indexes (can run anytime), then create the cron schedule as a separate step AFTER confirming pg_cron and pg_net are enabled. Or include `CREATE EXTENSION IF NOT EXISTS pg_cron; CREATE EXTENSION IF NOT EXISTS pg_net;` at the top of the migration with the understanding that they may already exist.

**Warning signs:** Migration fails with "function cron.schedule does not exist" or "could not open relation with OID".

[CITED: https://supabase.com/docs/guides/database/extensions/pg_cron — extension must be enabled first]

### Pitfall 2: Vault Secrets Must Be Created Manually (Cannot Be in Migration Files)

**What goes wrong:** A migration file includes `SELECT vault.create_secret(...)` to store the project URL and anon key. This works once during initial setup but will fail on re-runs (duplicate key name) or may not be appropriate to version-control credentials.

**Why it happens:** Vault secrets are credential storage, not DDL migrations. They're environment-specific and shouldn't be committed to source control.

**How to avoid:** Document the vault setup as a one-time manual step in the plan. The migration file should only include `cron.schedule()` (which references `vault.decrypted_secrets` at runtime). Planner should add a `user_setup` block noting: "Run in Supabase SQL Editor: `select vault.create_secret('https://pozqnzhgqmajtaidtpkk.supabase.co', 'project_url'); select vault.create_secret('YOUR_ANON_KEY', 'anon_key');`"

**Warning signs:** Migration runs fine, but cron job silently does nothing because vault secrets are missing.

[CITED: https://supabase.com/docs/guides/functions/schedule-functions — vault setup documented separately from migration]

### Pitfall 3: sequence_enrollments UNIQUE Constraint Prevents Re-enrollment

**What goes wrong:** CONTEXT.md D-02 specifies `UNIQUE(sequence_id, contact_id)`. If a user starts a sequence, archives it, creates a new sequence and adds the same contacts, a separate enrollment works fine. But if a user tries to "restart" a completed sequence by calling startSequence again, the bulk insert will fail with unique violation.

**Why it happens:** The UNIQUE constraint is correct business logic (one active enrollment per contact per sequence), but the startSequence function must handle the case where some enrollments already exist.

**How to avoid:** Use `ON CONFLICT (sequence_id, contact_id) DO NOTHING` in the bulk insert. This means re-starting a sequence (if feature is ever added) skips contacts who already have an enrollment. For Phase 6 (no restart feature), this is a safe defensive measure.

**Warning signs:** "duplicate key value violates unique constraint sequence_enrollments_sequence_id_contact_id_key" error in Supabase logs.

[VERIFIED: codebase — CONTEXT.md D-02 explicitly specifies UNIQUE(sequence_id, contact_id)]

### Pitfall 4: TipTap Key Prop on Step Components

**What goes wrong:** Using array index (`key={i}`) as React key for `StepEditorPanel` components causes TipTap editors to remount when steps are reordered (because React reconciles by position). After a reorder, the editor at position 2 gets position 1's previous content momentarily, then re-initializes.

**Why it happens:** React uses keys to track component identity. When index-keyed components move positions, React destroys and recreates them. TipTap editors lose their content and undo history on remount.

**How to avoid:** Each step state object in the builder should have a stable `id: crypto.randomUUID()` generated at creation time (not the DB id, which doesn't exist yet for new steps). Use `key={step.id}` on `StepEditorPanel`.

**Warning signs:** After using up/down reorder buttons, step body content appears to swap between steps or editor shows empty content briefly.

[VERIFIED: codebase — AbTestBuilderPage uses CSS block/hidden for same reason (preserve editor state); React docs confirm key stability requirement for editor-containing components]

### Pitfall 5: delay_days Validation — Strictly Increasing Requirement

**What goes wrong:** User sets Step 1 to day 3, Step 2 to day 1. The `next_send_at` computation in `send-sequence-step` would produce a past timestamp for Step 2, causing it to send immediately on the next cron run — potentially sending steps out of order.

**Why it happens:** The delay model computes all `next_send_at` values relative to `enrolled_at` (D-03). If step delays are not strictly increasing, steps sent "later" (higher step_number) could have earlier send times.

**How to avoid:** Validate in the builder UI before Save/Start: "Step delays must be strictly increasing (each step's day must be greater than the previous step's day)." The planner should include this validation in `SequenceBuilderPage` before both save and start actions. The UI-SPEC already specifies this error message.

**Warning signs:** Sequence enrollments receiving step 3 before step 2.

[VERIFIED: codebase — CONTEXT.md D-03 explicitly states "delay_days must be strictly increasing"]

### Pitfall 6: Send-Sequence-Step Must Be Idempotent

**What goes wrong:** The pg_cron invocation calls the Edge Function. If the function partially succeeds (sends some emails, then fails), the next cron run may attempt to re-send the same step to already-processed enrollments.

**Why it happens:** Edge Functions can time out or throw errors mid-batch.

**How to avoid:** In `send-sequence-step`, after sending a step for an enrollment, immediately update `current_step` and `next_send_at` before moving to the next enrollment. This way, if the function fails mid-batch, already-advanced enrollments won't be re-processed. Also, use a SELECT FOR UPDATE (or optimistic lock via a `processing_at` timestamp) to prevent double-processing if the function is somehow called concurrently — though hourly cron makes this unlikely.

**Warning signs:** Contacts receive the same sequence step email twice.

[ASSUMED] Using a `processing_at` TIMESTAMPTZ column on `sequence_enrollments` to mark in-flight rows would prevent double-sends in concurrent invocations. However, for hourly cron with typical sequence sizes, sequential processing within a single invocation is sufficient and simpler. Flag as LOW risk for Phase 6.

---

## Code Examples

Verified patterns from codebase and official sources:

### Database Migration Structure (008_sequences.sql)

```sql
-- Source: established pattern from 007_ab_test_columns.sql + CONTEXT.md D-02

-- Enable required extensions (safe to run even if already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ────────────────────────────────────────────────────
-- sequences table
-- ────────────────────────────────────────────────────
CREATE TABLE public.sequences (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID NOT NULL,
  name             TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  contact_list_id  UUID REFERENCES public.contact_lists(id),
  from_name        TEXT NOT NULL DEFAULT '',
  from_email       TEXT NOT NULL DEFAULT '',
  reply_to_email   TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sequences_workspace ON public.sequences(workspace_id);

ALTER TABLE public.sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their sequences"
  ON public.sequences FOR ALL
  USING (workspace_id = (SELECT workspace_id FROM profiles WHERE id = auth.uid()));

-- ────────────────────────────────────────────────────
-- sequence_steps table
-- ────────────────────────────────────────────────────
CREATE TABLE public.sequence_steps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id   UUID NOT NULL REFERENCES public.sequences(id) ON DELETE CASCADE,
  step_number   INT NOT NULL,
  delay_days    INT NOT NULL DEFAULT 0,
  subject       TEXT NOT NULL DEFAULT '',
  body_html     TEXT NOT NULL DEFAULT '',
  body_json     JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(sequence_id, step_number)
);

CREATE INDEX idx_sequence_steps_sequence ON public.sequence_steps(sequence_id);

ALTER TABLE public.sequence_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their sequence steps"
  ON public.sequence_steps FOR ALL
  USING (EXISTS (
    SELECT 1 FROM sequences
    WHERE sequences.id = sequence_steps.sequence_id
    AND sequences.workspace_id = (SELECT workspace_id FROM profiles WHERE id = auth.uid())
  ));

-- ────────────────────────────────────────────────────
-- sequence_enrollments table
-- ────────────────────────────────────────────────────
CREATE TABLE public.sequence_enrollments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id     UUID NOT NULL REFERENCES public.sequences(id) ON DELETE CASCADE,
  contact_id      UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  workspace_id    UUID NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'completed', 'unsubscribed', 'bounced')),
  current_step    INT NOT NULL DEFAULT 1,
  enrolled_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_send_at    TIMESTAMPTZ NOT NULL,
  completed_at    TIMESTAMPTZ,
  UNIQUE(sequence_id, contact_id)
);

CREATE INDEX idx_seq_enrollments_sequence ON public.sequence_enrollments(sequence_id);
CREATE INDEX idx_seq_enrollments_due ON public.sequence_enrollments(next_send_at)
  WHERE status = 'active';

ALTER TABLE public.sequence_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their sequence enrollments"
  ON public.sequence_enrollments FOR ALL
  USING (workspace_id = (SELECT workspace_id FROM profiles WHERE id = auth.uid()));

-- ────────────────────────────────────────────────────
-- sequence_step_sends table (bridge for per-step stats)
-- ────────────────────────────────────────────────────
CREATE TABLE public.sequence_step_sends (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_enrollment_id UUID NOT NULL REFERENCES public.sequence_enrollments(id) ON DELETE CASCADE,
  sequence_step_id       UUID NOT NULL REFERENCES public.sequence_steps(id) ON DELETE CASCADE,
  campaign_recipient_id  UUID NOT NULL REFERENCES public.campaign_recipients(id) ON DELETE CASCADE,
  step_number            INT NOT NULL,
  workspace_id           UUID NOT NULL,
  sent_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_seq_step_sends_enrollment ON public.sequence_step_sends(sequence_enrollment_id);
CREATE INDEX idx_seq_step_sends_step ON public.sequence_step_sends(sequence_step_id);
CREATE INDEX idx_seq_step_sends_recipient ON public.sequence_step_sends(campaign_recipient_id);

ALTER TABLE public.sequence_step_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their sequence step sends"
  ON public.sequence_step_sends FOR SELECT
  USING (workspace_id = (SELECT workspace_id FROM profiles WHERE id = auth.uid()));

-- ────────────────────────────────────────────────────
-- pg_cron schedule (requires pg_cron + pg_net enabled,
-- AND Vault secrets 'project_url' and 'anon_key' pre-created)
-- ────────────────────────────────────────────────────
SELECT cron.schedule(
  'send-sequence-steps-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
           || '/functions/v1/send-sequence-step',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key')
    ),
    body := jsonb_build_object('triggered_at', now()),
    timeout_milliseconds := 30000
  ) AS request_id;
  $$
);
```

### TypeScript Type Additions (src/types/database.ts)

```typescript
// Source: established pattern from existing Campaign/CampaignRecipient interfaces

export type SequenceStatus = 'draft' | 'active' | 'paused' | 'archived'
export type SequenceEnrollmentStatus = 'active' | 'completed' | 'unsubscribed' | 'bounced'

export interface Sequence {
  id: string
  workspace_id: string
  name: string
  status: SequenceStatus
  contact_list_id: string | null
  from_name: string
  from_email: string
  reply_to_email: string | null
  created_at: string
  updated_at: string
}

export interface SequenceStep {
  id: string
  sequence_id: string
  step_number: number
  delay_days: number
  subject: string
  body_html: string
  body_json: Record<string, unknown> | null
  created_at: string
}

export interface SequenceEnrollment {
  id: string
  sequence_id: string
  contact_id: string
  workspace_id: string
  status: SequenceEnrollmentStatus
  current_step: number
  enrolled_at: string
  next_send_at: string
  completed_at: string | null
}

export interface SequenceStepSend {
  id: string
  sequence_enrollment_id: string
  sequence_step_id: string
  campaign_recipient_id: string
  step_number: number
  workspace_id: string
  sent_at: string
}

export type SequenceInsert = Omit<Sequence, 'id' | 'created_at' | 'updated_at'>
export type SequenceUpdate = Partial<Omit<Sequence, 'id' | 'workspace_id' | 'created_at' | 'updated_at'>>

export type SequenceStepInsert = Omit<SequenceStep, 'id' | 'created_at'>
export type SequenceStepUpdate = Partial<Omit<SequenceStep, 'id' | 'sequence_id' | 'created_at'>>
```

### useSequences Hook Pattern

```typescript
// Source: established pattern from src/hooks/campaigns/useCampaigns.ts
// Location: src/hooks/sequences/useSequences.ts

export function useSequences() {
  const { profile } = useAuth()
  const [sequences, setSequences] = useState<Sequence[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSequences = useCallback(async () => {
    if (!profile?.workspace_id) return
    setLoading(true)
    const { data, error: fetchError } = await supabase
      .from('sequences')
      .select('*')
      .eq('workspace_id', profile.workspace_id)
      .order('created_at', { ascending: false })
    if (fetchError) setError(fetchError.message)
    else setSequences((data as Sequence[]) ?? [])
    setLoading(false)
  }, [profile?.workspace_id])

  useEffect(() => { fetchSequences() }, [fetchSequences])

  const createSequence = async (seq: Omit<SequenceInsert, 'workspace_id'>) => { ... }
  const updateSequence = async (id: string, updates: SequenceUpdate) => { ... }
  const deleteSequence = async (id: string) => { ... }
  const archiveSequence = async (id: string) => { ... }

  // startSequence: fetch active contacts, bulk insert enrollments, set status = 'active'
  const startSequence = async (sequenceId: string, firstStep: SequenceStep) => {
    if (!profile?.workspace_id) return { error: 'Not authenticated', count: 0 }
    // 1. Get sequence.contact_list_id
    // 2. Fetch active members from contact_list_members (same as sendAbTestVariants)
    // 3. Bulk insert sequence_enrollments rows with next_send_at = now() + firstStep.delay_days
    // 4. ON CONFLICT DO NOTHING (handles edge case of duplicate enrollment attempt)
    // 5. Update sequence.status = 'active'
  }

  return { sequences, loading, error, refetch: fetchSequences,
    createSequence, updateSequence, deleteSequence, archiveSequence, startSequence }
}
```

### useSequence Hook (single sequence with steps)

```typescript
// Source: established pattern from src/hooks/campaigns/useCampaign.ts
// Location: src/hooks/sequences/useSequence.ts

export function useSequence(id: string | undefined) {
  const { profile } = useAuth()
  const [sequence, setSequence] = useState<Sequence | null>(null)
  const [steps, setSteps] = useState<SequenceStep[]>([])
  const [enrollmentCount, setEnrollmentCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    if (!id || !profile?.workspace_id) { setLoading(false); return }
    setLoading(true)

    // Parallel fetch: sequence + steps + enrollment count
    const [seqResult, stepsResult, countResult] = await Promise.all([
      supabase.from('sequences').select('*').eq('id', id).single(),
      supabase.from('sequence_steps').select('*').eq('sequence_id', id).order('step_number', { ascending: true }),
      supabase.from('sequence_enrollments').select('id', { count: 'exact', head: true }).eq('sequence_id', id),
    ])

    if (seqResult.data) setSequence(seqResult.data as Sequence)
    if (stepsResult.data) setSteps((stepsResult.data as SequenceStep[]))
    if (countResult.count !== null) setEnrollmentCount(countResult.count)
    setLoading(false)
  }, [id, profile?.workspace_id])

  useEffect(() => { fetchAll() }, [fetchAll])

  return { sequence, steps, enrollmentCount, loading, refetch: fetchAll }
}
```

### StepEditorPanel Component Skeleton

```typescript
// Source: established pattern from AbTestBuilderPage TipTap usage + CampaignBuilderPage
// Location: src/components/sequences/StepEditorPanel.tsx

interface StepEditorPanelProps {
  step: SequenceStepDraft  // includes stable id, delay_days, subject, bodyHtml, bodyJson
  stepNumber: number
  isFirst: boolean
  isLast: boolean
  error?: { delay?: string; subject?: string; body?: string }
  onChange: (updated: SequenceStepDraft) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

export function StepEditorPanel({
  step, stepNumber, isFirst, isLast, error, onChange, onRemove, onMoveUp, onMoveDown
}: StepEditorPanelProps) {
  const [populated, setPopulated] = useState(false)
  const editor = useEditor({
    extensions: [StarterKit, Link.configure({ openOnClick: false }), Image,
      Placeholder.configure({ placeholder: 'Write your email content here...' }),
      VariableChipNode, VariableSlashCommand],
    content: '',
    onUpdate: ({ editor }) => {
      if (populated) onChange({ ...step, bodyHtml: editor.getHTML(), bodyJson: editor.getJSON() })
    },
  })

  useEffect(() => {
    if (editor && !populated) {
      if (step.bodyJson) editor.commands.setContent(step.bodyJson)
      else if (step.bodyHtml) editor.commands.setContent(step.bodyHtml)
      setPopulated(true)
    }
  }, [editor, populated, step.bodyJson, step.bodyHtml])

  // ... render delay input, subject input with {{ }} button, TipTap editor, up/down/remove buttons
}
```

### send-sequence-step Edge Function Skeleton

```typescript
// Location: supabase/functions/send-sequence-step/index.ts
// Source: established pattern from send-campaign/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const TRACKING_BASE = `${SUPABASE_URL}/functions/v1/t`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // No JWT auth — called by pg_cron via anon key Bearer token
  // Function is protected by verify_jwt: false + Supabase gateway validates the anon token at function level
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // Fetch due enrollments
  const { data: dueEnrollments } = await adminClient
    .from('sequence_enrollments')
    .select(`
      id, sequence_id, contact_id, workspace_id, current_step, enrolled_at, next_send_at,
      sequences!inner(id, status, from_name, from_email, reply_to_email),
      contacts!inner(id, email, first_name, last_name, company, status)
    `)
    .eq('status', 'active')
    .lte('next_send_at', new Date().toISOString())
    .limit(100)

  let processed = 0
  for (const enrollment of (dueEnrollments ?? [])) {
    // Skip if sequence paused
    if (enrollment.sequences.status !== 'active') continue
    // Skip if contact unsubscribed/bounced
    if (enrollment.contacts.status !== 'active') {
      await adminClient.from('sequence_enrollments').update({
        status: enrollment.contacts.status === 'unsubscribed' ? 'unsubscribed' : 'bounced'
      }).eq('id', enrollment.id)
      continue
    }

    // Load the step
    const { data: step } = await adminClient
      .from('sequence_steps')
      .select('*')
      .eq('sequence_id', enrollment.sequence_id)
      .eq('step_number', enrollment.current_step)
      .single()

    if (!step) continue  // step deleted after enrollment started

    // Send email via Resend (single send, not batch)
    const trackingId = crypto.randomUUID()
    const contact = enrollment.contacts
    const seq = enrollment.sequences
    // ... personalizeText, wrapLinks, addUnsubscribeFooter, injectPixel (same helpers as send-campaign)
    // ... fetch to https://api.resend.com/emails (single, not batch)

    // Insert campaign_recipients row
    const { data: recipientRow } = await adminClient.from('campaign_recipients').insert({
      campaign_id: enrollment.sequence_id,  // NOTE: sequence_id used as campaign_id for tracking
      contact_id: contact.id,
      workspace_id: enrollment.workspace_id,
      tracking_id: trackingId,
      status: 'sent',
      variables: linkMap,
      sent_at: new Date().toISOString(),
    }).select().single()

    // Insert sequence_step_sends bridge row
    if (recipientRow) {
      await adminClient.from('sequence_step_sends').insert({
        sequence_enrollment_id: enrollment.id,
        sequence_step_id: step.id,
        campaign_recipient_id: recipientRow.id,
        step_number: enrollment.current_step,
        workspace_id: enrollment.workspace_id,
      })
    }

    // Advance enrollment: increment current_step, compute next next_send_at
    const { data: nextStep } = await adminClient
      .from('sequence_steps')
      .select('delay_days')
      .eq('sequence_id', enrollment.sequence_id)
      .eq('step_number', enrollment.current_step + 1)
      .single()

    if (nextStep) {
      const nextSendAt = new Date(new Date(enrollment.enrolled_at).getTime() + nextStep.delay_days * 86400000)
      await adminClient.from('sequence_enrollments').update({
        current_step: enrollment.current_step + 1,
        next_send_at: nextSendAt.toISOString(),
      }).eq('id', enrollment.id)
    } else {
      // No next step — sequence complete for this contact
      await adminClient.from('sequence_enrollments').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      }).eq('id', enrollment.id)
    }

    processed++
  }

  return new Response(JSON.stringify({ ok: true, processed }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
```

**IMPORTANT NOTE on campaign_id usage (RESOLVED):** The `campaign_recipients` table originally had a NOT NULL FK on `campaign_id` to `campaigns(id)`. This has been resolved in migration 008_sequences.sql which includes: `ALTER TABLE public.campaign_recipients ALTER COLUMN campaign_id DROP NOT NULL;` and `ALTER TABLE public.campaign_recipients ADD COLUMN sequence_id UUID REFERENCES public.sequences(id);`. For sequence step sends, insert with `campaign_id: null` and `sequence_id: enrollment.sequence_id`. The existing tracking function (`t`) looks up by `tracking_id` only, so tracking works regardless.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `import { serve }` from std/http | `Deno.serve()` | Deno/Supabase 2023 | Existing code already uses Deno.serve — maintain pattern |
| Direct service_role_key in cron SQL | Vault secrets for credentials | 2024 | More secure; credentials not in migration file |
| pg_cron alone | pg_cron + pg_net | 2022+ | pg_net enables async HTTP from Postgres |

**Deprecated/outdated:**
- `import { serve } from 'https://deno.land/std/http/server.ts'`: Replaced by `Deno.serve()`. This project already uses `Deno.serve()` — do not use the old import pattern.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `sequence_step_sends` bridge table is preferable to JSONB metadata in `campaign_recipients` | Architecture Patterns Pattern 4 | Low — both approaches work; JSONB approach is slightly simpler but harder to query for SEQN-04 |
| A2 | limit(100) per cron invocation is sufficient for typical sequence scales | Pattern 3 Core Logic | Medium — if workspace has 1000+ active enrollments per hour, processing will lag by hours. Could increase limit or add pagination in future |
| A3 | Client-side bulk insert for startSequence (no Edge Function needed) | Pattern 6 | Low — works for contact list sizes up to a few thousand; Supabase PostgREST handles array inserts efficiently |
| A4 | `processing_at` idempotency lock is LOW risk for hourly cron | Pitfall 6 | Low — concurrent cron invocations are not expected given hourly schedule and typical sequence sizes |
| A5 | `campaign_id` FK constraint on `campaign_recipients` prevents direct use of `sequence_id` | Code Examples (send-sequence-step) | RESOLVED — migration 008 makes campaign_id nullable and adds sequence_id FK column. Sequence sends use campaign_id: null, sequence_id: enrollment.sequence_id. |

---

## Open Questions (RESOLVED)

1. **campaign_recipients.campaign_id FK constraint for sequence step tracking**
   - What we know: `campaign_recipients` has `campaign_id UUID NOT NULL REFERENCES campaigns(id)`. The `sequences` table is separate from `campaigns`.
   - What's unclear: How should sequence step sends populate this column? Three options: (a) Make `campaign_id` nullable in a new migration; (b) Add `sequence_id` FK column to campaign_recipients (nullable); (c) Don't use `campaign_recipients` for sequence tracking — use only `sequence_step_sends` and a lightweight separate table, giving up the open/click tracking from the `t` function.
   - Recommendation: Combined option (a) + (b).
   - **RESOLVED:** Migration 008_sequences.sql includes both: `ALTER TABLE public.campaign_recipients ALTER COLUMN campaign_id DROP NOT NULL;` AND `ALTER TABLE public.campaign_recipients ADD COLUMN sequence_id UUID REFERENCES public.sequences(id);`. For sequence step sends, the Edge Function inserts with `campaign_id: null` and `sequence_id: enrollment.sequence_id`. The `t` tracking function looks up by `tracking_id` only, so existing open/click/unsub tracking continues to work.

2. **pg_cron + Vault: Can migration include cron.schedule if Vault secrets don't exist yet?**
   - What we know: `cron.schedule` SQL references `vault.decrypted_secrets` at runtime (not at schedule creation time). The schedule is created successfully even if the vault secret doesn't exist yet — it will fail at runtime.
   - What's unclear: Whether this is acceptable (fail silently) or if there's a better pattern.
   - Recommendation: Include `cron.schedule()` in the migration. Document that Vault secrets must be created before the first cron job runs. Add a `user_setup` block in the plan with the exact vault commands.
   - **RESOLVED:** Plan 03 Task 2 (checkpoint:human-action) separates cron.schedule creation from the migration. The migration only creates tables and extensions. The cron schedule is created manually via SQL Editor after Edge Function deployment and Vault secret configuration. This avoids any ordering issues.

3. **Internal secret for send-sequence-step (using anon key as bearer)**
   - What we know: The official Supabase pattern uses the anon key in the Authorization header for pg_cron -> Edge Function calls. With `verify_jwt: false`, the function doesn't validate the JWT — anyone with the anon key (which is public) could call it.
   - What's unclear: Whether additional security (internal secret header) is needed for a function that only performs internal DB operations and doesn't expose data.
   - **RESOLVED:** Plan 03 implements a dedicated SEQUENCE_CRON_SECRET for internal auth. The Edge Function checks `x-internal-secret` header (for pg_cron via pg_net) OR `Authorization: Bearer` token (for manual curl testing) against the secret. This is more secure than the anon-key-only approach. The secret is stored in Supabase Vault (encrypted at rest) and Supabase secrets (env var). Documented in threat model as T-6-08 and T-6-12.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| pg_cron | SEQN-03 cron scheduling | Check Supabase Dashboard — likely available | 1.6.4 (Supabase managed) | Enable via Dashboard |
| pg_net | SEQN-03 HTTP POST from cron | Check Supabase Dashboard | Supabase managed | Enable via Dashboard |
| Supabase Vault | pg_cron auth pattern | Available on all Supabase projects | Supabase managed | Skip vault, hardcode anon key in migration (less secure but functional for MVP) |
| Resend API | SEQN-03 email sending | Pre-existing (RESEND_API_KEY secret configured) | — | No fallback — required |
| Node.js 24.12.0 | Build + dev | Available (CLAUDE.md stack) | 24.12.0 | — |

[VERIFIED: MEMORY.md — RESEND_API_KEY secret already configured in Supabase project pozqnzhgqmajtaidtpkk]
[ASSUMED] pg_cron and pg_net must be confirmed as enabled in the Supabase Dashboard before migration runs. The `CREATE EXTENSION IF NOT EXISTS` in the migration provides a safety net for environments where they can be enabled via SQL.

**Missing dependencies with no fallback:**
- None — Resend API key is already configured

**Missing dependencies with fallback:**
- pg_cron (if not enabled): Enable via Supabase Dashboard → Database → Extensions
- pg_net (if not enabled): Enable via Supabase Dashboard → Database → Extensions

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — project uses `npm run build` (TypeScript compile) as primary verification |
| Config file | none (no jest.config, vitest.config, or test directory found) |
| Quick run command | `npm run build` |
| Full suite command | `npm run build && npm run lint` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEQN-01 | Sequence builder creates sequence with N steps in DB | manual smoke | `npm run build` | N/A (no test files) |
| SEQN-02 | Start sequence enrolls all active contacts from list | manual smoke | `npm run build` | N/A |
| SEQN-03 | pg_cron invokes send-sequence-step which sends emails | manual smoke (check Supabase logs) | `npm run build` | N/A |
| SEQN-04 | Results page shows enrollment count + per-step stats | manual smoke | `npm run build` | N/A |

### Sampling Rate
- **Per task commit:** `npm run build` (TypeScript zero-error compile)
- **Per wave merge:** `npm run build && npm run lint`
- **Phase gate:** Full suite + manual smoke test of sequence create → start → wait/simulate → results

### Wave 0 Gaps
None — project has no test infrastructure; all validation is build + manual smoke testing.

*(No test infrastructure exists in this project — `npm run build` TypeScript compilation is the automated gate)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | JWT via Supabase Auth; pg_cron function uses anon key Bearer + verify_jwt: false |
| V3 Session Management | no | Sessions not modified |
| V4 Access Control | yes | RLS on all 4 new tables; workspace_id scoping on all queries |
| V5 Input Validation | yes | delay_days strictly increasing validation; subject/body non-empty validation before start |
| V6 Cryptography | no | No custom crypto — tracking UUIDs use crypto.randomUUID() (Web Crypto API) |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Workspace isolation bypass | Elevation of Privilege | RLS on all sequence tables with workspace_id check; send-sequence-step uses adminClient but workspace_id is stored on enrollment rows |
| Unauthorized sequence start (enroll contacts without permission) | Spoofing | useSequences.startSequence checks profile.workspace_id; sequences table RLS validates ownership |
| CSRF on start/pause/archive mutations | Tampering | Supabase JWT in Authorization header on all mutations; not form-based |
| Open redirect in sequence step link wrapping | Tampering | Same mitigation as send-campaign: redirect URL comes from campaign_links table, not request params |
| Mass email via sequence (spam vector) | DoS | Resend API rate limits apply; sequences limited to workspace's contact lists; RLS prevents cross-workspace enrollments |
| Sequence step double-send | Tampering | Advance current_step atomically before processing next enrollment; UNIQUE constraint on sequence_step_sends could be added |

---

## Sources

### Primary (HIGH confidence)
- Codebase (`supabase/functions/send-campaign/index.ts`) — Resend batch send pattern, tracking injection helpers (personalizeText, wrapLinks, injectPixel, addUnsubscribeFooter)
- Codebase (`supabase/functions/t/index.ts`) — verify_jwt: false pattern with service role client
- Codebase (`src/hooks/campaigns/useCampaigns.ts`) — sendAbTestVariants (contact fetch + bulk operation pattern for startSequence)
- Codebase (`supabase/config.toml`) — verify_jwt: false configuration pattern for t and resend-webhook
- Codebase (`src/types/database.ts`) — existing TypeScript type conventions
- Codebase (`supabase/migrations/007_ab_test_columns.sql`) — migration naming convention, RLS pattern

### Secondary (MEDIUM confidence)
- [Scheduling Edge Functions | Supabase Docs](https://supabase.com/docs/guides/functions/schedule-functions) — pg_cron + pg_net + Vault pattern for invoking Edge Functions
- [pg_net: Async Networking | Supabase Docs](https://supabase.com/docs/guides/database/extensions/pg_net) — net.http_post signature and parameters
- [Cron | Supabase Docs](https://supabase.com/docs/guides/cron) — cron.schedule syntax, sub-minute scheduling
- [pg_cron Extension | Supabase Docs](https://supabase.com/docs/guides/database/extensions/pg_cron) — extension enablement

### Tertiary (LOW confidence)
- GitHub issue #4287 (supabase/cli) — pg_cron authentication gap; confirms no official recommended pattern for service_role vs anon key in cron invocations

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all major dependencies verified in codebase; pg_cron/pg_net documented in official Supabase docs
- Architecture: HIGH — patterns derived from existing verified codebase (send-campaign, t, AbTestBuilderPage)
- Pitfalls: MEDIUM — Pitfalls 1-5 are verified; Pitfall 6 (idempotency) is assumed based on general distributed systems knowledge
- Per-step stats approach (bridge table): MEDIUM — logical analysis confirms correctness; not tested against actual query performance

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (stable Supabase APIs; pg_cron/pg_net APIs are stable)
