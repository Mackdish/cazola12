-- Add RLS policies for public.websites
-- The table has RLS enabled but no policies, which blocks all access.

CREATE POLICY "Users can view websites in their organizations" ON public.websites
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = websites.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.status = 'active'
    )
  );

CREATE POLICY "Owners and admins can insert websites in approved organizations" ON public.websites
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = websites.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
        AND organization_members.status = 'active'
    )
    AND EXISTS (
      SELECT 1 FROM public.publishers
      WHERE publishers.organization_id = websites.organization_id
        AND publishers.approval_status = 'approved'
    )
  );

CREATE POLICY "Owners and admins can update websites in approved organizations" ON public.websites
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = websites.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
        AND organization_members.status = 'active'
    )
    AND EXISTS (
      SELECT 1 FROM public.publishers
      WHERE publishers.organization_id = websites.organization_id
        AND publishers.approval_status = 'approved'
    )
  );

CREATE POLICY "Owners and admins can delete websites in approved organizations" ON public.websites
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = websites.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
        AND organization_members.status = 'active'
    )
    AND EXISTS (
      SELECT 1 FROM public.publishers
      WHERE publishers.organization_id = websites.organization_id
        AND publishers.approval_status = 'approved'
    )
  );
