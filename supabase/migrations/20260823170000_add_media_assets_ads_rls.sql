-- Enable RLS on advertiser media/asset tables if not already enabled.
ALTER TABLE IF EXISTS public.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ads ENABLE ROW LEVEL SECURITY;

-- media_assets: members of the owning organization can read creatives.
DROP POLICY IF EXISTS "media_assets_select_own_org" ON public.media_assets;
CREATE POLICY "media_assets_select_own_org"
  ON public.media_assets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = media_assets.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.status = 'active'
    )
  );

-- media_assets: owners and admins can insert creatives in their organizations.
DROP POLICY IF EXISTS "media_assets_insert_own_org" ON public.media_assets;
CREATE POLICY "media_assets_insert_own_org"
  ON public.media_assets
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = media_assets.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
        AND organization_members.status = 'active'
    )
  );

-- media_assets: owners and admins can update creatives in their organizations.
DROP POLICY IF EXISTS "media_assets_update_own_org" ON public.media_assets;
CREATE POLICY "media_assets_update_own_org"
  ON public.media_assets
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = media_assets.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
        AND organization_members.status = 'active'
    )
  );

-- media_assets: owners and admins can delete creatives in their organizations.
DROP POLICY IF EXISTS "media_assets_delete_own_org" ON public.media_assets;
CREATE POLICY "media_assets_delete_own_org"
  ON public.media_assets
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = media_assets.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
        AND organization_members.status = 'active'
    )
  );

-- ads: members of the owning organization can read ads.
DROP POLICY IF EXISTS "ads_select_own_org" ON public.ads;
CREATE POLICY "ads_select_own_org"
  ON public.ads
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = ads.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.status = 'active'
    )
  );

-- ads: owners and admins can insert ads in their organizations.
DROP POLICY IF EXISTS "ads_insert_own_org" ON public.ads;
CREATE POLICY "ads_insert_own_org"
  ON public.ads
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = ads.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
        AND organization_members.status = 'active'
    )
  );

-- ads: owners and admins can update ads in their organizations.
DROP POLICY IF EXISTS "ads_update_own_org" ON public.ads;
CREATE POLICY "ads_update_own_org"
  ON public.ads
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = ads.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
        AND organization_members.status = 'active'
    )
  );

-- ads: owners and admins can delete ads in their organizations.
DROP POLICY IF EXISTS "ads_delete_own_org" ON public.ads;
CREATE POLICY "ads_delete_own_org"
  ON public.ads
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = ads.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
        AND organization_members.status = 'active'
    )
  );
