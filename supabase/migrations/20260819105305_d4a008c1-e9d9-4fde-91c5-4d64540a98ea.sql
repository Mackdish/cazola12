SET search_path = public;
ALTER TABLE public.campaign_targeting
  ALTER COLUMN devices DROP DEFAULT,
  ALTER COLUMN devices TYPE device_type[] USING ARRAY[devices],
  ALTER COLUMN devices SET DEFAULT '{}',
  ALTER COLUMN operating_systems DROP DEFAULT,
  ALTER COLUMN operating_systems TYPE os_type[] USING ARRAY[operating_systems],
  ALTER COLUMN operating_systems SET DEFAULT '{}',
  ALTER COLUMN browsers DROP DEFAULT,
  ALTER COLUMN browsers TYPE browser_type[] USING ARRAY[browsers],
  ALTER COLUMN browsers SET DEFAULT '{}',
  ALTER COLUMN website_categories DROP DEFAULT,
  ALTER COLUMN website_categories TYPE website_category[] USING ARRAY[website_categories],
  ALTER COLUMN website_categories SET DEFAULT '{}';
ALTER TABLE public.rate_limits DROP CONSTRAINT rate_limits_bucket_key_action_window_start_key;
ALTER TABLE public.rate_limits ALTER COLUMN window_start DROP DEFAULT;
ALTER TABLE public.rate_limits ALTER COLUMN window_start TYPE timestamptz USING now();
ALTER TABLE public.rate_limits ALTER COLUMN window_start SET DEFAULT now();
ALTER TABLE public.rate_limits ADD CONSTRAINT rate_limits_bucket_action_key UNIQUE (bucket_key, action);
INSERT INTO public.platform_settings (id, currency, publisher_revenue_share, earnings_hold_days, minimum_payout_amount, assumed_ctr, starting_cpc, default_bid_amount, default_total_budget, campaign_minimum_budget, minimum_daily_budget, maximum_daily_budget, maximum_campaign_budget, maximum_bid_amount, maximum_creative_size_bytes, platform_status, supported_currencies, supported_countries)
VALUES (true, 'USD', 0.7, 3, 50, 0.01, 0.25, 2.5, 100, 50, 5, 10000, 1000000, 50, 5242880, 'operational', '{USD}', '{US}');
CREATE OR REPLACE FUNCTION public.is_platform_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_roles WHERE user_id = _user_id);
$$;
CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_roles
    WHERE user_id = _user_id AND role IN ('super_admin','admin')
  );
$$;
CREATE OR REPLACE FUNCTION public.is_org_member(_organization_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _organization_id AND user_id = _user_id AND status = 'active'
  );
$$;
CREATE OR REPLACE FUNCTION public.is_org_admin(_organization_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _organization_id AND user_id = _user_id
      AND status = 'active' AND role IN ('owner','admin')
  );
$$;
CREATE OR REPLACE FUNCTION public.generate_zone_key()
RETURNS text LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT 'zn_' || substr(md5(random()::text || clock_timestamp()::text), 1, 20);
$$;
CREATE OR REPLACE FUNCTION public.ensure_profile(_full_name text DEFAULT NULL)
RETURNS public.profiles LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE _row public.profiles; _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  INSERT INTO public.profiles (id, full_name)
  VALUES (_uid, _full_name)
  ON CONFLICT (id) DO UPDATE
    SET full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        updated_at = now()
  RETURNING * INTO _row;
  RETURN _row;
END $$;
CREATE OR REPLACE FUNCTION public.ensure_wallet(_organization_id uuid)
RETURNS public.wallets LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE _row public.wallets; _cur text;
BEGIN
  SELECT currency INTO _cur FROM public.platform_settings WHERE id LIMIT 1;
  _cur := COALESCE(_cur, 'USD');
  SELECT * INTO _row FROM public.wallets
    WHERE organization_id = _organization_id ORDER BY created_at LIMIT 1;
  IF _row.id IS NULL THEN
    INSERT INTO public.wallets (organization_id, currency)
    VALUES (_organization_id, _cur)
    ON CONFLICT (organization_id, currency) DO UPDATE SET updated_at = now()
    RETURNING * INTO _row;
  END IF;
  RETURN _row;
END $$;
CREATE OR REPLACE FUNCTION public.create_organization(
  _name text, _slug text, _type public.organization_type
) RETURNS public.organizations
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE _row public.organizations; _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  INSERT INTO public.organizations (name, slug, type) VALUES (_name, _slug, _type)
  RETURNING * INTO _row;
  INSERT INTO public.organization_members (organization_id, user_id, role, status)
  VALUES (_row.id, _uid, 'owner', 'active')
  ON CONFLICT (organization_id, user_id) DO NOTHING;
  PERFORM public.ensure_wallet(_row.id);
  RETURN _row;
END $$;
CREATE OR REPLACE FUNCTION public.ensure_advertiser(
  _organization_id uuid, _business_name text, _contact_email text,
  _contact_phone text DEFAULT NULL, _industry text DEFAULT NULL
) RETURNS public.advertisers
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE _row public.advertisers;
BEGIN
  INSERT INTO public.advertisers (organization_id, business_name, contact_email, contact_phone, industry)
  VALUES (_organization_id, _business_name, _contact_email, _contact_phone, _industry)
  ON CONFLICT (organization_id) DO UPDATE SET
    business_name = EXCLUDED.business_name,
    contact_email = EXCLUDED.contact_email,
    contact_phone = COALESCE(EXCLUDED.contact_phone, public.advertisers.contact_phone),
    industry = COALESCE(EXCLUDED.industry, public.advertisers.industry),
    updated_at = now()
  RETURNING * INTO _row;
  PERFORM public.ensure_wallet(_organization_id);
  RETURN _row;
END $$;
CREATE OR REPLACE FUNCTION public.ensure_publisher(
  _organization_id uuid, _business_name text, _contact_email text,
  _contact_phone text DEFAULT NULL, _website_url text DEFAULT NULL
) RETURNS public.publishers
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE _row public.publishers;
BEGIN
  INSERT INTO public.publishers (organization_id, business_name, contact_email, contact_phone, website_url)
  VALUES (_organization_id, _business_name, _contact_email, _contact_phone, _website_url)
  ON CONFLICT (organization_id) DO UPDATE SET
    business_name = EXCLUDED.business_name,
    contact_email = EXCLUDED.contact_email,
    contact_phone = COALESCE(EXCLUDED.contact_phone, public.publishers.contact_phone),
    website_url = COALESCE(EXCLUDED.website_url, public.publishers.website_url),
    updated_at = now()
  RETURNING * INTO _row;
  RETURN _row;
END $$;
CREATE OR REPLACE FUNCTION public.ensure_wallet_for_currency(
  _organization_id uuid, _currency text DEFAULT NULL, _country_code text DEFAULT NULL
) RETURNS SETOF public.wallets
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE _cur text; _country text;
BEGIN
  SELECT currency INTO _cur FROM public.platform_settings WHERE id LIMIT 1;
  _cur := COALESCE(_currency, _cur, 'USD');
  _country := COALESCE(_country_code, (
    SELECT country_code FROM public.supported_currencies WHERE currency_code = _cur AND active LIMIT 1
  ), '');
  RETURN QUERY
  INSERT INTO public.wallets (organization_id, currency, country_code)
  VALUES (_organization_id, _cur, _country)
  ON CONFLICT (organization_id, currency) DO UPDATE SET updated_at = now()
  RETURNING *;
END $$;
CREATE OR REPLACE FUNCTION public.get_user_wallets(_organization_id uuid)
RETURNS TABLE (
  id uuid, currency text, country_code text,
  balance_amount numeric, lifetime_deposited numeric, lifetime_spent numeric
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT w.id, w.currency, w.country_code, w.balance_amount, w.lifetime_deposited, w.lifetime_spent
  FROM public.wallets w
  WHERE w.organization_id = _organization_id
  ORDER BY w.created_at;
$$;
CREATE OR REPLACE FUNCTION public.deposit_to_wallet(
  _organization_id uuid, _amount numeric, _idempotency_key text, _description text DEFAULT NULL
) RETURNS public.wallets
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE _wallet public.wallets;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  IF _idempotency_key IS NULL OR length(_idempotency_key) < 8 THEN RAISE EXCEPTION 'missing_idempotency_key'; END IF;
  _wallet := public.ensure_wallet(_organization_id);
  SELECT * INTO _wallet FROM public.wallets WHERE id = _wallet.id FOR UPDATE;
  IF EXISTS (
    SELECT 1 FROM public.wallet_transactions
    WHERE organization_id = _organization_id AND idempotency_key = _idempotency_key
  ) THEN
    RETURN _wallet;
  END IF;
  UPDATE public.wallets SET
    balance_amount = balance_amount + _amount,
    lifetime_deposited = lifetime_deposited + _amount,
    updated_at = now()
  WHERE id = _wallet.id RETURNING * INTO _wallet;
  INSERT INTO public.wallet_transactions
    (organization_id, wallet_id, type, amount, balance_after, currency, description, idempotency_key, created_by)
  VALUES
    (_organization_id, _wallet.id, 'deposit', _amount, _wallet.balance_amount, _wallet.currency,
     _description, _idempotency_key, auth.uid());
  RETURN _wallet;
END $$;
CREATE OR REPLACE FUNCTION public.deposit_to_wallet_for_currency(
  _organization_id uuid, _amount numeric, _currency text DEFAULT NULL,
  _description text DEFAULT NULL, _idempotency_key text DEFAULT NULL
) RETURNS TABLE (ok boolean, duplicate boolean, balance numeric, currency text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE _wallet public.wallets; _key text; _dup boolean := false;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  _key := COALESCE(_idempotency_key, 'dep-' || gen_random_uuid()::text);
  SELECT * INTO _wallet FROM public.ensure_wallet_for_currency(_organization_id, _currency, NULL);
  SELECT * INTO _wallet FROM public.wallets WHERE id = _wallet.id FOR UPDATE;
  IF EXISTS (
    SELECT 1 FROM public.wallet_transactions
    WHERE organization_id = _organization_id AND idempotency_key = _key
  ) THEN
    _dup := true;
  ELSE
    UPDATE public.wallets SET
      balance_amount = balance_amount + _amount,
      lifetime_deposited = lifetime_deposited + _amount,
      updated_at = now()
    WHERE id = _wallet.id RETURNING * INTO _wallet;
    INSERT INTO public.wallet_transactions
      (organization_id, wallet_id, type, amount, balance_after, currency, description, idempotency_key, created_by)
    VALUES
      (_organization_id, _wallet.id, 'deposit', _amount, _wallet.balance_amount, _wallet.currency,
       _description, _key, auth.uid());
  END IF;
  RETURN QUERY SELECT true, _dup, _wallet.balance_amount, _wallet.currency;
END $$;
CREATE OR REPLACE FUNCTION public.charge_campaign_event(
  _event_type public.billing_event_type,
  _request_id text,
  _campaign_id uuid,
  _ad_id uuid,
  _publisher_id uuid,
  _website_id uuid,
  _ad_zone_id uuid
) RETURNS json LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _campaign public.campaigns;
  _wallet public.wallets;
  _settings public.platform_settings;
  _amount numeric := 0;
  _share numeric;
  _publisher_amount numeric;
  _platform_amount numeric;
  _spend_id uuid;
BEGIN
  SELECT * INTO _settings FROM public.platform_settings WHERE id LIMIT 1;
  IF EXISTS (
    SELECT 1 FROM public.campaign_spend
    WHERE request_id = _request_id AND event_type = _event_type
  ) THEN
    RETURN json_build_object('ok', false, 'reason', 'duplicate', 'amount', 0,
                             'publisher_amount', 0, 'platform_amount', 0);
  END IF;
  SELECT * INTO _campaign FROM public.campaigns WHERE id = _campaign_id FOR UPDATE;
  IF _campaign.id IS NULL THEN
    RETURN json_build_object('ok', false, 'reason', 'not_found', 'amount', 0,
                             'publisher_amount', 0, 'platform_amount', 0);
  END IF;
  IF _campaign.status <> 'active' OR _campaign.approval_status <> 'approved' THEN
    RETURN json_build_object('ok', false, 'reason', 'inactive', 'amount', 0,
                             'publisher_amount', 0, 'platform_amount', 0);
  END IF;
  IF _campaign.bid_type = 'cpm' THEN
    IF _event_type <> 'impression' THEN
      RETURN json_build_object('ok', false, 'reason', 'not_billable', 'amount', 0,
                               'publisher_amount', 0, 'platform_amount', 0);
    END IF;
    _amount := _campaign.bid_amount / 1000.0;
  ELSE
    IF _event_type <> 'click' THEN
      RETURN json_build_object('ok', false, 'reason', 'not_billable', 'amount', 0,
                               'publisher_amount', 0, 'platform_amount', 0);
    END IF;
    _amount := _campaign.bid_amount;
  END IF;
  _amount := round(_amount, 6);
  IF _amount <= 0 THEN
    RETURN json_build_object('ok', false, 'reason', 'not_billable', 'amount', 0,
                             'publisher_amount', 0, 'platform_amount', 0);
  END IF;
  IF _campaign.total_budget > 0 AND _campaign.spent_amount + _amount > _campaign.total_budget THEN
    UPDATE public.campaigns SET status = 'paused', updated_at = now() WHERE id = _campaign.id;
    RETURN json_build_object('ok', false, 'reason', 'budget_exhausted', 'amount', 0,
                             'publisher_amount', 0, 'platform_amount', 0);
  END IF;
  SELECT * INTO _wallet FROM public.wallets
    WHERE organization_id = _campaign.organization_id ORDER BY created_at LIMIT 1 FOR UPDATE;
  IF _wallet.id IS NULL OR _wallet.balance_amount < _amount THEN
    RETURN json_build_object('ok', false, 'reason', 'insufficient_funds', 'amount', 0,
                             'publisher_amount', 0, 'platform_amount', 0);
  END IF;
  _share := COALESCE(_settings.publisher_revenue_share, 0.7);
  IF _share > 1 THEN _share := _share / 100.0; END IF;
  _publisher_amount := round(_amount * _share, 6);
  _platform_amount := round(_amount - _publisher_amount, 6);
  UPDATE public.wallets SET
    balance_amount = balance_amount - _amount,
    lifetime_spent = lifetime_spent + _amount,
    updated_at = now()
  WHERE id = _wallet.id RETURNING * INTO _wallet;
  INSERT INTO public.wallet_transactions
    (organization_id, wallet_id, type, amount, balance_after, currency, description, idempotency_key, reference_type, reference_id)
  VALUES
    (_campaign.organization_id, _wallet.id, 'spend', -_amount, _wallet.balance_amount, _wallet.currency,
     'Ad ' || _event_type::text, 'spend-' || _request_id || '-' || _event_type::text, 'campaign', _campaign.id::text);
  INSERT INTO public.campaign_spend
    (organization_id, campaign_id, ad_id, ad_zone_id, website_id, publisher_id,
     event_type, request_id, amount, publisher_amount, platform_amount, revenue_share)
  VALUES
    (_campaign.organization_id, _campaign.id, _ad_id, _ad_zone_id, _website_id, _publisher_id,
     _event_type, _request_id, _amount, _publisher_amount, _platform_amount, _share)
  RETURNING id INTO _spend_id;
  UPDATE public.campaigns SET
    spent_amount = spent_amount + _amount,
    impressions_count = impressions_count + (CASE WHEN _event_type = 'impression' THEN 1 ELSE 0 END),
    clicks_count = clicks_count + (CASE WHEN _event_type = 'click' THEN 1 ELSE 0 END),
    updated_at = now()
  WHERE id = _campaign.id;
  INSERT INTO public.publisher_earnings
    (organization_id, publisher_id, website_id, ad_zone_id, campaign_id, campaign_spend_id,
     event_type, gross_amount, publisher_amount, platform_amount, revenue_share, status, available_at)
  SELECT
    p.organization_id, _publisher_id, _website_id, _ad_zone_id, _campaign.id, _spend_id,
    _event_type, _amount, _publisher_amount, _platform_amount, _share, 'pending',
    now() + make_interval(days => COALESCE(_settings.earnings_hold_days, 0))
  FROM public.publishers p WHERE p.id = _publisher_id;
  RETURN json_build_object('ok', true, 'reason', 'charged', 'amount', _amount,
                           'publisher_amount', _publisher_amount, 'platform_amount', _platform_amount);
END $$;
CREATE OR REPLACE FUNCTION public.refund_campaign_spend(
  _campaign_spend_id uuid, _reason text DEFAULT NULL
) RETURNS json LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE _spend public.campaign_spend; _wallet public.wallets; _key text;
BEGIN
  SELECT * INTO _spend FROM public.campaign_spend WHERE id = _campaign_spend_id FOR UPDATE;
  IF _spend.id IS NULL THEN RAISE EXCEPTION 'spend_not_found'; END IF;
  _key := 'refund-' || _spend.id::text;
  IF EXISTS (
    SELECT 1 FROM public.wallet_transactions
    WHERE organization_id = _spend.organization_id AND idempotency_key = _key
  ) THEN
    RETURN json_build_object('ok', true, 'duplicate', true, 'amount', _spend.amount);
  END IF;
  SELECT * INTO _wallet FROM public.wallets
    WHERE organization_id = _spend.organization_id ORDER BY created_at LIMIT 1 FOR UPDATE;
  IF _wallet.id IS NULL THEN RAISE EXCEPTION 'wallet_not_found'; END IF;
  UPDATE public.wallets SET
    balance_amount = balance_amount + _spend.amount,
    lifetime_spent = greatest(lifetime_spent - _spend.amount, 0),
    updated_at = now()
  WHERE id = _wallet.id RETURNING * INTO _wallet;
  INSERT INTO public.wallet_transactions
    (organization_id, wallet_id, type, amount, balance_after, currency, description, idempotency_key, reference_type, reference_id)
  VALUES
    (_spend.organization_id, _wallet.id, 'refund', _spend.amount, _wallet.balance_amount, _wallet.currency,
     COALESCE(_reason, 'Refund'), _key, 'campaign_spend', _spend.id::text);
  UPDATE public.campaigns SET
    spent_amount = greatest(spent_amount - _spend.amount, 0), updated_at = now()
  WHERE id = _spend.campaign_id;
  UPDATE public.publisher_earnings SET status = 'reversed', updated_at = now()
  WHERE campaign_spend_id = _spend.id AND status IN ('pending','available');
  RETURN json_build_object('ok', true, 'duplicate', false, 'amount', _spend.amount);
END $$;
CREATE OR REPLACE FUNCTION public.mature_publisher_earnings(_organization_id uuid DEFAULT NULL)
RETURNS void LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.publisher_earnings SET status = 'available', updated_at = now()
  WHERE status = 'pending' AND available_at <= now()
    AND (_organization_id IS NULL OR organization_id = _organization_id);
$$;
CREATE OR REPLACE FUNCTION public.request_payout(
  _organization_id uuid, _method text, _destination text
) RETURNS public.payouts
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE _row public.payouts; _available numeric; _minimum numeric; _publisher_id uuid;
BEGIN
  PERFORM public.mature_publisher_earnings(_organization_id);
  SELECT id INTO _publisher_id FROM public.publishers WHERE organization_id = _organization_id;
  IF _publisher_id IS NULL THEN RAISE EXCEPTION 'publisher_not_found'; END IF;
  SELECT COALESCE(sum(publisher_amount), 0) INTO _available
  FROM public.publisher_earnings
  WHERE organization_id = _organization_id AND status = 'available';
  SELECT minimum_payout_amount INTO _minimum FROM public.platform_settings WHERE id LIMIT 1;
  IF _available < COALESCE(_minimum, 0) OR _available <= 0 THEN
    RAISE EXCEPTION 'below_minimum_payout';
  END IF;
  INSERT INTO public.payouts (organization_id, publisher_id, amount, method, destination, status, requested_by)
  VALUES (_organization_id, _publisher_id, _available, _method, _destination, 'pending', auth.uid())
  RETURNING * INTO _row;
  UPDATE public.publisher_earnings SET payout_id = _row.id, updated_at = now()
  WHERE organization_id = _organization_id AND status = 'available' AND payout_id IS NULL;
  RETURN _row;
END $$;
CREATE OR REPLACE FUNCTION public.review_payout(
  _payout_id uuid, _status text, _reason text DEFAULT NULL, _payment_reference text DEFAULT NULL
) RETURNS public.payouts
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE _row public.payouts;
BEGIN
  IF _status NOT IN ('approved','paid','rejected') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  UPDATE public.payouts SET
    status = _status::public.payout_status,
    rejection_reason = CASE WHEN _status = 'rejected' THEN _reason ELSE rejection_reason END,
    payment_reference = COALESCE(_payment_reference, payment_reference),
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    paid_at = CASE WHEN _status = 'paid' THEN now() ELSE paid_at END,
    updated_at = now()
  WHERE id = _payout_id
  RETURNING * INTO _row;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'payout_not_found'; END IF;
  IF _status = 'paid' THEN
    UPDATE public.publisher_earnings SET status = 'paid', paid_at = now(), updated_at = now()
    WHERE payout_id = _row.id;
  ELSIF _status = 'rejected' THEN
    UPDATE public.publisher_earnings SET payout_id = NULL, updated_at = now()
    WHERE payout_id = _row.id;
  END IF;
  RETURN _row;
END $$;
CREATE OR REPLACE FUNCTION public.update_platform_billing_settings(
  _publisher_revenue_share numeric, _minimum_payout_amount numeric, _earnings_hold_days integer
) RETURNS public.platform_settings
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE _row public.platform_settings;
BEGIN
  UPDATE public.platform_settings SET
    publisher_revenue_share = _publisher_revenue_share,
    minimum_payout_amount = _minimum_payout_amount,
    earnings_hold_days = _earnings_hold_days,
    updated_at = now()
  WHERE id
  RETURNING * INTO _row;
  RETURN _row;
END $$;
CREATE OR REPLACE FUNCTION public.get_supported_payment_methods(_country_code text, _currency text)
RETURNS TABLE (
  id uuid, name text, display_name text, description text, icon_url text,
  minimum_amount numeric, maximum_amount numeric, provider_id uuid, provider_name text
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id, m.name, m.display_name, m.description, m.icon_url,
         m.minimum_amount, m.maximum_amount, m.provider_id, p.name
  FROM public.payment_methods m
  JOIN public.payment_providers p ON p.id = m.provider_id
  WHERE m.active AND p.active
    AND m.country_code = _country_code
    AND m.currency_code = _currency
  ORDER BY m.display_name;
$$;
CREATE OR REPLACE FUNCTION public.create_payment(
  _id uuid, _organization_id uuid, _user_id uuid, _wallet_id uuid,
  _amount numeric DEFAULT 0, _currency text DEFAULT NULL, _provider text DEFAULT NULL,
  _reference text DEFAULT NULL, _payment_url text DEFAULT NULL, _phone_number text DEFAULT NULL
) RETURNS TABLE (id uuid, reference text, payment_url text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE _row public.payments;
BEGIN
  INSERT INTO public.payments
    (id, organization_id, user_id, wallet_id, amount, currency, provider, reference, payment_url, phone_number, status)
  VALUES
    (_id, _organization_id, _user_id, _wallet_id, _amount,
     COALESCE(_currency, 'USD'), COALESCE(_provider, 'manual'),
     COALESCE(_reference, 'pay-' || replace(_id::text, '-', '')),
     _payment_url, _phone_number, 'pending')
  RETURNING * INTO _row;
  RETURN QUERY SELECT _row.id, _row.reference, _row.payment_url;
END $$;
CREATE OR REPLACE FUNCTION public.update_payment_details(
  _id uuid, _provider_reference text, _payment_url text
) RETURNS TABLE (id uuid, provider_reference text, payment_url text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE _row public.payments;
BEGIN
  UPDATE public.payments SET
    provider_reference = _provider_reference,
    payment_url = _payment_url,
    updated_at = now()
  WHERE payments.id = _id RETURNING * INTO _row;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'payment_not_found'; END IF;
  RETURN QUERY SELECT _row.id, _row.provider_reference, _row.payment_url;
END $$;
CREATE OR REPLACE FUNCTION public.complete_payment(
  _payment_id uuid, _provider text DEFAULT NULL, _provider_transaction_id text DEFAULT NULL,
  _provider_reference text DEFAULT NULL, _provider_receipt text DEFAULT NULL
) RETURNS TABLE (payment_id uuid, status text, wallet_balance numeric)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE _row public.payments; _wallet public.wallets;
BEGIN
  SELECT * INTO _row FROM public.payments WHERE id = _payment_id FOR UPDATE;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'payment_not_found'; END IF;
  IF _row.status = 'completed' THEN
    SELECT * INTO _wallet FROM public.wallets WHERE id = _row.wallet_id;
    RETURN QUERY SELECT _row.id, _row.status, COALESCE(_wallet.balance_amount, 0);
    RETURN;
  END IF;
  UPDATE public.payments SET
    status = 'completed',
    provider = COALESCE(_provider, provider),
    provider_transaction_id = COALESCE(_provider_transaction_id, provider_transaction_id),
    provider_reference = COALESCE(_provider_reference, provider_reference),
    provider_receipt = COALESCE(_provider_receipt, provider_receipt),
    completed_at = now(), verified_at = now(), updated_at = now()
  WHERE id = _payment_id RETURNING * INTO _row;
  PERFORM public.deposit_to_wallet_for_currency(
    _row.organization_id, _row.amount, _row.currency,
    'Deposit ' || _row.reference, 'payment-' || _row.id::text
  );
  SELECT * INTO _wallet FROM public.wallets WHERE id = _row.wallet_id;
  RETURN QUERY SELECT _row.id, _row.status, COALESCE(_wallet.balance_amount, 0);
END $$;
CREATE OR REPLACE FUNCTION public.fail_payment(
  _payment_id uuid, _provider text DEFAULT NULL, _failure_reason text DEFAULT NULL
) RETURNS TABLE (payment_id uuid, status text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE _row public.payments;
BEGIN
  UPDATE public.payments SET
    status = 'failed',
    provider = COALESCE(_provider, provider),
    failure_reason = COALESCE(_failure_reason, failure_reason),
    failed_at = now(), updated_at = now()
  WHERE id = _payment_id AND status <> 'completed'
  RETURNING * INTO _row;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'payment_not_updatable'; END IF;
  RETURN QUERY SELECT _row.id, _row.status;
END $$;
CREATE OR REPLACE FUNCTION public.mark_payment_failed(
  _id uuid, _failure_reason text DEFAULT NULL
) RETURNS TABLE (payment_id uuid, status text)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.fail_payment(_id, NULL, _failure_reason);
$$;
CREATE OR REPLACE FUNCTION public.cancel_payment(
  _payment_id uuid, _provider text DEFAULT NULL
) RETURNS TABLE (payment_id uuid, status text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE _row public.payments;
BEGIN
  UPDATE public.payments SET
    status = 'cancelled',
    provider = COALESCE(_provider, provider),
    updated_at = now()
  WHERE id = _payment_id AND status = 'pending'
  RETURNING * INTO _row;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'payment_not_cancellable'; END IF;
  RETURN QUERY SELECT _row.id, _row.status;
END $$;
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _key text, _action text, _limit integer, _window_seconds integer,
  _ip_address text, _user_id uuid DEFAULT NULL, _organization_id uuid DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE _row public.rate_limits; _bucket text;
BEGIN
  _bucket := _key || ':' || COALESCE(_ip_address, '') || ':' ||
             COALESCE(_user_id::text, '') || ':' || COALESCE(_organization_id::text, '');
  INSERT INTO public.rate_limits (bucket_key, action, request_count, window_start)
  VALUES (_bucket, _action, 1, now())
  ON CONFLICT (bucket_key, action) DO UPDATE SET
    request_count = CASE
      WHEN public.rate_limits.window_start < now() - make_interval(secs => _window_seconds) THEN 1
      ELSE public.rate_limits.request_count + 1 END,
    window_start = CASE
      WHEN public.rate_limits.window_start < now() - make_interval(secs => _window_seconds) THEN now()
      ELSE public.rate_limits.window_start END,
    updated_at = now()
  RETURNING * INTO _row;
  RETURN _row.request_count <= _limit;
END $$;
CREATE OR REPLACE FUNCTION public.log_audit_event(
  _actor_id uuid, _actor_email text, _action text, _target_type text, _target_id text,
  _target_label text DEFAULT NULL, _metadata jsonb DEFAULT '{}'::jsonb,
  _ip_address text DEFAULT NULL, _user_agent text DEFAULT NULL
) RETURNS void LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.audit_logs
    (actor_id, actor_email, action, target_type, target_id, target_label, metadata, ip_address, user_agent)
  VALUES
    (_actor_id, _actor_email, _action, _target_type, _target_id, _target_label,
     COALESCE(_metadata, '{}'::jsonb), _ip_address, _user_agent);
$$;