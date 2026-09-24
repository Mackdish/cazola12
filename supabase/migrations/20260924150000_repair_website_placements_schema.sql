-- Repair migration for deployments where the placement-manager migration
-- exists in git but public.website_placements is missing from the live schema.
-- Everything is idempotent so this is safe on already-correct databases.

CREATE TABLE IF NOT EXISTS public.website_placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id uuid NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  zone_id uuid REFERENCES public.ad_zones(id) ON DELETE SET NULL,
  placement_key text NOT NULL,
  label text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.website_placements
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS zone_id uuid REFERENCES public.ad_zones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS placement_key text,
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill labels for rows created by an older/incomplete deployment.
UPDATE public.website_placements
SET label = CASE placement_key
  WHEN 'top_page' THEN 'Top of page'
  WHEN 'article_top' THEN 'Top of article'
  WHEN 'between_paragraphs' THEN 'Between paragraphs'
  WHEN 'sidebar' THEN 'Sidebar'
  WHEN 'bottom_article' THEN 'Bottom of article'
  WHEN 'mobile_sticky' THEN 'Mobile sticky'
  ELSE COALESCE(label, placement_key)
END
WHERE label IS NULL OR label = '';

ALTER TABLE public.website_placements
  DROP CONSTRAINT IF EXISTS website_placements_placement_key_check;

ALTER TABLE public.website_placements
  ADD CONSTRAINT website_placements_placement_key_check
  CHECK (placement_key IN (
    'top_page',
    'article_top',
    'between_paragraphs',
    'sidebar',
    'bottom_article',
    'mobile_sticky'
  ));

CREATE UNIQUE INDEX IF NOT EXISTS uq_website_placements_website_key
  ON public.website_placements(website_id, placement_key);

CREATE INDEX IF NOT EXISTS idx_website_placements_website_id
  ON public.website_placements(website_id);

CREATE INDEX IF NOT EXISTS idx_website_placements_zone_id
  ON public.website_placements(zone_id);

ALTER TABLE public.website_placements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'website_placements'
      AND policyname = 'Users can view placements in their organizations'
  ) THEN
    CREATE POLICY "Users can view placements in their organizations"
      ON public.website_placements FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.organization_members
          WHERE organization_members.organization_id = website_placements.organization_id
            AND organization_members.user_id = auth.uid()
            AND organization_members.status = 'active'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'website_placements'
      AND policyname = 'Managers can insert placements in their organizations'
  ) THEN
    CREATE POLICY "Managers can insert placements in their organizations"
      ON public.website_placements FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.organization_members
          WHERE organization_members.organization_id = website_placements.organization_id
            AND organization_members.user_id = auth.uid()
            AND organization_members.role IN ('owner', 'admin', 'manager')
            AND organization_members.status = 'active'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'website_placements'
      AND policyname = 'Managers can update placements in their organizations'
  ) THEN
    CREATE POLICY "Managers can update placements in their organizations"
      ON public.website_placements FOR UPDATE TO authenticated
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
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'website_placements'
      AND policyname = 'Managers can delete placements in their organizations'
  ) THEN
    CREATE POLICY "Managers can delete placements in their organizations"
      ON public.website_placements FOR DELETE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.organization_members
          WHERE organization_members.organization_id = website_placements.organization_id
            AND organization_members.user_id = auth.uid()
            AND organization_members.role IN ('owner', 'admin', 'manager')
            AND organization_members.status = 'active'
        )
      );
  END IF;
END $$;

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

-- Force PostgREST to reload the table schema immediately after migration.
NOTIFY pgrst, 'reload schema';
