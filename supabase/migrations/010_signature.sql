-- Migration 010: Signature columns on profiles
-- Phase 8: Email Signature & Rich HTML Body

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signature_html TEXT,
  ADD COLUMN IF NOT EXISTS signature_json JSONB;
