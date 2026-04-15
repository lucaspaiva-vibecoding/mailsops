-- Migration 011: CSV Personalized Campaigns (Phase 9)
ALTER TABLE public.campaigns
  DROP CONSTRAINT campaigns_campaign_type_check,
  ADD CONSTRAINT campaigns_campaign_type_check
    CHECK (campaign_type IN ('regular', 'ab_test', 'ab_variant', 'csv_personalized'));

ALTER TABLE public.campaign_recipients
  ADD COLUMN IF NOT EXISTS personalized_subject TEXT,
  ADD COLUMN IF NOT EXISTS personalized_body TEXT;
