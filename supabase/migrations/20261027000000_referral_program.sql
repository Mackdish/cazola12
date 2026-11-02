-- Referral program.
--
--  * Every advertiser / publisher organization gets a referral code.
--  * A new user who signs up with a code is "referred". The referrer earns a % of
--    TradeMall's own revenue (platform_amount) from the referred user's activity
--    (their ad spend, or the revenue their sites generate), for a limited window.
--    Basing it on platform revenue means the program can never cost more than it earns.
--  * Commissions accrue immediately but stay `pending` until (a) the referred user
--    reaches a spend/earnings milestone and (b) the source earning's hold period ends.
--  * Advertiser referrers are paid as ad credit in their KES wallet (batched, not one
--    ledger entry per click, and NOT counted as a deposit). Publisher referrers are paid
--    in cash through the normal payout flow (see request_payout / review_payout).
--  * Ships DISABLED; an admin reviews the numbers and switches it on.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.referral_settings (
  id boolean primary key default true check (id),                 -- single row
  enabled boolean not null default false,
  commission_percent numeric(5,2) not null default 10
    check (commission_percent >= 0 and commission_percent <= 40), -- <=40 so two referrers on one charge never exceed the platform's share
  commission_window_months integer not null default 12
    check (commission_window_months >= 0 and commission_window_months <= 120), -- 0 = no limit
  advertiser_milestone_amount numeric(14,2) not null default 1000 check (advertiser_milestone_amount >= 0), -- lifetime ad spend (KES)
  publisher_milestone_amount numeric(14,2) not null default 500 check (publisher_milestone_amount >= 0),    -- lifetime earnings (KES)
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.referral_settings (id) values (true) on conflict (id) do nothing;

create table if not exists public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9]{6,12}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_organization_id uuid not null references public.organizations(id) on delete cascade,
  referred_user_id uuid not null unique references auth.users(id) on delete cascade, -- one referrer per person
  code text not null,
  status text not null default 'pending' check (status in ('pending', 'qualified', 'void')),
  qualified_at timestamptz,
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz not null default now()
);
create index if not exists referrals_referrer_idx on public.referrals (referrer_organization_id, status);

create table if not exists public.referral_commissions (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.referrals(id) on delete cascade,
  referrer_organization_id uuid not null references public.organizations(id) on delete cascade,
  source_earning_id uuid not null references public.publisher_earnings(id) on delete cascade,
  source_created_at timestamptz not null,
  source_role text not null check (source_role in ('advertiser', 'publisher')),
  basis_amount numeric(18,6) not null,
  commission_percent numeric(5,2) not null,
  amount numeric(18,6) not null check (amount >= 0),
  currency text not null default 'KES',
  status text not null default 'pending' check (status in ('pending', 'available', 'paid', 'void')),
  available_at timestamptz not null,
  payout_id uuid references public.payouts(id) on delete set null,
  wallet_transaction_id uuid references public.wallet_transactions(id) on delete set null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (source_earning_id, referral_id)
);
create index if not exists referral_commissions_referrer_idx on public.referral_commissions (referrer_organization_id, status);
create index if not exists referral_commissions_referral_idx on public.referral_commissions (referral_id, source_created_at desc);
create index if not exists referral_commissions_payout_idx on public.referral_commissions (payout_id) where payout_id is not null;

-- ---------------------------------------------------------------------------
-- Row level security: read-only for the people it concerns; ALL writes go through the
-- functions below (or the server). No write policies exist on purpose.
-- ---------------------------------------------------------------------------
alter table public.referral_settings enable row level security;
alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
alter table public.referral_commissions enable row level security;

revoke insert, update, delete, truncate on public.referral_settings, public.referral_codes,
  public.referrals, public.referral_commissions from anon, authenticated;
revoke all on public.referral_settings, public.referral_codes, public.referrals,
  public.referral_commissions from anon;

drop policy if exists "Signed-in users can read referral terms" on public.referral_settings;
create policy "Signed-in users can read referral terms" on public.referral_settings
  for select to authenticated using (true);

drop policy if exists "Members read their referral code" on public.referral_codes;
create policy "Members read their referral code" on public.referral_codes
  for select to authenticated
  using (public.is_org_member(organization_id, auth.uid()) or public.is_platform_staff(auth.uid()));

drop policy if exists "Referrer, referred user and staff read referrals" on public.referrals;
create policy "Referrer, referred user and staff read referrals" on public.referrals
  for select to authenticated
  using (public.is_org_member(referrer_organization_id, auth.uid())
         or referred_user_id = auth.uid()
         or public.is_platform_staff(auth.uid()));

drop policy if exists "Referrer members and staff read commissions" on public.referral_commissions;
create policy "Referrer members and staff read commissions" on public.referral_commissions
  for select to authenticated
  using (public.is_org_member(referrer_organization_id, auth.uid()) or public.is_platform_staff(auth.uid()));

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------
create or replace function public.referral_random_code()
 returns text language plpgsql volatile set search_path to 'public'
as $function$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   -- no 0/O/1/I
  result text := '';
  i int;
begin
  for i in 1..8 loop
    result := result || substr(alphabet, 1 + floor(random() * 32)::int, 1);
  end loop;
  return result;
end $function$;

create or replace function public.get_or_create_referral_code(_organization_id uuid)
 returns text language plpgsql security definer set search_path to 'public'
as $function$
declare _code text; _type text; _try int := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if auth.uid() is null or not public.is_org_member(_organization_id, auth.uid()) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  end if;
  select type::text into _type from public.organizations where id = _organization_id;
  if _type is null or _type not in ('advertiser', 'publisher') then
    raise exception 'referral_not_available_for_organization';
  end if;

  select code into _code from public.referral_codes where organization_id = _organization_id;
  if _code is not null then return _code; end if;

  loop
    _try := _try + 1;
    begin
      insert into public.referral_codes (organization_id, code)
      values (_organization_id, public.referral_random_code())
      on conflict (organization_id) do nothing;
    exception when unique_violation then
      if _try >= 10 then raise; end if;   -- astronomically unlikely code collision: retry
      continue;
    end;
    select code into _code from public.referral_codes where organization_id = _organization_id;
    if _code is not null then return _code; end if;
  end loop;
end $function$;

create or replace function public.apply_referral(_code text)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare _uid uuid := auth.uid(); _s public.referral_settings; _referrer uuid; _created timestamptz; _norm text;
begin
  if _uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select * into _s from public.referral_settings limit 1;
  if _s.id is null or not _s.enabled then
    return jsonb_build_object('ok', false, 'reason', 'program_disabled');
  end if;

  _norm := upper(btrim(coalesce(_code, '')));
  if _norm !~ '^[A-Z0-9]{6,12}$' then return jsonb_build_object('ok', false, 'reason', 'invalid_code'); end if;
  if exists (select 1 from public.referrals where referred_user_id = _uid) then
    return jsonb_build_object('ok', false, 'reason', 'already_referred');
  end if;

  select organization_id into _referrer from public.referral_codes where code = _norm;
  if _referrer is null then return jsonb_build_object('ok', false, 'reason', 'invalid_code'); end if;
  if public.is_org_member(_referrer, _uid) then
    return jsonb_build_object('ok', false, 'reason', 'self_referral');
  end if;

  -- Only brand-new accounts can be referred (stops existing customers being "referred").
  select created_at into _created from auth.users where id = _uid;
  if _created is null or _created < now() - interval '14 days' then
    return jsonb_build_object('ok', false, 'reason', 'too_late');
  end if;

  insert into public.referrals (referrer_organization_id, referred_user_id, code)
  values (_referrer, _uid, _norm);
  return jsonb_build_object('ok', true);
end $function$;

create or replace function public.admin_void_referral(_referral_id uuid, _reason text default null)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_platform_admin(auth.uid()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.referrals
     set status = 'void', voided_at = now(), void_reason = nullif(btrim(coalesce(_reason, '')), '')
   where id = _referral_id and status <> 'void';
  -- Anything not yet paid or claimed in a payout is cancelled. Paid commissions stay paid.
  update public.referral_commissions
     set status = 'void'
   where referral_id = _referral_id and status in ('pending', 'available') and payout_id is null;
end $function$;

create or replace function public.process_referrals()
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  s public.referral_settings;
  v_accrued int := 0; v_qualified int := 0; v_released int := 0; v_voided int := 0; v_credited int := 0;
  rec record; v_ids uuid[]; v_total numeric; v_credit numeric; v_wallet public.wallets; v_tx uuid;
begin
  if not pg_try_advisory_xact_lock(hashtext('process_referrals')) then
    return jsonb_build_object('skipped', true);
  end if;
  select * into s from public.referral_settings limit 1;
  -- Paused: nothing accrues, qualifies or is paid until it is switched back on.
  if s.id is null or not s.enabled then return jsonb_build_object('enabled', false); end if;

  -- (a) ACCRUE: a commission row for each new charge made by / on behalf of a referred user.
  with owned as (
    select r.id as referral_id, r.referrer_organization_id, r.created_at as referral_created,
           m.organization_id as owned_org, lb.lower_bound
    from public.referrals r
    join public.organization_members m
      on m.user_id = r.referred_user_id and m.role = 'owner' and m.status = 'active'
    cross join lateral (
      select coalesce(max(rc.source_created_at) - interval '15 minutes', r.created_at) as lower_bound
      from public.referral_commissions rc where rc.referral_id = r.id
    ) lb
    where r.status in ('pending', 'qualified')
      and m.organization_id <> r.referrer_organization_id
  ), earned as (
    -- referred ADVERTISER: charges against campaigns they own
    select o.referral_id, o.referrer_organization_id, 'advertiser'::text as source_role, e.id as earning_id,
           e.platform_amount, e.available_at, e.created_at as source_created_at, o.referral_created
    from owned o
    join public.campaigns c on c.organization_id = o.owned_org
    join public.publisher_earnings e on e.campaign_id = c.id
    where e.created_at >= greatest(o.referral_created, o.lower_bound)
      and e.status <> 'reversed' and e.platform_amount > 0
    union all
    -- referred PUBLISHER: revenue earned on sites they own
    select o.referral_id, o.referrer_organization_id, 'publisher', e.id,
           e.platform_amount, e.available_at, e.created_at, o.referral_created
    from owned o
    join public.publisher_earnings e on e.organization_id = o.owned_org
    where e.created_at >= greatest(o.referral_created, o.lower_bound)
      and e.status <> 'reversed' and e.platform_amount > 0
  )
  insert into public.referral_commissions
    (referral_id, referrer_organization_id, source_earning_id, source_created_at, source_role,
     basis_amount, commission_percent, amount, status, available_at)
  select x.referral_id, x.referrer_organization_id, x.earning_id, x.source_created_at, x.source_role,
         x.platform_amount, s.commission_percent, round(x.platform_amount * s.commission_percent / 100, 6),
         'pending', x.available_at
  from earned x
  where s.commission_window_months = 0
     or x.source_created_at < x.referral_created + make_interval(months => s.commission_window_months)
  on conflict (source_earning_id, referral_id) do nothing;
  get diagnostics v_accrued = row_count;

  -- (b) QUALIFY: the referred user reached the spend (advertiser) or earnings (publisher) milestone.
  update public.referrals r
     set status = 'qualified', qualified_at = now()
    from (
      select r2.id,
        coalesce((
          select sum(w.lifetime_spent)
          from public.wallets w
          join public.organizations o on o.id = w.organization_id and o.type = 'advertiser'
          join public.organization_members m on m.organization_id = w.organization_id
               and m.user_id = r2.referred_user_id and m.role = 'owner' and m.status = 'active'
          where w.currency = 'KES'), 0) as spent,
        coalesce((
          select sum(e.publisher_amount)
          from public.publisher_earnings e
          join public.organization_members m on m.organization_id = e.organization_id
               and m.user_id = r2.referred_user_id and m.role = 'owner' and m.status = 'active'
          where e.status <> 'reversed'), 0) as earned
      from public.referrals r2 where r2.status = 'pending'
    ) t
   where r.id = t.id
     and (t.spent >= s.advertiser_milestone_amount or t.earned >= s.publisher_milestone_amount);
  get diagnostics v_qualified = row_count;

  -- (c) VOID commissions whose source earning was reversed, or whose referral was voided.
  update public.referral_commissions c set status = 'void'
    from public.publisher_earnings e
   where c.source_earning_id = e.id and e.status = 'reversed'
     and c.status in ('pending', 'available') and c.payout_id is null;
  get diagnostics v_voided = row_count;
  update public.referral_commissions c set status = 'void'
    from public.referrals r
   where c.referral_id = r.id and r.status = 'void'
     and c.status in ('pending', 'available') and c.payout_id is null;

  -- (d) RELEASE: qualified referral + the source earning's hold period has ended.
  update public.referral_commissions c set status = 'available'
    from public.referrals r
   where c.referral_id = r.id and r.status = 'qualified'
     and c.status = 'pending' and c.available_at <= now();
  get diagnostics v_released = row_count;

  -- (e) PAY advertiser referrers as ad credit in their KES wallet (one batched credit per run).
  for rec in
    select c.referrer_organization_id as org
    from public.referral_commissions c
    join public.organizations o on o.id = c.referrer_organization_id and o.type = 'advertiser'
    where c.status = 'available' and c.payout_id is null
    group by c.referrer_organization_id
  loop
    select array_agg(x.id), sum(x.amount) into v_ids, v_total
    from (select id, amount from public.referral_commissions
          where referrer_organization_id = rec.org and status = 'available' and payout_id is null
          for update) x;
    v_credit := round(coalesce(v_total, 0), 2);
    continue when v_credit < 0.01;      -- too small to credit yet; keeps accumulating

    select * into v_wallet from public.wallets where organization_id = rec.org and currency = 'KES' for update;
    if v_wallet.id is null then
      insert into public.wallets (organization_id, currency) values (rec.org, 'KES') returning * into v_wallet;
    end if;
    -- Ad credit, deliberately NOT lifetime_deposited (it isn't a cash deposit).
    update public.wallets set balance_amount = balance_amount + v_credit, updated_at = now()
     where id = v_wallet.id returning * into v_wallet;
    insert into public.wallet_transactions
      (wallet_id, organization_id, type, amount, balance_after, currency, description, reference_type, idempotency_key)
    values (v_wallet.id, rec.org, 'adjustment', v_credit, v_wallet.balance_amount, 'KES',
            'Referral commission credit (' || array_length(v_ids, 1) || ' commissions)', 'referral',
            'referral-credit:' || rec.org || ':' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSUS'))
    returning id into v_tx;
    update public.referral_commissions
       set status = 'paid', paid_at = now(), wallet_transaction_id = v_tx
     where id = any(v_ids);
    v_credited := v_credited + 1;
  end loop;

  return jsonb_build_object('enabled', true, 'accrued', v_accrued, 'qualified', v_qualified,
                            'released', v_released, 'voided', v_voided, 'wallets_credited', v_credited);
end $function$;

-- ---------------------------------------------------------------------------
-- Publisher referrers are paid in CASH through the normal payout flow: their available
-- commissions join the withdrawable balance (request_payout) and are marked paid or
-- released again when an admin reviews the payout (review_payout).
-- ---------------------------------------------------------------------------
create or replace function public.request_payout(_organization_id uuid, _method text, _destination text)
 returns payouts
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare _row public.payouts; _available numeric; _referral numeric; _minimum numeric; _publisher_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if auth.uid() is null or not public.is_org_member(_organization_id, auth.uid()) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  end if;
  if coalesce(btrim(_method), '') = '' or coalesce(btrim(_destination), '') = '' then
    raise exception 'invalid_payout_destination';
  end if;

  perform pg_advisory_xact_lock(hashtext('request_payout:' || _organization_id::text));

  perform public.mature_publisher_earnings(_organization_id);
  select id into _publisher_id from public.publishers where organization_id = _organization_id;
  if _publisher_id is null then raise exception 'publisher_not_found'; end if;

  select coalesce(sum(publisher_amount), 0) into _available
  from public.publisher_earnings
  where organization_id = _organization_id and status = 'available' and payout_id is null;

  -- referral commissions released to this organization (cash for publishers)
  select coalesce(sum(amount), 0) into _referral
  from public.referral_commissions
  where referrer_organization_id = _organization_id and status = 'available' and payout_id is null;
  _available := _available + _referral;

  select minimum_payout_amount into _minimum from public.platform_settings where id limit 1;
  if _available < coalesce(_minimum, 0) or _available <= 0 then
    raise exception 'below_minimum_payout';
  end if;

  insert into public.payouts (organization_id, publisher_id, amount, method, destination, status, requested_by)
  values (_organization_id, _publisher_id, round(_available, 2), _method, _destination, 'pending', auth.uid())
  returning * into _row;

  update public.publisher_earnings set payout_id = _row.id, updated_at = now()
  where organization_id = _organization_id and status = 'available' and payout_id is null;
  update public.referral_commissions set payout_id = _row.id
  where referrer_organization_id = _organization_id and status = 'available' and payout_id is null;

  return _row;
end $function$;

create or replace function public.review_payout(_payout_id uuid, _status text, _reason text default null, _payment_reference text default null)
 returns payouts
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare _row public.payouts;
begin
  if _status not in ('approved','paid','rejected') then raise exception 'invalid_status'; end if;
  update public.payouts set
    status = _status::public.payout_status,
    rejection_reason = case when _status = 'rejected' then _reason else rejection_reason end,
    payment_reference = coalesce(_payment_reference, payment_reference),
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    paid_at = case when _status = 'paid' then now() else paid_at end,
    updated_at = now()
  where id = _payout_id
  returning * into _row;
  if _row.id is null then raise exception 'payout_not_found'; end if;
  if _status = 'paid' then
    update public.publisher_earnings set status = 'paid', paid_at = now(), updated_at = now()
    where payout_id = _row.id;
    update public.referral_commissions set status = 'paid', paid_at = now()
    where payout_id = _row.id and status = 'available';
  elsif _status = 'rejected' then
    update public.publisher_earnings set payout_id = null, updated_at = now()
    where payout_id = _row.id;
    update public.referral_commissions set payout_id = null
    where payout_id = _row.id and status = 'available';
  end if;
  return _row;
end $function$;

-- ---------------------------------------------------------------------------
-- Read helpers for the Referrals pages (aggregates + a privacy-safe list).
-- A referrer sees who joined and what it earned, but only a masked name.
-- ---------------------------------------------------------------------------
create or replace function public.get_referral_summary(_organization_id uuid)
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
declare r jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not (public.is_org_member(_organization_id, auth.uid()) or public.is_platform_staff(auth.uid())) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'referrals', (select jsonb_build_object(
        'total', count(*),
        'pending', count(*) filter (where status = 'pending'),
        'qualified', count(*) filter (where status = 'qualified'),
        'void', count(*) filter (where status = 'void'))
      from public.referrals where referrer_organization_id = _organization_id),
    'commissions', (select jsonb_build_object(
        'pending', coalesce(sum(amount) filter (where status = 'pending'), 0),
        'available', coalesce(sum(amount) filter (where status = 'available'), 0),
        'paid', coalesce(sum(amount) filter (where status = 'paid'), 0))
      from public.referral_commissions where referrer_organization_id = _organization_id),
    'currency', 'KES') into r;
  return r;
end $function$;

create or replace function public.get_referral_list(_organization_id uuid, _limit integer default 100)
 returns table (id uuid, status text, created_at timestamptz, qualified_at timestamptz,
                masked_name text, kind text, earned numeric, pending numeric)
 language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not (public.is_org_member(_organization_id, auth.uid()) or public.is_platform_staff(auth.uid())) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select r.id, r.status, r.created_at, r.qualified_at,
         coalesce(left(o.name, 2) || '•••', 'New member'),
         coalesce(o.type::text, 'member'),
         coalesce(sum(c.amount) filter (where c.status in ('available', 'paid')), 0),
         coalesce(sum(c.amount) filter (where c.status = 'pending'), 0)
  from public.referrals r
  left join lateral (
    select o2.name, o2.type
    from public.organization_members m
    join public.organizations o2 on o2.id = m.organization_id
    where m.user_id = r.referred_user_id and m.role = 'owner' and m.status = 'active'
    order by o2.created_at limit 1
  ) o on true
  left join public.referral_commissions c on c.referral_id = r.id
  where r.referrer_organization_id = _organization_id
  group by r.id, o.name, o.type
  order by r.created_at desc
  limit least(greatest(coalesce(_limit, 100), 1), 500);
end $function$;

create or replace function public.admin_referral_overview(_limit integer default 200)
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
declare result jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_platform_staff(auth.uid()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'stats', jsonb_build_object(
      'referrals_total', (select count(*) from public.referrals),
      'referrals_pending', (select count(*) from public.referrals where status = 'pending'),
      'referrals_qualified', (select count(*) from public.referrals where status = 'qualified'),
      'referrals_void', (select count(*) from public.referrals where status = 'void'),
      'commission_pending', coalesce((select sum(amount) from public.referral_commissions where status = 'pending'), 0),
      'commission_available', coalesce((select sum(amount) from public.referral_commissions where status = 'available'), 0),
      'commission_paid', coalesce((select sum(amount) from public.referral_commissions where status = 'paid'), 0)),
    'referrals', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
        select r.id, r.status, r.created_at, r.qualified_at, r.void_reason,
               ro.name as referrer_name, ro.type::text as referrer_type,
               o.name as referred_name, o.type::text as referred_type,
               coalesce((select sum(c.amount) from public.referral_commissions c where c.referral_id = r.id and c.status in ('available', 'paid')), 0) as earned,
               coalesce((select sum(c.amount) from public.referral_commissions c where c.referral_id = r.id and c.status = 'pending'), 0) as pending
        from public.referrals r
        join public.organizations ro on ro.id = r.referrer_organization_id
        left join lateral (
          select o2.name, o2.type from public.organization_members m
          join public.organizations o2 on o2.id = m.organization_id
          where m.user_id = r.referred_user_id and m.role = 'owner' and m.status = 'active'
          order by o2.created_at limit 1) o on true
        order by r.created_at desc
        limit least(greatest(coalesce(_limit, 200), 1), 500)) x), '[]'::jsonb)
  ) into result;
  return result;
end $function$;

-- ---------------------------------------------------------------------------
-- Permissions (see SECURITY.md): no anonymous access; server-only where only the server calls.
-- ---------------------------------------------------------------------------
revoke all on function public.referral_random_code() from public, anon, authenticated;
revoke all on function public.process_referrals() from public, anon, authenticated;
revoke all on function public.get_or_create_referral_code(uuid) from public, anon;
revoke all on function public.apply_referral(text) from public, anon;
revoke all on function public.admin_void_referral(uuid, text) from public, anon;
grant execute on function public.referral_random_code() to service_role;
grant execute on function public.process_referrals() to service_role;
grant execute on function public.get_or_create_referral_code(uuid) to authenticated, service_role;
grant execute on function public.apply_referral(text) to authenticated, service_role;
grant execute on function public.admin_void_referral(uuid, text) to authenticated, service_role;
revoke all on function public.get_referral_summary(uuid) from public, anon;
revoke all on function public.get_referral_list(uuid, integer) from public, anon;
grant execute on function public.get_referral_summary(uuid) to authenticated, service_role;
grant execute on function public.get_referral_list(uuid, integer) to authenticated, service_role;
revoke all on function public.admin_referral_overview(integer) from public, anon;
grant execute on function public.admin_referral_overview(integer) to authenticated, service_role;

notify pgrst, 'reload schema';
