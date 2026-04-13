-- Migration: RLS policies for contact_list_members table
-- The contact_list_members table has RLS enabled (schema-v1.md) but NO explicit policies.
-- Without these policies, all queries on contact_list_members silently return empty results,
-- breaking LIST-03 (add/remove contacts) and LIST-04 (view contacts in a list).
--
-- Since contact_list_members has no workspace_id column, policies must join through
-- contact_lists.workspace_id to verify ownership.

-- SELECT: allows reading list membership (needed for LIST-04 list-filtered contact views)
CREATE POLICY "workspace_select_contact_list_members"
    ON public.contact_list_members FOR SELECT
    USING (
        contact_list_id IN (
            SELECT id FROM public.contact_lists
            WHERE workspace_id = (
                SELECT workspace_id FROM public.profiles WHERE id = auth.uid()
            )
        )
    );

-- INSERT: allows adding contacts to lists (needed for LIST-03 add-to-list)
CREATE POLICY "workspace_insert_contact_list_members"
    ON public.contact_list_members FOR INSERT
    WITH CHECK (
        contact_list_id IN (
            SELECT id FROM public.contact_lists
            WHERE workspace_id = (
                SELECT workspace_id FROM public.profiles WHERE id = auth.uid()
            )
        )
    );

-- DELETE: allows removing contacts from lists (needed for LIST-03 remove-from-list)
CREATE POLICY "workspace_delete_contact_list_members"
    ON public.contact_list_members FOR DELETE
    USING (
        contact_list_id IN (
            SELECT id FROM public.contact_lists
            WHERE workspace_id = (
                SELECT workspace_id FROM public.profiles WHERE id = auth.uid()
            )
        )
    );
