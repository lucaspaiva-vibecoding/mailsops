-- Migration 007: Add A/B testing columns to campaigns table
-- Adds campaign_type discriminator and parent_campaign_id for sibling-campaign A/B model (Phase 5)

ALTER TABLE public.campaigns
  ADD COLUMN campaign_type TEXT NOT NULL DEFAULT 'regular'
    CHECK (campaign_type IN ('regular', 'ab_test', 'ab_variant')),
  ADD COLUMN parent_campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE;

-- Index for fetching variants by parent (used by useAbTest hook)
CREATE INDEX idx_campaigns_parent ON public.campaigns(parent_campaign_id)
  WHERE parent_campaign_id IS NOT NULL;

-- RLS: existing policies gate on workspace_id — no new policies needed.
-- campaign_type and parent_campaign_id are covered by the same workspace_id check.
