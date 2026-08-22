-- Add RLS policies for public.ad_zones
-- The table has RLS enabled but no policies, which blocks all access for non-admin users.

CREATE POLICY "Users can view ad zones in their organizations" ON public.ad_zones
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = ad_zones.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.status = 'active'
    )
  );

CREATE POLICY "Owners and admins can insert ad zones in approved organizations" ON public.ad_zones
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = ad_zones.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
        AND organization_members.status = 'active'
    )
    AND EXISTS (
      SELECT 1 FROM public.publishers
      WHERE publishers.organization_id = ad_zones.organization_id
        AND publishers.approval_status = 'approved'
    )
  );

CREATE POLICY "Owners and admins can update ad zones in approved organizations" ON public.ad_zones
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = ad_zones.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
        AND organization_members.status = 'active'
    )
    AND EXISTS (
      SELECT 1 FROM public.publishers
      WHERE publishers.organization_id = ad_zones.organization_id
        AND publishers.approval_status = 'approved'
    )
  );

CREATE POLICY "Owners and admins can delete ad zones in approved organizations" ON public.ad_zones
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = ad_zones.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
        AND organization_members.status = 'active'
    )
    AND EXISTS (
      SELECT 1 FROM public.publishers
      WHERE publishers.organization_id = ad_zones.organization_id
        AND publishers.approval_status = 'approved'
    )
  );
