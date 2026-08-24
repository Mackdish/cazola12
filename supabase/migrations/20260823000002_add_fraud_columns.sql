-- Phase 1: Fraud detection columns for impressions and clicks.
-- Raw IP retained for 90 days for fraud prevention, then nulled by purge job.
-- country/region/bot_score are retained indefinitely (non-identifying analytics).

ALTER TABLE public.impressions 
  ADD COLUMN IF NOT EXISTS ip_address text NULL,
  ADD COLUMN IF NOT EXISTS region text NULL,
  ADD COLUMN IF NOT EXISTS bot_score integer NULL,
  ADD COLUMN IF NOT EXISTS is_likely_bot boolean NOT NULL DEFAULT false;

ALTER TABLE public.clicks
  ADD COLUMN IF NOT EXISTS ip_address text NULL,
  ADD COLUMN IF NOT EXISTS region text NULL,
  ADD COLUMN IF NOT EXISTS bot_score integer NULL,
  ADD COLUMN IF NOT EXISTS is_likely_bot boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_impressions_bot_score
  ON public.impressions(is_likely_bot, created_at);

CREATE INDEX IF NOT EXISTS idx_clicks_bot_score
  ON public.clicks(is_likely_bot, created_at);

CREATE INDEX IF NOT EXISTS idx_impressions_ip_address
  ON public.impressions(ip_address)
  WHERE ip_address IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clicks_ip_address
  ON public.clicks(ip_address)
  WHERE ip_address IS NOT NULL;
