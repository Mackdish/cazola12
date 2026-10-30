-- Security hardening: money / settings database functions were callable by ANYONE.
--
-- Problem: 21 SECURITY DEFINER functions in the public schema (deposit_to_wallet,
-- refund_campaign_spend, review_payout, request_payout, update_platform_billing_settings,
-- create_payment, get_user_wallets, log_audit_event, ...) were executable by the `anon`
-- role - i.e. by anyone holding the public API key that ships in the website - and most
-- had NO authorization check inside. Row-level security does not help: these functions
-- run with the owner's rights and bypass it.
--
-- Fix, in three parts:
--   1. Functions that legitimate users call get a permission check INSIDE them
--      (caller must belong to the organization / be a platform admin / be the actor).
--      The trusted server (service_role) is always allowed.
--   2. Functions only the server calls become service_role-only.
--   3. Anonymous access to every non-extension function is removed.
--
-- Also fixed while rewriting request_payout: the balance query did not exclude earnings
-- already attached to a pending payout, so requesting twice paid the same earnings twice.

-- ---------------------------------------------------------------------------
-- 1) Guards inside functions that signed-in users legitimately call
-- ---------------------------------------------------------------------------

create or replace function public.request_payout(_organization_id uuid, _method text, _destination text)
 returns payouts
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare _row public.payouts; _available numeric; _minimum numeric; _publisher_id uuid;
begin
  -- Only the trusted server, or a member of THIS organization, may request its payout.
  if coalesce(auth.role(), '') <> 'service_role' then
    if auth.uid() is null or not public.is_org_member(_organization_id, auth.uid()) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  end if;
  if coalesce(btrim(_method), '') = '' or coalesce(btrim(_destination), '') = '' then
    raise exception 'invalid_payout_destination';
  end if;

  -- One payout request per organization at a time (prevents double-claiming under concurrency).
  perform pg_advisory_xact_lock(hashtext('request_payout:' || _organization_id::text));

  perform public.mature_publisher_earnings(_organization_id);
  select id into _publisher_id from public.publishers where organization_id = _organization_id;
  if _publisher_id is null then raise exception 'publisher_not_found'; end if;

  -- payout_id IS NULL: ignore earnings already claimed by an earlier payout request.
  select coalesce(sum(publisher_amount), 0) into _available
  from public.publisher_earnings
  where organization_id = _organization_id and status = 'available' and payout_id is null;

  select minimum_payout_amount into _minimum from public.platform_settings where id limit 1;
  if _available < coalesce(_minimum, 0) or _available <= 0 then
    raise exception 'below_minimum_payout';
  end if;

  insert into public.payouts (organization_id, publisher_id, amount, method, destination, status, requested_by)
  values (_organization_id, _publisher_id, _available, _method, _destination, 'pending', auth.uid())
  returning * into _row;

  update public.publisher_earnings set payout_id = _row.id, updated_at = now()
  where organization_id = _organization_id and status = 'available' and payout_id is null;

  return _row;
end $function$;

create or replace function public.update_platform_billing_settings(
  _publisher_revenue_share numeric, _minimum_payout_amount numeric, _earnings_hold_days integer)
 returns platform_settings
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare _row public.platform_settings;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_platform_admin(auth.uid()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if _publisher_revenue_share is null or _publisher_revenue_share < 0 or _publisher_revenue_share > 1 then
    raise exception 'invalid_revenue_share';
  end if;
  if _minimum_payout_amount is null or _minimum_payout_amount < 0 then
    raise exception 'invalid_minimum_payout';
  end if;
  if _earnings_hold_days is null or _earnings_hold_days < 0 or _earnings_hold_days > 365 then
    raise exception 'invalid_hold_days';
  end if;

  update public.platform_settings
     set publisher_revenue_share = _publisher_revenue_share,
         minimum_payout_amount = _minimum_payout_amount,
         earnings_hold_days = _earnings_hold_days,
         updated_at = now()
   where id
   returning * into _row;
  return _row;
end $function$;

create or replace function public.get_user_wallets(_organization_id uuid)
 returns table(id uuid, currency text, country_code text, balance_amount numeric,
               lifetime_deposited numeric, lifetime_spent numeric)
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select w.id, w.currency, w.country_code, w.balance_amount, w.lifetime_deposited, w.lifetime_spent
  from public.wallets w
  where w.organization_id = _organization_id
    and (
      coalesce(auth.role(), '') = 'service_role'
      or public.is_org_member(_organization_id, auth.uid())
      or public.is_platform_staff(auth.uid())
    )
  order by w.created_at;
$function$;

create or replace function public.create_payment(
  _id uuid, _organization_id uuid, _user_id uuid, _wallet_id uuid,
  _amount numeric default 0, _currency text default null, _provider text default null,
  _reference text default null, _payment_url text default null, _phone_number text default null)
 returns table(id uuid, reference text, payment_url text)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare _row public.payments;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    -- A user may only create a payment for themselves, into a wallet of an organization they belong to.
    if auth.uid() is null
       or _user_id is distinct from auth.uid()
       or not public.is_org_member(_organization_id, auth.uid())
       or not exists (select 1 from public.wallets w where w.id = _wallet_id and w.organization_id = _organization_id) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  end if;

  insert into public.payments (id, organization_id, user_id, wallet_id, amount, currency, provider, reference, payment_url, phone_number, status)
  values (_id, _organization_id, _user_id, _wallet_id, _amount, coalesce(_currency, 'USD'),
          coalesce(_provider, 'manual'), coalesce(_reference, 'pay-' || replace(_id::text, '-', '')),
          _payment_url, _phone_number, 'pending')
  returning * into _row;
  return query select _row.id, _row.reference, _row.payment_url;
end $function$;

create or replace function public.update_payment_details(_id uuid, _provider_reference text, _payment_url text)
 returns table(id uuid, provider_reference text, payment_url text)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare _row public.payments;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if auth.uid() is null or not exists (
      select 1 from public.payments p
      where p.id = _id and (p.user_id = auth.uid() or public.is_org_member(p.organization_id, auth.uid()))
    ) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  end if;

  update public.payments
     set provider_reference = _provider_reference, payment_url = _payment_url, updated_at = now()
   where payments.id = _id
   returning * into _row;
  if _row.id is null then raise exception 'payment_not_found'; end if;
  return query select _row.id, _row.provider_reference, _row.payment_url;
end $function$;

create or replace function public.log_audit_event(
  _actor_id uuid, _actor_email text, _action text, _target_type text, _target_id text,
  _target_label text default null, _metadata jsonb default '{}'::jsonb,
  _ip_address text default null, _user_agent text default null)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  -- Nobody may write audit entries in someone else's name.
  if coalesce(auth.role(), '') <> 'service_role' and _actor_id is distinct from auth.uid() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.audit_logs (actor_id, actor_email, action, target_type, target_id, target_label, metadata, ip_address, user_agent)
  values (_actor_id, _actor_email, _action, _target_type, _target_id, _target_label, coalesce(_metadata, '{}'::jsonb), _ip_address, _user_agent);
end $function$;

create or replace function public.create_organization(_name text, _slug text, _type organization_type)
 returns organizations
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare _row public.organizations; _uid uuid := auth.uid();
begin
  if _uid is null then raise exception 'not_authenticated'; end if;
  -- Self-service signup may only create advertiser / publisher organizations.
  if _type::text not in ('advertiser', 'publisher') then
    raise exception 'forbidden_organization_type' using errcode = '42501';
  end if;
  insert into public.organizations (name, slug, type) values (_name, _slug, _type) returning * into _row;
  insert into public.organization_members (organization_id, user_id, role, status)
  values (_row.id, _uid, 'owner', 'active')
  on conflict (organization_id, user_id) do nothing;
  perform public.ensure_wallet(_row.id);
  return _row;
end $function$;

-- ---------------------------------------------------------------------------
-- 2) Server-only functions: only the trusted server (service_role) may call these
-- ---------------------------------------------------------------------------
do $$
declare
  sig text;
  proc regprocedure;
begin
  foreach sig in array array[
    'public.deposit_to_wallet(uuid, numeric, text, text)',
    'public.refund_campaign_spend(uuid, text)',
    'public.review_payout(uuid, text, text, text)',
    'public.mature_publisher_earnings(uuid)',
    'public.ensure_wallet(uuid)',
    'public.ensure_advertiser(uuid, text, text, text, text)',
    'public.ensure_publisher(uuid, text, text, text, text)',
    'public.mark_payment_failed(uuid, text)',
    'public.mark_onboarding_completed()',
    'public.rls_auto_enable()'
  ] loop
    proc := to_regprocedure(sig);
    if proc is null then
      raise notice 'skipping missing function %', sig;
      continue;
    end if;
    execute format('revoke all on function %s from public, anon, authenticated', proc);
    execute format('grant execute on function %s to service_role', proc);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3) No anonymous access to any non-extension function (the role behind the public API key).
--    Signed-in users and the server keep their explicit grants.
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind in ('f', 'p')
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
      and p.proname not in ('is_org_member', 'is_org_admin', 'is_platform_admin', 'is_platform_staff',
                            'has_org_role', 'has_platform_role')
  loop
    execute format('revoke all on function %s from public, anon', r.sig);
    -- keep the explicit grants that signed-in users and the server rely on
    if r.proname not in ('deposit_to_wallet','refund_campaign_spend','review_payout','mature_publisher_earnings',
                         'ensure_wallet','ensure_advertiser','ensure_publisher','mark_payment_failed',
                         'mark_onboarding_completed','rls_auto_enable') then
      execute format('grant execute on function %s to authenticated, service_role', r.sig);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
