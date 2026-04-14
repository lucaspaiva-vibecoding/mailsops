# Phase 6: Sequences — Discussion Log

**Date:** 2026-04-14
**Phase:** 06-sequences
**Mode:** discuss

---

## Gray Areas Identified

1. Scheduling mechanism — SEQN-03 requires automatic sending with no backend server
2. Data model — new dedicated tables vs. reusing campaigns table
3. Delay definition — from enrollment date vs. from previous step send time
4. Enrollment flow — auto-start on save vs. explicit Start button

---

## Decisions Made

### Scheduling mechanism
**Selected:** pg_cron + Edge Function

Supabase pg_cron runs a SQL job on a schedule (hourly), finds due enrollments (`next_send_at <= now() AND status = 'active'`), and invokes a new `send-sequence-step` Edge Function per pending step. True automation — sends while user is offline. Requires enabling pg_cron extension in Supabase dashboard.

Alternative considered: manual send per step — rejected because it breaks SEQN-03 ("without manual action").

### Data model
**Selected:** New dedicated tables (sequences, sequence_steps, sequence_enrollments)

Rationale: sequences are structurally distinct from campaigns — they have multiple steps, per-contact enrollment state, and time-based scheduling. Reusing campaigns table (like A/B testing did) would require JSONB steps storage and still need a separate enrollments table, making per-step stats queries unnecessarily complex.

### Delay definition
**Selected:** From enrollment date

`next_send_at = enrolled_at + interval '${delay_days} days'`

Step delays are absolute offsets from enrollment, not relative to the previous step's actual send time. Simpler to compute, predictable schedule regardless of cron timing or missed windows.

### Enrollment flow
**Selected:** Explicit Start button

Sequence lifecycle: draft → active → paused. Assigning a contact list configures the sequence but does not begin enrollment. User must click "Start sequence" to enroll all active contacts in the list and begin the schedule. Allows review before emails go out; supports pause/resume.

---

## Deferred Ideas

- Event-triggered enrollment (contact form submission, link click)
- Conditional branching (send X if opened, Y if not)
- Auto-enroll new contacts added to list after sequence starts
- Stop on reply condition
