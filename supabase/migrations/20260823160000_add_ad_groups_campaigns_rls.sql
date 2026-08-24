-- Enable RLS on advertiser-owned tables if not already enabled.
ALTER TABLE IF EXISTS public.ad_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.campaigns ENABLE ROW LEVEL SECURITY;

-- campaigns: members of the owning organization can read campaigns.
DROP POLICY IF EXISTS "campaigns_select_own_org" ON public.campaigns;
CREATE POLICY "campaigns_select_own_org"
  ON public.campaigns
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = campaigns.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.status = 'active'
    )
  );

-- campaigns: owners and admins can insert campaigns in approved organizations.
DROP POLICY IF EXISTS "campaigns_insert_approved_org" ON public.campaigns;
CREATE POLICY "campaigns_insert_approved_org"
  ON public.campaigns
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = campaigns.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
        AND organization_members.status = 'active'
    )
  );

-- campaigns: owners and admins can update campaigns in their organizations.
DROP POLICY IF EXISTS "campaigns_update_own_org" ON public.campaigns;
CREATE POLICY "campaigns_update_own_org"
  ON public.campaigns
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = campaigns.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
        AND organization_members.status = 'active'
    )
  );

-- ad_groups: members of the owning organization can read ad groups.
DROP POLICY IF EXISTS "ad_groups_select_own_org" ON public.ad_groups;
CREATE POLICY "ad_groups_select_own_org"
  ON public.ad_groups
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = ad_groups.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.status = 'active'
    )
  );

-- ad_groups: owners and admins can insert ad groups in their campaigns' organizations.
DROP POLICY IF EXISTS "ad_groups_insert_own_org" ON public.ad_groups;
CREATE POLICY "ad_groups_insert_own_org"
  ON public.ad_groups
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = ad_groups.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
        AND organization_members.status = 'active'
    )
  );

-- ad_groups: owners and admins can update ad groups in their organizations.
DROP POLICY IF EXISTS "ad_groups_update_own_org" ON public.ad_groups;
CREATE POLICY "ad_groups_update_own_org"
  ON public.ad_groups
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = ad_groups.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
        AND organization_members.status = 'active'
    )
  );

-- ad_groups: owners and admins can delete ad groups in their organizations.
DROP POLICY IF EXISTS "ad_groups_delete_own_org" ON public.ad_groups;
CREATE POLICY "ad_groups_delete_own_org"
  ON public.ad_groups
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = ad_groups.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
        AND organization_members.status = 'active'
    )
  );
