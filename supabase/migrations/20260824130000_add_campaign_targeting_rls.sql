-- Enable RLS on campaign_targeting if not already enabled.
ALTER TABLE IF EXISTS public.campaign_targeting ENABLE ROW LEVEL SECURITY;

-- campaign_targeting: members of the owning organization can read targeting.
DROP POLICY IF EXISTS "campaign_targeting_select_own_org" ON public.campaign_targeting;
CREATE POLICY "campaign_targeting_select_own_org"
  ON public.campaign_targeting
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = campaign_targeting.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.status = 'active'
    )
  );

-- campaign_targeting: owners and admins can insert targeting for their campaigns.
DROP POLICY IF EXISTS "campaign_targeting_insert_own_org" ON public.campaign_targeting;
CREATE POLICY "campaign_targeting_insert_own_org"
  ON public.campaign_targeting
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = campaign_targeting.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
        AND organization_members.status = 'active'
    )
  );

-- campaign_targeting: owners and admins can update targeting for their campaigns.
DROP POLICY IF EXISTS "campaign_targeting_update_own_org" ON public.campaign_targeting;
CREATE POLICY "campaign_targeting_update_own_org"
  ON public.campaign_targeting
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = campaign_targeting.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
        AND organization_members.status = 'active'
    )
  );

-- campaign_targeting: owners and admins can delete targeting for their campaigns.
DROP POLICY IF EXISTS "campaign_targeting_delete_own_org" ON public.campaign_targeting;
CREATE POLICY "campaign_targeting_delete_own_org"
  ON public.campaign_targeting
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = campaign_targeting.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
        AND organization_members.status = 'active'
    )
  );
