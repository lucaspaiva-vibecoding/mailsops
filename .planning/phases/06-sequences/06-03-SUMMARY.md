---
phase: 06-sequences
plan: 03
subsystem: infra
tags: [edge-functions, supabase, resend, pg_cron, sequences, email-delivery, tracking]

# Dependency graph
requires:
  - phase: 06-sequences-01
    provides: "sequences DB schema (4 tables), campaign_recipients with nullable campaign_id + sequence_id FK, sequence_step_sends bridge table, config.toml send-sequence-step entry"
provides:
  - "send-sequence-step Edge Function with full implementation (318 lines)"
  - "Internal secret auth via SEQUENCE_CRON_SECRET"
  - "Full tracking integration (campaign_recipients + sequence_step_sends per send)"
  - "Idempotent enrollment advancement with D-03 delay model"
  - "Contact/sequence status guard (D-08 unsubscribe/bounce stop)"
affects:
  - 06-sequences-04
  - 06-sequences-05

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "x-internal-secret header auth pattern for cron-invoked Edge Functions (verify_jwt=false compensated by shared secret)"
    - "campaign_id=null + sequence_id set on campaign_recipients for sequence sends"
    - "Enrolled-at-relative delay computation: next_send_at = enrolled_at + delay_days days"
    - "Sequential processing with immediate idempotent advancement after each send"

key-files:
  created:
    - supabase/functions/send-sequence-step/index.ts
  modified: []

key-decisions:
  - "Dual auth: x-internal-secret header (pg_cron path) OR Authorization Bearer (manual testing path) — both validated against SEQUENCE_CRON_SECRET"
  - "Sequential enrollment processing (not parallel) for idempotency — each enrollment advanced immediately after successful send"
  - "Contact status check at send time updates enrollment status to 'bounced' or 'unsubscribed' matching contact.status"
  - "MAX_PER_INVOCATION=100 cap prevents function timeout; hourly cron drains backlog over multiple runs"

patterns-established:
  - "send-sequence-step pattern: query due enrollments, check contact/sequence status, send via Resend single-email API, insert campaign_recipients (campaign_id=null), insert sequence_step_sends bridge, advance enrollment"

requirements-completed:
  - SEQN-03

# Metrics
duration: 4min
completed: 2026-04-14
---

# Phase 6 Plan 3: send-sequence-step Edge Function Summary

**Deno Edge Function for automatic sequence step delivery via Resend with full tracking (campaign_recipients + sequence_step_sends bridge), internal secret auth, and idempotent enrollment advancement.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-14T13:53:57Z
- **Completed:** 2026-04-14T13:57:00Z
- **Tasks:** 1 of 2 executed (Task 2 is a blocking human-action checkpoint)
- **Files modified:** 1

## Accomplishments

- Created `supabase/functions/send-sequence-step/index.ts` (318 lines) with complete implementation
- Internal secret auth via `x-internal-secret` header or `Authorization: Bearer` token — both validated against `SEQUENCE_CRON_SECRET` env var
- Full tracking integration: inserts `campaign_recipients` row with `campaign_id: null` and `sequence_id` set before each send; updates with `resend_message_id` after send
- Inserts `sequence_step_sends` bridge row per send for SEQN-04 per-step stats queries
- Contact status guard (D-08): checks `contact.status === 'active'` before each send; updates enrollment status to `'bounced'` or `'unsubscribed'` if contact is inactive
- Sequence status guard: skips enrollments whose sequence is paused/archived
- Idempotent enrollment advancement: `current_step` incremented and `next_send_at` recomputed immediately after each successful send (relative to `enrolled_at` per D-03)
- Completion logic: sets enrollment `status: 'completed'` when no next step exists

## Task Commits

Each task was committed atomically:

1. **Task 1: Create send-sequence-step Edge Function** - `1545026` (feat)
2. **Task 2: Deploy + configure secrets + pg_cron** - PENDING HUMAN ACTION (see checkpoint below)

## Files Created/Modified

- `supabase/functions/send-sequence-step/index.ts` - Full Edge Function implementation: internal secret auth, due enrollment query, per-enrollment personalization/tracking/send/bridge insert/advancement loop, 200ms rate limiting between sends, summary response

## Decisions Made

- Dual auth strategy: `x-internal-secret` header for pg_cron invocations; `Authorization: Bearer` accepted as fallback for manual `curl` testing — both paths validate against `SEQUENCE_CRON_SECRET`
- Sequential processing chosen over parallel for idempotency (Research Pitfall 6): each enrollment is advanced immediately after its send succeeds, so a crash mid-batch leaves already-processed enrollments with their next_send_at in the future and won't re-send
- Delay model follows D-03: `next_send_at = enrolled_at + nextStep.delay_days * 86400s` — relative to enrollment date, not previous send time
- 200ms inter-send delay (lower than send-campaign's 300ms inter-batch delay) since these are single emails, not 50-email batches

## Deviations from Plan

None — plan executed exactly as written.

## Checkpoint: PENDING HUMAN ACTION

Task 2 requires manual deployment steps that cannot be automated without `SUPABASE_ACCESS_TOKEN`. The Edge Function file is ready locally at `supabase/functions/send-sequence-step/index.ts`. Complete the following steps to activate automatic sequence step sending:

---

### Step 1: Deploy the Edge Function

```bash
# Option A: If supabase CLI is linked
npx supabase functions deploy send-sequence-step

# Option B: Via Supabase Dashboard
# Dashboard -> Edge Functions -> Deploy new function -> paste index.ts content
```

### Step 2: Set the SEQUENCE_CRON_SECRET

```bash
# Generate a secret
openssl rand -hex 32

# Set it as a Supabase secret
npx supabase secrets set SEQUENCE_CRON_SECRET=<generated_value>
```

### Step 3: Create Vault secrets for pg_cron (in Supabase SQL Editor)

```sql
-- Replace YOUR_ANON_KEY with the actual anon key from Supabase Dashboard -> Settings -> API
SELECT vault.create_secret('https://pozqnzhgqmajtaidtpkk.supabase.co', 'project_url');
SELECT vault.create_secret('YOUR_ANON_KEY_HERE', 'anon_key');
```

### Step 4: Add SEQUENCE_CRON_SECRET to Vault (so pg_cron can pass it as a header)

```sql
SELECT vault.create_secret('THE_SAME_SECRET_VALUE', 'sequence_cron_secret');
```

### Step 5: Create the pg_cron schedule (in Supabase SQL Editor)

```sql
SELECT cron.schedule(
  'send-sequence-steps-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
           || '/functions/v1/send-sequence-step',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key'),
      'x-internal-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'sequence_cron_secret')
    ),
    body := jsonb_build_object('triggered_at', now()),
    timeout_milliseconds := 30000
  ) AS request_id;
  $$
);
```

### Step 6: Verify cron is registered

```sql
SELECT * FROM cron.job;
-- Should show 'send-sequence-steps-hourly' with schedule '0 * * * *'
```

### Resume Signal

Type "deployed" when the Edge Function is deployed and the cron schedule is created, or describe any issues.

---

## Threat Surface Scan

The `send-sequence-step` Edge Function introduces a new network endpoint (`/functions/v1/send-sequence-step`) with `verify_jwt: false`. This surface was anticipated in the plan's threat model:

| Flag | File | Description |
|------|------|-------------|
| threat_flag: unauthenticated-endpoint | supabase/functions/send-sequence-step/index.ts | verify_jwt=false endpoint compensated by SEQUENCE_CRON_SECRET shared secret; T-6-08 mitigated |
| threat_flag: service-role-usage | supabase/functions/send-sequence-step/index.ts | service_role used for cross-enrollment queries; T-6-09 mitigated by secret header preventing unauthorized invocation |

Both flags correspond to T-6-08 and T-6-09 in the plan's threat register, both with `mitigate` disposition and implemented mitigations.

## Self-Check: CHECKPOINT

Task 1 is complete and verified:
- `supabase/functions/send-sequence-step/index.ts`: FOUND (318 lines)
- commit `1545026`: FOUND
- All 18 acceptance criteria: PASSED

Task 2 is a blocking human-action checkpoint. Deployment instructions are recorded above. Plan is paused awaiting human action.

---
*Phase: 06-sequences*
*Completed: 2026-04-14 (Task 1 only — Task 2 pending human action)*
