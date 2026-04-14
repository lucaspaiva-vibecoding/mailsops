-- Migration 008: Create sequences tables for multi-step drip campaigns
-- Phase 6: Sequences — data foundation

-- Enable required extensions (safe idempotent calls)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── sequences table ──
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

-- ── sequence_steps table ──
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

-- ── sequence_enrollments table ──
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

-- ── sequence_step_sends bridge table (D-05 — links enrollments to campaign_recipients for per-step stats) ──
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

-- ── ALTER campaign_recipients for sequence support ──
-- campaign_recipients.campaign_id is NOT NULL FK to campaigns(id).
-- Sequence step sends need to create campaign_recipients rows for tracking (open/click/unsub)
-- but sequence UUIDs are NOT in the campaigns table, so the FK would fail.
-- Resolution: make campaign_id nullable and add a dedicated sequence_id column.
-- The existing tracking function (t) looks up by tracking_id only, not campaign_id,
-- so this change does not break any existing tracking behavior.
ALTER TABLE public.campaign_recipients ALTER COLUMN campaign_id DROP NOT NULL;
ALTER TABLE public.campaign_recipients ADD COLUMN sequence_id UUID REFERENCES public.sequences(id);
