-- Add frequency_cap to campaign_targeting for Phase 1 frequency capping.
-- Stored as JSONB: { "impressions": number, "periodHours": number } or null.

ALTER TABLE public.campaign_targeting
  ADD COLUMN IF NOT EXISTS frequency_cap jsonb NULL;

COMMENT ON COLUMN public.campaign_targeting.frequency_cap IS 'Optional per-campaign frequency cap: { impressions: number, periodHours: number }';
