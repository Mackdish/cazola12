-- Missing indexes for RLS-filtered columns and frequently queried tables.
-- These indexes prevent full table scans on every RLS check and common lookups.

-- organization_members: used in RLS EXISTS subqueries for websites, publishers,
-- ad_zones, domain_verifications, and membership checks.
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id
  ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_org_id
  ON public.organization_members(organization_id);

-- publishers: used in RLS EXISTS checks for websites and ad_zones writes.
CREATE INDEX IF NOT EXISTS idx_publishers_org_id
  ON public.publishers(organization_id);

-- websites: frequently filtered by organization_id in app queries.
CREATE INDEX IF NOT EXISTS idx_websites_org_id
  ON public.websites(organization_id);

-- ad_zones: RLS outer table and frequent lookups by website/org.
CREATE INDEX IF NOT EXISTS idx_ad_zones_org_id
  ON public.ad_zones(organization_id);
CREATE INDEX IF NOT EXISTS idx_ad_zones_website_id
  ON public.ad_zones(website_id);

-- domain_verifications: RLS outer table.
CREATE INDEX IF NOT EXISTS idx_domain_verifications_org_id
  ON public.domain_verifications(organization_id);

-- campaigns: heavy read filtering by organization_id.
CREATE INDEX IF NOT EXISTS idx_campaigns_org_id
  ON public.campaigns(organization_id);

-- wallets: frequent balance checks by organization_id.
CREATE INDEX IF NOT EXISTS idx_wallets_org_id
  ON public.wallets(organization_id);

-- auto_ads_config: frequent lookups by website_id.
CREATE INDEX IF NOT EXISTS idx_auto_ads_config_website_id
  ON public.auto_ads_config(website_id);

-- ad_controls: frequent lookups by website_id.
CREATE INDEX IF NOT EXISTS idx_ad_controls_website_id
  ON public.ad_controls(website_id);
