-- TradeMall ad-serving diagnostic. READ-ONLY: contains only SELECT statements.
-- Run each numbered query separately in the Supabase SQL editor.
--
-- 1. Schema check   : objects the serving code reads. Any present = false breaks serving
--                     (a missing column makes the candidate query error on EVERY request).
-- 2. Campaign gates : for each ad, the first gate in the serving path that blocks it.
-- 3. Zone gates     : whether each zone passes the supply-side checks, and its format.
-- 4. Auto Ads       : per website, the Auto Ads settings, placements and their zones.

-- ---------------------------------------------------------------------------
-- 1. Schema objects the serving path depends on
-- ---------------------------------------------------------------------------
select 'column' as kind,
       t.tbl || '.' || t.col as object,
       exists (
         select 1
           from information_schema.columns c
          where c.table_schema = 'public'
            and c.table_name = t.tbl
            and c.column_name = t.col
       ) as present
  from (values
    ('campaign_targeting', 'frequency_cap'),
    ('campaign_targeting', 'counties'),
    ('campaign_targeting', 'cities'),
    ('campaign_targeting', 'schedule'),
    ('campaigns', 'pause_reason'),
    ('campaigns', 'spent_amount'),
    ('campaigns', 'priority'),
    ('campaigns', 'organization_id'),
    ('campaigns', 'start_date'),
    ('campaigns', 'end_date'),
    ('ads', 'media_asset_id'),
    ('media_assets', 'storage_provider'),
    ('impressions', 'is_likely_bot'),
    ('impressions', 'bot_score'),
    ('impressions', 'ip_address'),
    ('impressions', 'region'),
    ('clicks', 'is_likely_bot'),
    ('clicks', 'bot_score'),
    ('clicks', 'ip_address'),
    ('clicks', 'region')
  ) as t(tbl, col)
union all
select 'table', 'house_ads', to_regclass('public.house_ads') is not null
union all
select 'table', 'website_placements', to_regclass('public.website_placements') is not null
union all
select 'function', 'charge_campaign_event',
       exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'public' and p.proname = 'charge_campaign_event')
union all
select 'function', 'check_rate_limit',
       exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'public' and p.proname = 'check_rate_limit')
order by present, kind, object;

-- ---------------------------------------------------------------------------
-- 2. Why is each ad not serving? (first blocking gate, in serving order)
--    Mirrors loadCandidates() + fundedOrganizationIds() + candidateIsEligible().
-- ---------------------------------------------------------------------------
select c.id                                         as campaign_id,
       c.name                                       as campaign_name,
       a.id                                         as ad_id,
       a.format                                     as ad_format,
       case
         when a.status <> 'active'                              then 'ad.status is ' || a.status || ' (needs active)'
         when a.approval_status <> 'approved'                   then 'ad.approval_status is ' || a.approval_status
         when a.media_asset_id is null                          then 'ad has no media_asset_id (no creative)'
         when m.id is null                                      then 'media asset row not found'
         when m.status <> 'ready'                               then 'media asset status is ' || m.status || ' (needs ready)'
         when c.approval_status <> 'approved'                   then 'campaign.approval_status is ' || c.approval_status
         when c.status not in ('active', 'approved')            then 'campaign.status is ' || c.status || ' (pause_reason: ' || coalesce(c.pause_reason, 'none') || ')'
         when coalesce(c.bid_amount, 0) <= 0                    then 'bid_amount is 0'
         when c.start_date is not null
              and c.start_date > (now() at time zone 'utc')::date then 'campaign has not started yet (start_date ' || c.start_date || ', compared in UTC)'
         when c.end_date is not null
              and c.end_date < (now() at time zone 'utc')::date   then 'campaign ended (end_date ' || c.end_date || ')'
         when coalesce(c.total_budget, 0) - coalesce(c.spent_amount, 0) <= 0
                                                                then 'budget exhausted (total_budget ' || coalesce(c.total_budget, 0) || ', spent ' || coalesce(c.spent_amount, 0) || ')'
         when coalesce(w.kes_balance, 0) <= 0                   then 'no funded KES wallet (wallets: ' || coalesce(w.all_wallets, 'none') || ')'
         else 'passes campaign/ad/wallet gates - check targeting and zone format below'
       end                                          as first_blocker,
       c.total_budget, c.spent_amount, c.bid_type, c.bid_amount,
       c.start_date, c.end_date,
       w.kes_balance,
       t.countries, t.counties, t.cities, t.devices, t.operating_systems,
       t.browsers, t.website_categories, t.schedule, t.frequency_cap
  from public.ads a
  join public.campaigns c            on c.id = a.campaign_id
  left join public.media_assets m    on m.id = a.media_asset_id
  left join public.campaign_targeting t on t.campaign_id = c.id
  left join lateral (
        select sum(wl.balance_amount) filter (where wl.currency = 'KES') as kes_balance,
               string_agg(wl.currency || ' ' || wl.balance_amount, ', ')  as all_wallets
          from public.wallets wl
         where wl.organization_id = c.organization_id
       ) w on true
 order by c.created_at desc, a.created_at desc;

-- ---------------------------------------------------------------------------
-- 3. Zone / website / publisher gates (supply side) and zone format
--    Mirrors zoneIsServeable(). An ad serves in a zone only if the formats are
--    identical or either side is 'responsive'.
-- ---------------------------------------------------------------------------
select z.zone_key,
       z.format                       as zone_format,
       w.domain                       as registered_domain,
       case
         when z.status <> 'active'                 then 'zone.status is ' || z.status
         when w.status <> 'active'                 then 'website.status is ' || w.status
         when w.approval_status <> 'approved'      then 'website.approval_status is ' || w.approval_status
         when w.verification_status <> 'verified'  then 'website.verification_status is ' || w.verification_status
         when p.status <> 'active'                 then 'publisher.status is ' || p.status
         when p.approval_status <> 'approved'      then 'publisher.approval_status is ' || p.approval_status
         else 'zone is serveable'
       end                            as zone_gate
  from public.ad_zones z
  join public.websites w   on w.id = z.website_id
  join public.publishers p on p.id = z.publisher_id
 order by z.created_at desc;

-- ---------------------------------------------------------------------------
-- 4. Auto Ads state per website
--    The SDK asks /api/public/placements for rows where placement_enabled = true
--    AND zone_status = 'active'. If this returns no such row for your website,
--    Auto Ads has nothing to place: open the website's Auto Ads tab, switch it
--    on and press Save settings, then re-run this query.
-- ---------------------------------------------------------------------------
select w.domain,
       w.verification_status,
       w.approval_status,
       a.status              as auto_ads_status,
       a.banner_ads_enabled,
       a.responsive_ads_enabled,
       a.mobile_ads_enabled,
       a.excluded_pages,
       p.placement_key,
       p.enabled             as placement_enabled,
       z.zone_key,
       z.status              as zone_status,
       z.format              as zone_format
  from public.websites w
  left join public.auto_ads_config a   on a.website_id = w.id
  left join public.website_placements p on p.website_id = w.id
  left join public.ad_zones z           on z.id = p.zone_id
 order by w.domain, p.placement_key;
