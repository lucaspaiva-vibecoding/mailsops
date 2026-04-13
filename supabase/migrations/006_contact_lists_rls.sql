-- Migration: Add RLS policies for contact_lists table
-- Ensures workspace members can read, insert, update, and soft-delete their own lists

ALTER TABLE public.contact_lists ENABLE ROW LEVEL SECURITY;

-- SELECT: users can view contact lists in their workspace
CREATE POLICY "Users can view their workspace contact lists"
  ON public.contact_lists FOR SELECT
  USING (
    workspace_id = (SELECT workspace_id FROM public.profiles WHERE id = auth.uid())
  );

-- INSERT: users can create contact lists in their workspace
CREATE POLICY "Users can create contact lists in their workspace"
  ON public.contact_lists FOR INSERT
  WITH CHECK (
    workspace_id = (SELECT workspace_id FROM public.profiles WHERE id = auth.uid())
  );

-- UPDATE: users can update contact lists in their workspace
CREATE POLICY "Users can update their workspace contact lists"
  ON public.contact_lists FOR UPDATE
  USING (
    workspace_id = (SELECT workspace_id FROM public.profiles WHERE id = auth.uid())
  );
