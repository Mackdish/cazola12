-- Add SELECT policy for public.publishers
-- This allows users to view publisher profiles for organizations they belong to.

CREATE POLICY publishers_select_own_org
ON public.publishers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = publishers.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.status = 'active'
  )
);
