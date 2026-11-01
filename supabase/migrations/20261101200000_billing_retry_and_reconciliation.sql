-- Billing retry + reconciliation.
--
-- Problem: an impression/click row is inserted first and billed second. If the
-- billing call fails in between (database blip, Worker timeout) the event is
-- recorded but never charged, and a client retry cannot fix it because the unique
-- request_id makes the second insert a "duplicate" that skips billing. The
-- advertiser is under-charged and the publisher is under-paid, silently.
--
-- This adds (1) a function that lists billable events with no matching charge,
-- (2) a small attempts table so a permanently un-billable event (paused
-- campaign, empty wallet) is retried a few times with backoff and then left
-- alone instead of starving newer events, and (3) a daily reconciliation report
-- that compares the four ledgers that must always agree.
-- charge_campaign_event is idempotent on (request_id, event_type), so retrying is
-- always safe.

CREATE TABLE IF NOT EXISTS public.billing_retry_attempts (
  event_type text NOT NULL CHECK (event_type IN ('impression', 'click')),
  request_id text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  last_reason text,
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_type, request_id)
);

ALTER TABLE public.billing_retry_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_retry_attempts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.billing_retry_attempts TO service_role;

-- Lets the retry scan prune quickly.
CREATE INDEX IF NOT EXISTS billing_retry_attempts_last_attempt_idx
  ON public.billing_retry_attempts (last_attempt_at);

-- 1. Billable events with no charge -------------------------------------------
-- CPM campaigns bill impressions, CPC campaigns bill clicks. Bot-flagged events
-- are intentionally never billed and are excluded. _min_age leaves the normal
-- request path time to finish billing before we step in.
CREATE OR REPLACE FUNCTION public.find_unbilled_events(
  _min_age interval DEFAULT interval '2 minutes',
  _max_age interval DEFAULT interval '24 hours',
  _limit integer DEFAULT 100,
  _max_attempts integer DEFAULT 5
)
RETURNS TABLE (
  event_type text,
  request_id text,
  campaign_id uuid,
  ad_id uuid,
  publisher_id uuid,
  website_id uuid,
  ad_zone_id uuid
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH candidates AS (
    SELECT 'impression'::text AS event_type, i.request_id::text AS request_id,
           i.campaign_id, i.ad_id, i.publisher_id, i.website_id, i.ad_zone_id,
           i.created_at
    FROM public.impressions i
    JOIN public.campaigns c ON c.id = i.campaign_id
    WHERE c.bid_type = 'cpm'
      AND COALESCE(i.is_likely_bot, false) = false
      AND i.created_at < now() - _min_age
      AND i.created_at > now() - _max_age
    UNION ALL
    SELECT 'click'::text, k.request_id::text,
           k.campaign_id, k.ad_id, k.publisher_id, k.website_id, k.ad_zone_id,
           k.created_at
    FROM public.clicks k
    JOIN public.campaigns c ON c.id = k.campaign_id
    WHERE c.bid_type = 'cpc'
      AND COALESCE(k.is_likely_bot, false) = false
      AND k.created_at < now() - _min_age
      AND k.created_at > now() - _max_age
  )
  SELECT x.event_type, x.request_id, x.campaign_id, x.ad_id, x.publisher_id,
         x.website_id, x.ad_zone_id
  FROM candidates x
  LEFT JOIN public.billing_retry_attempts a
    ON a.event_type = x.event_type AND a.request_id = x.request_id
  WHERE NOT EXISTS (
          SELECT 1 FROM public.campaign_spend s
          WHERE s.request_id::text = x.request_id AND s.event_type = x.event_type
        )
    AND (
          a.request_id IS NULL
          OR (
            a.attempts < _max_attempts
            -- linear backoff: 2 min, 4 min, 6 min ...
            AND a.last_attempt_at < now() - (a.attempts * interval '2 minutes')
          )
        )
  ORDER BY x.created_at
  LIMIT GREATEST(_limit, 1);
$$;

-- 2. Attempt bookkeeping --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_billing_retry(
  _event_type text,
  _request_id text,
  _reason text
)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  INSERT INTO public.billing_retry_attempts (event_type, request_id, attempts, last_reason, last_attempt_at)
  VALUES (_event_type, _request_id, 1, _reason, now())
  ON CONFLICT (event_type, request_id) DO UPDATE
    SET attempts = public.billing_retry_attempts.attempts + 1,
        last_reason = EXCLUDED.last_reason,
        last_attempt_at = now();
$$;

-- 3. Reconciliation report ------------------------------------------------------
-- One row per day. Every spend row must have exactly one wallet debit and one
-- publisher earning, and the amounts must agree. Any non-zero *_diff column or a
-- non-zero unbilled_events is a bug worth investigating.
CREATE OR REPLACE FUNCTION public.billing_reconciliation(_days integer DEFAULT 7)
RETURNS TABLE (
  day date,
  impressions bigint,
  clicks bigint,
  spend_rows bigint,
  spend_total numeric,
  wallet_debit_total numeric,
  publisher_gross_total numeric,
  wallet_diff numeric,
  publisher_diff numeric,
  unbilled_events bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH days AS (
    SELECT d::date AS day
    FROM generate_series(
      (CURRENT_DATE - (GREATEST(_days, 1) - 1)), CURRENT_DATE, interval '1 day'
    ) d
  ),
  imp AS (
    SELECT created_at::date AS day, count(*) AS n FROM public.impressions
    WHERE created_at >= CURRENT_DATE - (GREATEST(_days, 1) - 1) GROUP BY 1
  ),
  clk AS (
    SELECT created_at::date AS day, count(*) AS n FROM public.clicks
    WHERE created_at >= CURRENT_DATE - (GREATEST(_days, 1) - 1) GROUP BY 1
  ),
  spend AS (
    SELECT created_at::date AS day, count(*) AS n, COALESCE(sum(amount), 0) AS total
    FROM public.campaign_spend
    WHERE created_at >= CURRENT_DATE - (GREATEST(_days, 1) - 1) GROUP BY 1
  ),
  wallet AS (
    SELECT created_at::date AS day, COALESCE(sum(amount), 0) AS total
    FROM public.wallet_transactions
    WHERE type = 'spend' AND reference_type = 'campaign'
      AND created_at >= CURRENT_DATE - (GREATEST(_days, 1) - 1) GROUP BY 1
  ),
  earn AS (
    SELECT created_at::date AS day, COALESCE(sum(gross_amount), 0) AS total
    FROM public.publisher_earnings
    WHERE created_at >= CURRENT_DATE - (GREATEST(_days, 1) - 1) GROUP BY 1
  ),
  unbilled AS (
    SELECT created_at::date AS day, count(*) AS n FROM (
      SELECT i.created_at FROM public.impressions i
      JOIN public.campaigns c ON c.id = i.campaign_id
      WHERE c.bid_type = 'cpm' AND COALESCE(i.is_likely_bot, false) = false
        AND i.created_at >= CURRENT_DATE - (GREATEST(_days, 1) - 1)
        AND i.created_at < now() - interval '10 minutes'
        AND NOT EXISTS (SELECT 1 FROM public.campaign_spend s
                        WHERE s.request_id::text = i.request_id::text AND s.event_type = 'impression')
      UNION ALL
      SELECT k.created_at FROM public.clicks k
      JOIN public.campaigns c ON c.id = k.campaign_id
      WHERE c.bid_type = 'cpc' AND COALESCE(k.is_likely_bot, false) = false
        AND k.created_at >= CURRENT_DATE - (GREATEST(_days, 1) - 1)
        AND k.created_at < now() - interval '10 minutes'
        AND NOT EXISTS (SELECT 1 FROM public.campaign_spend s
                        WHERE s.request_id::text = k.request_id::text AND s.event_type = 'click')
    ) u GROUP BY 1
  )
  SELECT d.day,
         COALESCE(imp.n, 0), COALESCE(clk.n, 0),
         COALESCE(spend.n, 0), COALESCE(spend.total, 0),
         COALESCE(wallet.total, 0), COALESCE(earn.total, 0),
         COALESCE(spend.total, 0) - COALESCE(wallet.total, 0),
         COALESCE(spend.total, 0) - COALESCE(earn.total, 0),
         COALESCE(unbilled.n, 0)
  FROM days d
  LEFT JOIN imp ON imp.day = d.day
  LEFT JOIN clk ON clk.day = d.day
  LEFT JOIN spend ON spend.day = d.day
  LEFT JOIN wallet ON wallet.day = d.day
  LEFT JOIN earn ON earn.day = d.day
  LEFT JOIN unbilled ON unbilled.day = d.day
  ORDER BY d.day DESC;
$$;

-- Server only.
REVOKE ALL ON FUNCTION public.find_unbilled_events(interval, interval, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_billing_retry(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.billing_reconciliation(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_unbilled_events(interval, interval, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_billing_retry(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.billing_reconciliation(integer) TO service_role;

-- Rollback:
--   DROP FUNCTION IF EXISTS public.billing_reconciliation(integer);
--   DROP FUNCTION IF EXISTS public.record_billing_retry(text, text, text);
--   DROP FUNCTION IF EXISTS public.find_unbilled_events(interval, interval, integer, integer);
--   DROP TABLE IF EXISTS public.billing_retry_attempts;
