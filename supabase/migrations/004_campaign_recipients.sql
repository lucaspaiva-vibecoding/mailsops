-- Migration: Create campaign_recipients table for per-recipient delivery tracking
-- Tracks each individual email send with delivery status, tracking ID, and link map

CREATE TABLE public.campaign_recipients (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id       UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id        UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  tracking_id       UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  resend_email_id   TEXT,
  delivery_status   TEXT NOT NULL DEFAULT 'queued',
  link_map          JSONB,
  sent_at           TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  bounced_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaign_recipients_campaign ON campaign_recipients(campaign_id);
CREATE INDEX idx_campaign_recipients_tracking ON campaign_recipients(tracking_id);
CREATE INDEX idx_campaign_recipients_resend_id ON campaign_recipients(resend_email_id);

ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;

-- RLS policy: workspace users can SELECT their own campaign recipients (via campaigns join)
CREATE POLICY "Users can view their campaign recipients"
  ON campaign_recipients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_recipients.campaign_id
      AND campaigns.workspace_id = (
        SELECT workspace_id FROM profiles WHERE id = auth.uid()
      )
    )
  );
