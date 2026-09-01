-- House ad fallback pool
--
-- Provides a minimal set of fallback creatives served when no auction
-- winner exists or when the serving path times out. House ads are never
-- billed to advertisers and are tracked separately for fill-rate metrics.

CREATE TABLE IF NOT EXISTS public.house_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creative_url text NOT NULL,
  click_url text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed one placeholder house ad so the fallback path always has something
-- to serve. Replace with actual creatives through the admin UI later.
INSERT INTO public.house_ads (creative_url, click_url, active)
VALUES (
  'https://placehold.co/300x250/2563eb/ffffff?text=TradeMall',
  'https://trademall.co.ke',
  true
)
ON CONFLICT DO NOTHING;

-- Index for active house ads lookups
CREATE INDEX IF NOT EXISTS idx_house_ads_active
  ON public.house_ads(active)
  WHERE active = true;

-- RLS
ALTER TABLE public.house_ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "house_ads_select_public"
  ON public.house_ads
  FOR SELECT
  TO anon, authenticated
  USING (active = true);

CREATE POLICY "house_ads_insert_platform"
  ON public.house_ads
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.platform_roles
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "house_ads_update_platform"
  ON public.house_ads
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_roles
      WHERE user_id = auth.uid()
    )
  );
