-- Atomic campaign daily-budget charging.
--
-- The serving path already bills the complete impression/click through
-- charge_campaign_event. This migration moves the daily-budget mutation into
-- PostgreSQL so the budget decision and deduction occur under the same row lock
-- as the financial event. Do not call charge_campaign_budget() from application
-- code immediately before charge_campaign_event(); that would create two
-- transactions and could reserve budget without successfully recording spend.

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS daily_budget_remaining numeric(14,4),
  ADD COLUMN IF NOT EXISTS daily_budget_remaining_date date;

UPDATE public.campaigns c
SET daily_budget_remaining = CASE
      WHEN c.daily_budget IS NULL OR c.daily_budget <= 0 THEN NULL
      ELSE GREATEST(
        c.daily_budget - COALESCE((
          SELECT SUM(s.spend)
          FROM public.campaign_daily_stats s
          WHERE s.campaign_id = c.id
            AND s.date = CURRENT_DATE
        ), 0),
        0
      )
    END,
    daily_budget_remaining_date = CURRENT_DATE
WHERE c.daily_budget IS NOT NULL
   OR c.daily_budget_remaining IS NULL;

CREATE OR REPLACE FUNCTION public.charge_campaign_budget(
  p_campaign_id uuid,
  p_cost numeric
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_campaign public.campaigns%ROWTYPE;
  v_remaining numeric(14,4);
BEGIN
  IF p_campaign_id IS NULL OR p_cost IS NULL OR p_cost <= 0 THEN
    RETURN FALSE;
  END IF;

  SELECT *
  INTO v_campaign
  FROM public.campaigns
  WHERE id = p_campaign_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF v_campaign.daily_budget IS NULL OR v_campaign.daily_budget <= 0 THEN
    RETURN TRUE;
  END IF;

  IF v_campaign.daily_budget_remaining_date IS DISTINCT FROM CURRENT_DATE THEN
    v_remaining := v_campaign.daily_budget;
  ELSE
    v_remaining := COALESCE(v_campaign.daily_budget_remaining, v_campaign.daily_budget);
  END IF;

  IF v_remaining < p_cost THEN
    UPDATE public.campaigns
    SET status = 'paused',
        pause_reason = 'budget_exhausted',
        daily_budget_remaining = GREATEST(v_remaining, 0),
        daily_budget_remaining_date = CURRENT_DATE,
        updated_at = now()
    WHERE id = p_campaign_id;

    RETURN FALSE;
  END IF;

  UPDATE public.campaigns
  SET daily_budget_remaining = v_remaining - p_cost,
      daily_budget_remaining_date = CURRENT_DATE,
      updated_at = now()
  WHERE id = p_campaign_id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.charge_campaign_budget(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.charge_campaign_budget(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.charge_campaign_budget(uuid, numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.charge_campaign_event(
  _campaign_id uuid,
  _ad_id uuid,
  _ad_zone_id uuid,
  _event_type text,
  _publisher_id uuid,
  _request_id text,
  _website_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _campaign record;
  _wallet record;
  _settings record;
  _event_cost numeric(14,4);
  _publisher_share numeric(14,4);
  _platform_share numeric(14,4);
  _revenue_share numeric;
  _today date := CURRENT_DATE;
  _now timestamptz := now();
  _spend_id uuid;
  _budget_ok boolean;
BEGIN
  IF _event_type NOT IN ('impression', 'click') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_request', 'amount', 0, 'publisher_amount', 0, 'platform_amount', 0);
  END IF;

  SELECT * INTO _settings
  FROM public.platform_settings
  ORDER BY id
  LIMIT 1;

  IF EXISTS (
    SELECT 1 FROM public.campaign_spend
    WHERE request_id = _request_id AND event_type = _event_type
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'duplicate', 'amount', 0, 'publisher_amount', 0, 'platform_amount', 0);
  END IF;

  SELECT * INTO _campaign
  FROM public.campaigns
  WHERE id = _campaign_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown_campaign', 'amount', 0, 'publisher_amount', 0, 'platform_amount', 0);
  END IF;

  IF _campaign.status NOT IN ('active', 'approved') OR _campaign.approval_status <> 'approved' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'campaign_inactive', 'amount', 0, 'publisher_amount', 0, 'platform_amount', 0);
  END IF;

  IF COALESCE(_campaign.spent_amount, 0) >= COALESCE(_campaign.total_budget, 0) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'budget_exhausted', 'amount', 0, 'publisher_amount', 0, 'platform_amount', 0);
  END IF;

  IF _event_type = 'click' AND _campaign.bid_type = 'cpc' THEN
    _event_cost := _campaign.bid_amount;
  ELSIF _event_type = 'impression' AND _campaign.bid_type = 'cpm' THEN
    _event_cost := _campaign.bid_amount / 1000.0;
  ELSE
    RETURN jsonb_build_object('ok', false, 'reason', 'not_billable', 'amount', 0, 'publisher_amount', 0, 'platform_amount', 0);
  END IF;

  _event_cost := round(_event_cost, 6);
  IF _event_cost <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_billable', 'amount', 0, 'publisher_amount', 0, 'platform_amount', 0);
  END IF;

  IF COALESCE(_campaign.spent_amount, 0) + _event_cost > COALESCE(_campaign.total_budget, 0) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'budget_exhausted', 'amount', 0, 'publisher_amount', 0, 'platform_amount', 0);
  END IF;

  -- Lock the advertiser wallet before consuming daily budget. If the wallet
  -- cannot fund the event, this transaction returns without mutating budget.
  SELECT * INTO _wallet
  FROM public.wallets
  WHERE organization_id = _campaign.organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_wallet', 'amount', 0, 'publisher_amount', 0, 'platform_amount', 0);
  END IF;

  IF COALESCE(_wallet.balance_amount, 0) < _event_cost THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'insufficient_funds', 'amount', 0, 'publisher_amount', 0, 'platform_amount', 0);
  END IF;

  -- Atomic daily budget reservation. The campaign row is already locked by
  -- charge_campaign_event and remains locked through the whole transaction.
  _budget_ok := public.charge_campaign_budget(_campaign_id, _event_cost);
  IF NOT _budget_ok THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'daily_budget_exhausted', 'amount', 0, 'publisher_amount', 0, 'platform_amount', 0);
  END IF;

  _revenue_share := COALESCE(_settings.publisher_revenue_share, 0.7);
  IF _revenue_share > 1 THEN
    _revenue_share := _revenue_share / 100.0;
  END IF;
  _publisher_share := round(_event_cost * _revenue_share, 6);
  _platform_share := round(_event_cost - _publisher_share, 6);

  INSERT INTO public.campaign_spend (
    request_id, campaign_id, ad_id, ad_zone_id, publisher_id, website_id,
    event_type, amount, publisher_amount, platform_amount, revenue_share,
    organization_id, created_at, updated_at
  ) VALUES (
    _request_id, _campaign_id, _ad_id, _ad_zone_id, _publisher_id, _website_id,
    _event_type, _event_cost, _publisher_share, _platform_share, _revenue_share,
    _campaign.organization_id, _now, _now
  ) RETURNING id INTO _spend_id;

  UPDATE public.campaigns
  SET spent_amount = COALESCE(spent_amount, 0) + _event_cost,
      impressions_count = impressions_count + CASE WHEN _event_type = 'impression' THEN 1 ELSE 0 END,
      clicks_count = clicks_count + CASE WHEN _event_type = 'click' THEN 1 ELSE 0 END,
      updated_at = _now
  WHERE id = _campaign_id;

  UPDATE public.wallets
  SET balance_amount = balance_amount - _event_cost,
      lifetime_spent = lifetime_spent + _event_cost,
      updated_at = _now
  WHERE organization_id = _campaign.organization_id
  RETURNING * INTO _wallet;

  INSERT INTO public.wallet_transactions (
    organization_id, wallet_id, type, amount, balance_after, currency,
    description, idempotency_key, reference_type, reference_id, created_at
  ) VALUES (
    _campaign.organization_id, _wallet.id, 'spend', _event_cost,
    _wallet.balance_amount, COALESCE(_wallet.currency, 'KES'),
    'Ad ' || _event_type, 'spend-' || _request_id || '-' || _event_type,
    'campaign', _campaign_id::text, _now
  );

  INSERT INTO public.publisher_earnings (
    organization_id, publisher_id, website_id, ad_zone_id, campaign_id,
    campaign_spend_id, event_type, gross_amount, publisher_amount,
    platform_amount, revenue_share, status, available_at
  )
  SELECT
    p.organization_id, _publisher_id, _website_id, _ad_zone_id, _campaign_id,
    _spend_id, _event_type, _event_cost, _publisher_share, _platform_share,
    _revenue_share, 'pending',
    _now + make_interval(days => COALESCE(_settings.earnings_hold_days, 0))
  FROM public.publishers p
  WHERE p.id = _publisher_id;

  INSERT INTO public.campaign_daily_stats (
    campaign_id, organization_id, date, impressions, clicks, spend,
    created_at, updated_at
  ) VALUES (
    _campaign_id, _campaign.organization_id, _today,
    CASE WHEN _event_type = 'impression' THEN 1 ELSE 0 END,
    CASE WHEN _event_type = 'click' THEN 1 ELSE 0 END,
    _event_cost, _now, _now
  )
  ON CONFLICT (campaign_id, date)
  DO UPDATE SET
    impressions = public.campaign_daily_stats.impressions + CASE WHEN _event_type = 'impression' THEN 1 ELSE 0 END,
    clicks = public.campaign_daily_stats.clicks + CASE WHEN _event_type = 'click' THEN 1 ELSE 0 END,
    spend = public.campaign_daily_stats.spend + _event_cost,
    updated_at = _now;

  RETURN jsonb_build_object('ok', true, 'reason', 'charged', 'amount', _event_cost, 'publisher_amount', _publisher_share, 'platform_amount', _platform_share);
END;
$$;

GRANT EXECUTE ON FUNCTION public.charge_campaign_event(uuid, uuid, uuid, text, uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.charge_campaign_event(uuid, uuid, uuid, text, uuid, text, uuid) TO service_role;
