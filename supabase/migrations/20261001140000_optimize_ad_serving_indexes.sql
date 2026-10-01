-- TradeMall ad-serving hot-path indexes.
-- These indexes support the exact predicates used by the public auction path.
-- Billing remains authoritative; these indexes only reduce candidate lookup cost.

CREATE INDEX IF NOT EXISTS idx_ads_serving_active_format_created
  ON public.ads(format, created_at DESC, id)
  WHERE status = 'active'
    AND approval_status = 'approved'
    AND media_asset_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ads_serving_campaign_id
  ON public.ads(campaign_id, created_at DESC, id)
  WHERE status = 'active'
    AND approval_status = 'approved'
    AND media_asset_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_campaigns_serving_active
  ON public.campaigns(id, organization_id, status, approval_status)
  WHERE approval_status = 'approved'
    AND status IN ('active', 'approved');

CREATE INDEX IF NOT EXISTS idx_campaign_targeting_campaign_id
  ON public.campaign_targeting(campaign_id);

CREATE INDEX IF NOT EXISTS idx_wallets_serving_funded_kes
  ON public.wallets(organization_id, currency)
  WHERE currency = 'KES'
    AND balance_amount > 0;
