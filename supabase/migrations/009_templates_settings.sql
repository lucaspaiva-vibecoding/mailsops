-- Migration 009: Templates table + Settings columns on profiles
-- Phase 7: Templates & Settings

-- ── templates table ──
CREATE TABLE public.templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL,
  name          TEXT NOT NULL,
  subject       TEXT NOT NULL DEFAULT '',
  preview_text  TEXT,
  from_name     TEXT NOT NULL DEFAULT '',
  from_email    TEXT NOT NULL DEFAULT '',
  body_html     TEXT NOT NULL DEFAULT '',
  body_json     JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_templates_workspace ON public.templates(workspace_id);
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their templates"
  ON public.templates FOR ALL
  USING (workspace_id = (SELECT workspace_id FROM profiles WHERE id = auth.uid()));

-- ── profiles extensions for workspace defaults + integrations ──
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_sender_name     TEXT,
  ADD COLUMN IF NOT EXISTS default_sender_email    TEXT,
  ADD COLUMN IF NOT EXISTS resend_api_key          TEXT,
  ADD COLUMN IF NOT EXISTS unsubscribe_footer_text TEXT DEFAULT 'To unsubscribe from future emails, click here: {{unsubscribe_url}}';
