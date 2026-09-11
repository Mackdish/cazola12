-- Phase 2 publisher placement manager.
-- Keeps semantic placement configuration separate from ad_zones so existing
-- embed/auction behavior remains backward compatible while the dashboard
-- moves from code-first zones to location-first placements.

CREATE TABLE IF NOT EXISTS public.website_placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id uuid NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  zone_id uuid REFERENCES public.ad_zones(id) ON DELETE SET NULL,
  placement_key text NOT NULL CHECK (
    placement_key IN (
      'top_page',
      'article_top',
      'between_paragraphs',
      'sidebar',
      'bottom_article',
      'mobile_sticky'
    )
  ),
  label text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (website_id, placement_key)
);

CREATE INDEX IF NOT EXISTS idx_website_placements_website_id
  ON public.website_placements(website_id);

CREATE INDEX IF NOT EXISTS idx_website_placements_zone_id
  ON public.website_placements(zone_id);

ALTER TABLE public.website_placements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view placements in their organizations"
  ON public.website_placements
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = website_placements.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.status = 'active'
    )
  );

CREATE POLICY "Managers can insert placements in their organizations"
  ON public.website_placements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = website_placements.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin', 'manager')
        AND organization_members.status = 'active'
    )
  );

CREATE POLICY "Managers can update placements in their organizations"
  ON public.website_placements
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = website_placements.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin', 'manager')
        AND organization_members.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = website_placements.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin', 'manager')
        AND organization_members.status = 'active'
    )
  );

CREATE POLICY "Managers can delete placements in their organizations"
  ON public.website_placements
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = website_placements.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin', 'manager')
        AND organization_members.status = 'active'
    )
  );

CREATE OR REPLACE FUNCTION public.set_website_placements_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS website_placements_updated_at ON public.website_placements;
CREATE TRIGGER website_placements_updated_at
  BEFORE UPDATE ON public.website_placements
  FOR EACH ROW
  EXECUTE FUNCTION public.set_website_placements_updated_at();
