-- Migration: Create contact_import_logs table for CONT-04 (import history)
-- This table is NOT in schema-v1.md and must be added.

CREATE TABLE public.contact_import_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES public.profiles(workspace_id),
    total_rows      INT NOT NULL DEFAULT 0,
    imported        INT NOT NULL DEFAULT 0,
    updated         INT NOT NULL DEFAULT 0,
    skipped         INT NOT NULL DEFAULT 0,
    errors          INT NOT NULL DEFAULT 0,
    error_details   JSONB DEFAULT '[]',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_import_logs_workspace ON public.contact_import_logs(workspace_id);

ALTER TABLE public.contact_import_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workspace import logs"
    ON public.contact_import_logs FOR SELECT
    USING (workspace_id = (SELECT workspace_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own workspace import logs"
    ON public.contact_import_logs FOR INSERT
    WITH CHECK (workspace_id = (SELECT workspace_id FROM public.profiles WHERE id = auth.uid()));
