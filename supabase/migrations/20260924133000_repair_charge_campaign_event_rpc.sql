-- Atomic billing RPC: charge_campaign_event
--
-- Replaces both existing overloads with a single atomic implementation that:
-- 1. Checks for duplicate request_id + event_type (idempotency)
-- 2. Locks the campaign row (SELECT ... FOR UPDATE)
-- 3. Checks budget exhaustion (total and daily)
-- 4. Locks the wallet row (SELECT ... FOR UPDATE)
-- 5. Checks sufficient funds
-- 6. Inserts campaign_spend, wallet_transactions, publisher_earnings
-- 7. Atomically updates spent_amount, balance_amount, lifetime_spent
-- 8. Updates campaign_daily_stats for pacing
-- 9. Returns structured jsonb result
--
-- The entire operation runs in a single transaction with row-level locks,
-- so concurrent calls serialize and cannot overspend.

-- Drop both old overloads first to avoid "more than one function" error
DROP FUNCTION IF EXISTS public.charge_campaign_event(_event_type billing_event_type, _request_id text, _campaign_id uuid, _ad_id uuid, _publisher_id uuid, _website_id uuid, _ad_zone_id uuid);
DROP FUNCTION IF EXISTS public.charge_campaign_event(_campaign_id uuid, _ad_id uuid, _ad_zone_id uuid, _event_type text, _publisher_id uuid, _request_id uuid, _website_id uuid);

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
AS $$
DECLARE
  _campaign record;
  _wallet record;
  _settings record;
  _event_cost numeric(14,4);
  _publisher_share numeric(14,4);
  _platform_share numeric(14,4);
  _revenue_share numeric;
  _daily_stats record;
  _today date := CURRENT_DATE;
  _now timestamptz := now();
  _spend_id uuid;
BEGIN
  -- Validate event type
  IF _event_type NOT IN ('impression', 'click') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'invalid_request',
      'amount', 0,
      'publisher_amount', 0,
      'platform_amount', 0
    );
  END IF;

  -- Load platform settings
  SELECT * INTO _settings FROM public.platform_settings WHERE id LIMIT 1;

  -- Idempotency: reject duplicate request_id + event_type
  IF EXISTS (
    SELECT 1 FROM public.campaign_spend
    WHERE request_id = _request_id AND event_type = _event_type
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'duplicate',
      'amount', 0,
      'publisher_amount', 0,
      'platform_amount', 0
    );
  END IF;

  -- Lock and fetch campaign
  SELECT * INTO _campaign
  FROM public.campaigns
  WHERE id = _campaign_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'unknown_campaign',
      'amount', 0,
      'publisher_amount', 0,
      'platform_amount', 0
    );
  END IF;

  -- Check campaign status
  IF _campaign.status NOT IN ('active', 'approved') OR _campaign.approval_status <> 'approved' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'campaign_inactive',
      'amount', 0,
      'publisher_amount', 0,
      'platform_amount', 0
    );
  END IF;

  -- Check total budget exhaustion
  IF COALESCE(_campaign.spent_amount, 0) >= COALESCE(_campaign.total_budget, 0) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'budget_exhausted',
      'amount', 0,
      'publisher_amount', 0,
      'platform_amount', 0
    );
  END IF;

  -- Calculate event cost
  IF _event_type = 'click' AND _campaign.bid_type = 'cpc' THEN
    _event_cost := _campaign.bid_amount;
  ELSIF _event_type = 'impression' AND _campaign.bid_type = 'cpm' THEN
    _event_cost := _campaign.bid_amount / 1000.0;
  ELSE
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'not_billable',
      'amount', 0,
      'publisher_amount', 0,
      'platform_amount', 0
    );
  END IF;

  _event_cost := round(_event_cost, 6);
  IF _event_cost <= 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'not_billable',
      'amount', 0,
      'publisher_amount', 0,
      'platform_amount', 0
    );
  END IF;

  -- Check if this event would exceed total budget
  IF COALESCE(_campaign.spent_amount, 0) + _event_cost > COALESCE(_campaign.total_budget, 0) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'budget_exhausted',
      'amount', 0,
      'publisher_amount', 0,
      'platform_amount', 0
    );
  END IF;

  -- Check daily budget pacing
  IF _campaign.daily_budget IS NOT NULL AND _campaign.daily_budget > 0 THEN
    PERFORM pg_advisory_xact_lock(hashtext(_campaign_id::text || _today::text));

    SELECT * INTO _daily_stats
    FROM public.campaign_daily_stats
    WHERE campaign_id = _campaign_id AND date = _today
    FOR UPDATE;

    IF FOUND AND COALESCE(_daily_stats.spend, 0) + _event_cost > _campaign.daily_budget THEN
      RETURN jsonb_build_object(
        'ok', false,
        'reason', 'daily_budget_exhausted',
        'amount', 0,
        'publisher_amount', 0,
        'platform_amount', 0
      );
    END IF;
  END IF;

  -- Lock and fetch wallet
  SELECT * INTO _wallet
  FROM public.wallets
  WHERE organization_id = _campaign.organization_id
    AND currency = 'KES'
  ORDER BY id
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'no_wallet',
      'amount', 0,
      'publisher_amount', 0,
      'platform_amount', 0
    );
  END IF;

  -- Check sufficient funds
  IF COALESCE(_wallet.balance_amount, 0) < _event_cost THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'insufficient_funds',
      'amount', 0,
      'publisher_amount', 0,
      'platform_amount', 0
    );
  END IF;

  -- Calculate revenue split from platform settings
  _revenue_share := COALESCE(_settings.publisher_revenue_share, 0.7);
  IF _revenue_share > 1 THEN
    _revenue_share := _revenue_share / 100.0;
  END IF;
  _publisher_share := round(_event_cost * _revenue_share, 6);
  _platform_share := round(_event_cost - _publisher_share, 6);

  -- Insert billing event
  INSERT INTO public.campaign_spend (
    request_id,
    campaign_id,
    ad_id,
    ad_zone_id,
    publisher_id,
    website_id,
    event_type,
    amount,
    publisher_amount,
    platform_amount,
    revenue_share,
    organization_id,
    created_at,
    updated_at
  ) VALUES (
    _request_id,
    _campaign_id,
    _ad_id,
    _ad_zone_id,
    _publisher_id,
    _website_id,
    _event_type,
    _event_cost,
    _publisher_share,
    _platform_share,
    _revenue_share,
    _campaign.organization_id,
    _now,
    _now
  ) RETURNING id INTO _spend_id;

  -- Atomically update campaign spent_amount
  UPDATE public.campaigns
  SET spent_amount = COALESCE(spent_amount, 0) + _event_cost,
      impressions_count = impressions_count + (CASE WHEN _event_type = 'impression' THEN 1 ELSE 0 END),
      clicks_count = clicks_count + (CASE WHEN _event_type = 'click' THEN 1 ELSE 0 END),
      updated_at = _now
  WHERE id = _campaign_id;

  -- Atomically update wallet balance
  UPDATE public.wallets
  SET balance_amount = balance_amount - _event_cost,
      lifetime_spent = lifetime_spent + _event_cost,
      updated_at = _now
  WHERE organization_id = _campaign.organization_id
    AND currency = 'KES'
  RETURNING * INTO _wallet;

  -- Insert wallet transaction for audit trail
  INSERT INTO public.wallet_transactions (
    organization_id,
    wallet_id,
    type,
    amount,
    balance_after,
    currency,
    description,
    idempotency_key,
    reference_type,
    reference_id,
    created_at
  ) VALUES (
    _campaign.organization_id,
    _wallet.id,
    'spend',
    _event_cost,
    _wallet.balance_amount,
    COALESCE(_wallet.currency, 'KES'),
    'Ad ' || _event_type,
    'spend-' || _request_id || '-' || _event_type,
    'campaign',
    _campaign_id::text,
    _now
  );

  -- Insert publisher earnings
  INSERT INTO public.publisher_earnings (
    organization_id,
    publisher_id,
    website_id,
    ad_zone_id,
    campaign_id,
    campaign_spend_id,
    event_type,
    gross_amount,
    publisher_amount,
    platform_amount,
    revenue_share,
    status,
    available_at
  )
  SELECT
    p.organization_id,
    _publisher_id,
    _website_id,
    _ad_zone_id,
    _campaign_id,
    _spend_id,
    _event_type,
    _event_cost,
    _publisher_share,
    _platform_share,
    _revenue_share,
    'pending',
    _now + make_interval(days => COALESCE(_settings.earnings_hold_days, 0))
  FROM public.publishers p
  WHERE p.id = _publisher_id;

  -- Update daily stats for pacing
  INSERT INTO public.campaign_daily_stats (
    campaign_id,
    organization_id,
    date,
    impressions,
    clicks,
    spend,
    created_at,
    updated_at
  ) VALUES (
    _campaign_id,
    _campaign.organization_id,
    _today,
    CASE WHEN _event_type = 'impression' THEN 1 ELSE 0 END,
    CASE WHEN _event_type = 'click' THEN 1 ELSE 0 END,
    _event_cost,
    _now,
    _now
  )
  ON CONFLICT (campaign_id, date)
  DO UPDATE SET
    impressions = campaign_daily_stats.impressions + CASE WHEN _event_type = 'impression' THEN 1 ELSE 0 END,
    clicks = campaign_daily_stats.clicks + CASE WHEN _event_type = 'click' THEN 1 ELSE 0 END,
    spend = campaign_daily_stats.spend + _event_cost,
    updated_at = _now;

  RETURN jsonb_build_object(
    'ok', true,
    'reason', 'charged',
    'amount', _event_cost,
    'publisher_amount', _publisher_share,
    'platform_amount', _platform_share
  );
END;
$$;

-- Grant execute to authenticated and service_role
GRANT EXECUTE ON FUNCTION public.charge_campaign_event(uuid, uuid, uuid, text, uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.charge_campaign_event(uuid, uuid, uuid, text, uuid, text, uuid) TO service_role;
