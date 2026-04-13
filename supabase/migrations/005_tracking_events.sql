-- Migration: Create tracking_events table for append-only open/click event log
-- Records tracking events from email pixel and redirect hits — written by Edge Functions via service_role

CREATE TABLE public.tracking_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_id   UUID NOT NULL,
  event_type    TEXT NOT NULL,
  link_index    INT,
  link_url      TEXT,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_agent    TEXT,
  ip_address    INET
);

CREATE INDEX idx_tracking_events_tracking_id ON tracking_events(tracking_id);
CREATE INDEX idx_tracking_events_type ON tracking_events(event_type);

ALTER TABLE tracking_events ENABLE ROW LEVEL SECURITY;

-- No direct user SELECT policy needed — analytics queries go through campaigns/campaign_recipients JOIN
-- Edge Functions use service_role and bypass RLS entirely
