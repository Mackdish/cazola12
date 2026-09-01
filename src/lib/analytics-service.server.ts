/**
 * Server-only analytics service.
 *
 * Queries daily aggregation tables for time-series data and raw event tables
 * for breakdowns. All reads are scoped by organization, publisher, or campaign
 * so no cross-tenant leakage is possible.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;
type Ctx = { supabase: Client; userId: string };

export class ServiceError extends Error {}

function fail(message: string): never {
  throw new ServiceError(message);
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Client;
}

// ----------------------------------------------------------------- types

export type DateRange = {
  from: string;
  to: string;
};

export type AdvertiserAnalyticsFilters = {
  organizationId: string;
  dateRange: DateRange;
  campaignId?: string | null;
  websiteId?: string | null;
  adZoneId?: string | null;
  deviceType?: string | null;
  country?: string | null;
};

export type PublisherAnalyticsFilters = {
  organizationId: string;
  dateRange: DateRange;
  websiteId?: string | null;
  adZoneId?: string | null;
  deviceType?: string | null;
  country?: string | null;
};

export type AdminAnalyticsFilters = {
  dateRange: DateRange;
};

export type TimeSeriesPoint = {
  date: string;
  impressions: number;
  clicks: number;
  ctr: number;
  spend: number;
  cpc: number;
  cpm: number;
};

export type PublisherTimeSeriesPoint = {
  date: string;
  impressions: number;
  clicks: number;
  ctr: number;
  earnings: number;
  rpm: number;
};

export type BreakdownRow = {
  id: string;
  name: string;
  impressions: number;
  clicks: number;
  ctr: number;
  spend: number;
  cpc: number;
  cpm: number;
  earnings: number;
  rpm: number;
};

export type AdvertiserAnalyticsResult = {
  summary: {
    impressions: number;
    clicks: number;
    ctr: number;
    spend: number;
    cpc: number;
    cpm: number;
    conversions: number;
  };
  timeSeries: TimeSeriesPoint[];
  topWebsites: BreakdownRow[];
  topZones: BreakdownRow[];
  devicePerformance: BreakdownRow[];
  countryPerformance: BreakdownRow[];
};

export type PublisherAnalyticsResult = {
  summary: {
    impressions: number;
    clicks: number;
    ctr: number;
    earnings: number;
    rpm: number;
  };
  timeSeries: PublisherTimeSeriesPoint[];
  topWebsites: BreakdownRow[];
  topZones: BreakdownRow[];
  dailyEarnings: BreakdownRow[];
};

export type AdminAnalyticsResult = {
  summary: {
    totalAdvertisers: number;
    totalPublishers: number;
    activeCampaigns: number;
    totalWebsites: number;
    totalImpressions: number;
    totalClicks: number;
    totalAdvertiserSpend: number;
    publisherEarnings: number;
    platformRevenue: number;
    ctr: number;
  };
  timeSeries: TimeSeriesPoint[];
  topPublishers: BreakdownRow[];
  topAdvertisers: BreakdownRow[];
  topCampaigns: BreakdownRow[];
};

// ----------------------------------------------------------------- advertiser

async function campaignIdsForOrg(ctx: Ctx, organizationId: string): Promise<string[]> {
  const { data, error } = await ctx.supabase
    .from("campaigns")
    .select("id")
    .eq("organization_id", organizationId);
  if (error) fail("We couldn't load your campaigns.");
  return (data ?? []).map((row) => row.id);
}

async function getAdvertiserSummary(
  client: Client,
  campaignIds: string[],
  filters: AdvertiserAnalyticsFilters,
): Promise<AdvertiserAnalyticsResult["summary"]> {
  let query = client
    .from("campaign_daily_stats")
    .select("impressions, clicks, spend, cpc, cpm, conversions")
    .in("campaign_id", campaignIds)
    .gte("date", filters.dateRange.from)
    .lte("date", filters.dateRange.to);

  if (filters.campaignId) query = query.eq("campaign_id", filters.campaignId);

  const { data, error } = await query;
  if (error) fail("We couldn't load your analytics summary.");

  const rows = data ?? [];
  const totalImpressions = rows.reduce((s, r) => s + (r.impressions ?? 0), 0);
  const totalClicks = rows.reduce((s, r) => s + (r.clicks ?? 0), 0);
  const totalSpend = rows.reduce((s, r) => s + Number(r.spend ?? 0), 0);

  return {
    impressions: totalImpressions,
    clicks: totalClicks,
    ctr: totalImpressions > 0 ? round(totalClicks / totalImpressions, 4) : 0,
    spend: round(totalSpend, 2),
    cpc: totalClicks > 0 ? round(totalSpend / totalClicks, 4) : 0,
    cpm: totalImpressions > 0 ? round((totalSpend / totalImpressions) * 1000, 4) : 0,
    conversions: rows.reduce((s, r) => s + (r.conversions ?? 0), 0),
  };
}

async function getAdvertiserTimeSeries(
  client: Client,
  campaignIds: string[],
  filters: AdvertiserAnalyticsFilters,
): Promise<TimeSeriesPoint[]> {
  let query = client
    .from("campaign_daily_stats")
    .select("date, impressions, clicks, spend, cpc, cpm")
    .in("campaign_id", campaignIds)
    .gte("date", filters.dateRange.from)
    .lte("date", filters.dateRange.to)
    .order("date", { ascending: true });

  if (filters.campaignId) query = query.eq("campaign_id", filters.campaignId);

  const { data, error } = await query;
  if (error) fail("We couldn't load your analytics time series.");

  return (data ?? []).map((row) => ({
    date: row.date,
    impressions: row.impressions ?? 0,
    clicks: row.clicks ?? 0,
    ctr: row.impressions > 0 ? round((row.clicks ?? 0) / row.impressions, 4) : 0,
    spend: round(Number(row.spend ?? 0), 2),
    cpc: (row.clicks ?? 0) > 0 ? round(Number(row.spend ?? 0) / row.clicks, 4) : 0,
    cpm:
      (row.impressions ?? 0) > 0 ? round((Number(row.spend ?? 0) / row.impressions) * 1000, 4) : 0,
  }));
}

async function getAdvertiserTopWebsites(
  client: Client,
  campaignIds: string[],
  filters: AdvertiserAnalyticsFilters,
): Promise<BreakdownRow[]> {
  const { data, error } = await client
    .from("impressions")
    .select("website_id, websites!inner(name)")
    .in("campaign_id", campaignIds)
    .eq("is_likely_bot", false)
    .gte("created_at", `${filters.dateRange.from}T00:00:00Z`)
    .lte("created_at", `${filters.dateRange.to}T23:59:59Z`);

  if (error || !data) return [];

  const websiteMap = new Map<string, { name: string; impressions: number }>();
  for (const row of data) {
    const name = (row.websites as unknown as { name: string }).name;
    websiteMap.set(row.website_id, {
      name,
      impressions: (websiteMap.get(row.website_id)?.impressions ?? 0) + 1,
    });
  }

  return Array.from(websiteMap.entries())
    .map(([id, { name, impressions }]) => ({
      id,
      name,
      impressions,
      clicks: 0,
      ctr: 0,
      spend: 0,
      cpc: 0,
      cpm: 0,
      earnings: 0,
      rpm: 0,
    }))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 10);
}

async function getAdvertiserTopZones(
  client: Client,
  campaignIds: string[],
  filters: AdvertiserAnalyticsFilters,
): Promise<BreakdownRow[]> {
  const { data, error } = await client
    .from("impressions")
    .select("ad_zone_id, ad_zones!inner(name)")
    .in("campaign_id", campaignIds)
    .eq("is_likely_bot", false)
    .gte("created_at", `${filters.dateRange.from}T00:00:00Z`)
    .lte("created_at", `${filters.dateRange.to}T23:59:59Z`);

  if (error || !data) return [];

  const zoneMap = new Map<string, { name: string; impressions: number }>();
  for (const row of data) {
    const name = (row.ad_zones as unknown as { name: string }).name;
    zoneMap.set(row.ad_zone_id, {
      name,
      impressions: (zoneMap.get(row.ad_zone_id)?.impressions ?? 0) + 1,
    });
  }

  return Array.from(zoneMap.entries())
    .map(([id, { name, impressions }]) => ({
      id,
      name,
      impressions,
      clicks: 0,
      ctr: 0,
      spend: 0,
      cpc: 0,
      cpm: 0,
      earnings: 0,
      rpm: 0,
    }))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 10);
}

async function getAdvertiserDevicePerformance(
  client: Client,
  campaignIds: string[],
  filters: AdvertiserAnalyticsFilters,
): Promise<BreakdownRow[]> {
  const { data, error } = await client
    .from("impressions")
    .select("device_type")
    .in("campaign_id", campaignIds)
    .eq("is_likely_bot", false)
    .gte("created_at", `${filters.dateRange.from}T00:00:00Z`)
    .lte("created_at", `${filters.dateRange.to}T23:59:59Z`);

  if (error || !data) return [];

  const deviceMap = new Map<string, number>();
  for (const row of data) {
    const key = row.device_type ?? "unknown";
    deviceMap.set(key, (deviceMap.get(key) ?? 0) + 1);
  }

  const total = data.length;
  return Array.from(deviceMap.entries())
    .map(([id, impressions]) => ({
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1),
      impressions,
      clicks: 0,
      ctr: 0,
      spend: 0,
      cpc: 0,
      cpm: 0,
      earnings: 0,
      rpm: 0,
    }))
    .sort((a, b) => b.impressions - a.impressions);
}

async function getAdvertiserCountryPerformance(
  client: Client,
  campaignIds: string[],
  filters: AdvertiserAnalyticsFilters,
): Promise<BreakdownRow[]> {
  const { data, error } = await client
    .from("impressions")
    .select("country")
    .in("campaign_id", campaignIds)
    .eq("is_likely_bot", false)
    .gte("created_at", `${filters.dateRange.from}T00:00:00Z`)
    .lte("created_at", `${filters.dateRange.to}T23:59:59Z`);

  if (error || !data) return [];

  const countryMap = new Map<string, number>();
  for (const row of data) {
    const key = row.country ?? "unknown";
    countryMap.set(key, (countryMap.get(key) ?? 0) + 1);
  }

  return Array.from(countryMap.entries())
    .map(([id, impressions]) => ({
      id,
      name: id.toUpperCase(),
      impressions,
      clicks: 0,
      ctr: 0,
      spend: 0,
      cpc: 0,
      cpm: 0,
      earnings: 0,
      rpm: 0,
    }))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 20);
}

export async function getAdvertiserAnalytics(
  ctx: Ctx,
  filters: AdvertiserAnalyticsFilters,
): Promise<AdvertiserAnalyticsResult> {
  const campaignIds = await campaignIdsForOrg(ctx, filters.organizationId);
  if (campaignIds.length === 0) {
    return {
      summary: { impressions: 0, clicks: 0, ctr: 0, spend: 0, cpc: 0, cpm: 0, conversions: 0 },
      timeSeries: [],
      topWebsites: [],
      topZones: [],
      devicePerformance: [],
      countryPerformance: [],
    };
  }

  const [summary, timeSeries, topWebsites, topZones, devicePerformance, countryPerformance] =
    await Promise.all([
      getAdvertiserSummary(ctx.supabase, campaignIds, filters),
      getAdvertiserTimeSeries(ctx.supabase, campaignIds, filters),
      getAdvertiserTopWebsites(ctx.supabase, campaignIds, filters),
      getAdvertiserTopZones(ctx.supabase, campaignIds, filters),
      getAdvertiserDevicePerformance(ctx.supabase, campaignIds, filters),
      getAdvertiserCountryPerformance(ctx.supabase, campaignIds, filters),
    ]);

  return {
    summary,
    timeSeries,
    topWebsites,
    topZones,
    devicePerformance,
    countryPerformance,
  };
}

// ----------------------------------------------------------------- publisher

async function publisherIdsForOrg(ctx: Ctx, organizationId: string): Promise<string[]> {
  const { data, error } = await ctx.supabase
    .from("publishers")
    .select("id")
    .eq("organization_id", organizationId);
  if (error) fail("We couldn't load your publisher profile.");
  return (data ?? []).map((row) => row.id);
}

async function getPublisherSummary(
  client: Client,
  publisherIds: string[],
  filters: PublisherAnalyticsFilters,
): Promise<PublisherAnalyticsResult["summary"]> {
  if (filters.websiteId) {
    const { data, error } = await client
      .from("website_daily_stats")
      .select("impressions, clicks, earnings")
      .eq("website_id", filters.websiteId)
      .gte("date", filters.dateRange.from)
      .lte("date", filters.dateRange.to);

    if (error) fail("We couldn't load your analytics summary.");

    const rows = data ?? [];
    const totalImpressions = rows.reduce((s, r) => s + (r.impressions ?? 0), 0);
    const totalClicks = rows.reduce((s, r) => s + (r.clicks ?? 0), 0);
    const totalEarnings = rows.reduce((s, r) => s + Number(r.earnings ?? 0), 0);

    return {
      impressions: totalImpressions,
      clicks: totalClicks,
      ctr: totalImpressions > 0 ? round(totalClicks / totalImpressions, 4) : 0,
      earnings: round(totalEarnings, 2),
      rpm: totalImpressions > 0 ? round((totalEarnings / totalImpressions) * 1000, 4) : 0,
    };
  }

  const { data, error } = await client
    .from("publisher_daily_stats")
    .select("impressions, clicks, earnings")
    .in("publisher_id", publisherIds)
    .gte("date", filters.dateRange.from)
    .lte("date", filters.dateRange.to);

  if (error) fail("We couldn't load your analytics summary.");

  const rows = data ?? [];
  const totalImpressions = rows.reduce((s, r) => s + (r.impressions ?? 0), 0);
  const totalClicks = rows.reduce((s, r) => s + (r.clicks ?? 0), 0);
  const totalEarnings = rows.reduce((s, r) => s + Number(r.earnings ?? 0), 0);

  return {
    impressions: totalImpressions,
    clicks: totalClicks,
    ctr: totalImpressions > 0 ? round(totalClicks / totalImpressions, 4) : 0,
    earnings: round(totalEarnings, 2),
    rpm: totalImpressions > 0 ? round((totalEarnings / totalImpressions) * 1000, 4) : 0,
  };
}

async function getPublisherTimeSeries(
  client: Client,
  publisherIds: string[],
  filters: PublisherAnalyticsFilters,
): Promise<PublisherTimeSeriesPoint[]> {
  if (filters.websiteId) {
    const { data, error } = await client
      .from("website_daily_stats")
      .select("date, impressions, clicks, earnings, rpm")
      .eq("website_id", filters.websiteId)
      .gte("date", filters.dateRange.from)
      .lte("date", filters.dateRange.to)
      .order("date", { ascending: true });

    if (error) fail("We couldn't load your analytics time series.");

    return (data ?? []).map((row) => ({
      date: row.date,
      impressions: row.impressions ?? 0,
      clicks: row.clicks ?? 0,
      ctr: row.impressions > 0 ? round((row.clicks ?? 0) / row.impressions, 4) : 0,
      earnings: round(Number(row.earnings ?? 0), 2),
      rpm:
        (row.impressions ?? 0) > 0
          ? round((Number(row.earnings ?? 0) / row.impressions) * 1000, 4)
          : 0,
    }));
  }

  const { data, error } = await client
    .from("publisher_daily_stats")
    .select("date, impressions, clicks, earnings, rpm")
    .in("publisher_id", publisherIds)
    .gte("date", filters.dateRange.from)
    .lte("date", filters.dateRange.to)
    .order("date", { ascending: true });

  if (error) fail("We couldn't load your analytics time series.");

  return (data ?? []).map((row) => ({
    date: row.date,
    impressions: row.impressions ?? 0,
    clicks: row.clicks ?? 0,
    ctr: row.impressions > 0 ? round((row.clicks ?? 0) / row.impressions, 4) : 0,
    earnings: round(Number(row.earnings ?? 0), 2),
    rpm:
      (row.impressions ?? 0) > 0
        ? round((Number(row.earnings ?? 0) / row.impressions) * 1000, 4)
        : 0,
  }));
}

async function getPublisherTopWebsites(
  client: Client,
  publisherIds: string[],
  filters: PublisherAnalyticsFilters,
): Promise<BreakdownRow[]> {
  const { data, error } = await client
    .from("website_daily_stats")
    .select("website_id, websites!inner(name), impressions, clicks, earnings")
    .in("publisher_id", publisherIds)
    .gte("date", filters.dateRange.from)
    .lte("date", filters.dateRange.to);

  if (error || !data) return [];

  const websiteMap = new Map<
    string,
    { name: string; impressions: number; clicks: number; earnings: number }
  >();
  for (const row of data) {
    const name = (row.websites as unknown as { name: string }).name;
    const existing = websiteMap.get(row.website_id) ?? {
      name,
      impressions: 0,
      clicks: 0,
      earnings: 0,
    };
    existing.impressions += row.impressions ?? 0;
    existing.clicks += row.clicks ?? 0;
    existing.earnings += Number(row.earnings ?? 0);
    websiteMap.set(row.website_id, existing);
  }

  return Array.from(websiteMap.entries())
    .map(([id, vals]) => ({
      id,
      name: vals.name,
      impressions: vals.impressions,
      clicks: vals.clicks,
      ctr: vals.impressions > 0 ? round(vals.clicks / vals.impressions, 4) : 0,
      spend: 0,
      cpc: 0,
      cpm: 0,
      earnings: round(vals.earnings, 2),
      rpm: vals.impressions > 0 ? round((vals.earnings / vals.impressions) * 1000, 4) : 0,
    }))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 10);
}

async function getPublisherTopZones(
  client: Client,
  publisherIds: string[],
  filters: PublisherAnalyticsFilters,
): Promise<BreakdownRow[]> {
  const { data, error } = await client
    .from("impressions")
    .select("ad_zone_id, ad_zones!inner(name)")
    .in("publisher_id", publisherIds)
    .eq("is_likely_bot", false)
    .gte("created_at", `${filters.dateRange.from}T00:00:00Z`)
    .lte("created_at", `${filters.dateRange.to}T23:59:59Z`);

  if (error || !data) return [];

  const zoneMap = new Map<string, { name: string; impressions: number }>();
  for (const row of data) {
    const name = (row.ad_zones as unknown as { name: string }).name;
    zoneMap.set(row.ad_zone_id, {
      name,
      impressions: (zoneMap.get(row.ad_zone_id)?.impressions ?? 0) + 1,
    });
  }

  return Array.from(zoneMap.entries())
    .map(([id, { name, impressions }]) => ({
      id,
      name,
      impressions,
      clicks: 0,
      ctr: 0,
      spend: 0,
      cpc: 0,
      cpm: 0,
      earnings: 0,
      rpm: 0,
    }))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 10);
}

async function getPublisherDailyEarnings(
  client: Client,
  publisherIds: string[],
  filters: PublisherAnalyticsFilters,
): Promise<BreakdownRow[]> {
  const { data, error } = await client
    .from("publisher_daily_stats")
    .select("date, earnings")
    .in("publisher_id", publisherIds)
    .gte("date", filters.dateRange.from)
    .lte("date", filters.dateRange.to)
    .order("date", { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.date,
    name: row.date,
    impressions: 0,
    clicks: 0,
    ctr: 0,
    spend: 0,
    cpc: 0,
    cpm: 0,
    earnings: round(Number(row.earnings ?? 0), 2),
    rpm: 0,
  }));
}

export async function getPublisherAnalytics(
  ctx: Ctx,
  filters: PublisherAnalyticsFilters,
): Promise<PublisherAnalyticsResult> {
  const publisherIds = await publisherIdsForOrg(ctx, filters.organizationId);
  if (publisherIds.length === 0) {
    return {
      summary: { impressions: 0, clicks: 0, ctr: 0, earnings: 0, rpm: 0 },
      timeSeries: [],
      topWebsites: [],
      topZones: [],
      dailyEarnings: [],
    };
  }

  const [summary, timeSeries, topWebsites, topZones, dailyEarnings] = await Promise.all([
    getPublisherSummary(ctx.supabase, publisherIds, filters),
    getPublisherTimeSeries(ctx.supabase, publisherIds, filters),
    getPublisherTopWebsites(ctx.supabase, publisherIds, filters),
    getPublisherTopZones(ctx.supabase, publisherIds, filters),
    getPublisherDailyEarnings(ctx.supabase, publisherIds, filters),
  ]);

  return {
    summary,
    timeSeries,
    topWebsites,
    topZones,
    dailyEarnings,
  };
}

// ----------------------------------------------------------------- admin

export async function getAdminAnalytics(
  _ctx: Ctx,
  _filters: AdminAnalyticsFilters,
): Promise<AdminAnalyticsResult> {
  const db = await admin();

  const fromDate = `${_filters.dateRange.from}T00:00:00Z`;
  const toDate = `${_filters.dateRange.to}T23:59:59Z`;

  const [
    advertisersCount,
    publishersCount,
    campaignsCount,
    websitesCount,
    impressionsCount,
    clicksCount,
    spendRows,
    earningsRows,
    platformRows,
    timeSeriesData,
    topPublishers,
    topAdvertisers,
    topCampaigns,
  ] = await Promise.all([
    db.from("advertisers").select("id", { count: "exact", head: true }),
    db.from("publishers").select("id", { count: "exact", head: true }),
    db
      .from("campaigns")
      .select("id", { count: "exact", head: true })
      .in("status", ["active", "approved"]),
    db.from("websites").select("id", { count: "exact", head: true }),
    db
      .from("impressions")
      .select("id", { count: "exact", head: true })
      .eq("is_likely_bot", false)
      .gte("created_at", fromDate)
      .lte("created_at", toDate),
    db
      .from("clicks")
      .select("id", { count: "exact", head: true })
      .eq("is_likely_bot", false)
      .gte("created_at", fromDate)
      .lte("created_at", toDate),
    db
      .from("campaign_spend")
      .select("amount")
      .gte("created_at", fromDate)
      .lte("created_at", toDate),
    db
      .from("publisher_earnings")
      .select("publisher_amount")
      .gte("created_at", fromDate)
      .lte("created_at", toDate),
    db
      .from("campaign_spend")
      .select("platform_amount")
      .gte("created_at", fromDate)
      .lte("created_at", toDate),
    db
      .from("campaign_daily_stats")
      .select("date, impressions, clicks, spend, cpc, cpm")
      .gte("date", _filters.dateRange.from)
      .lte("date", _filters.dateRange.to)
      .order("date", { ascending: true }),
    getAdminTopPublishers(db, _filters),
    getAdminTopAdvertisers(db, _filters),
    getAdminTopCampaigns(db, _filters),
  ]);

  const totalSpend = (spendRows.data ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const totalEarnings = (earningsRows.data ?? []).reduce(
    (s, r) => s + Number(r.publisher_amount ?? 0),
    0,
  );
  const totalPlatform = (platformRows.data ?? []).reduce(
    (s, r) => s + Number(r.platform_amount ?? 0),
    0,
  );
  const totalImpressions = impressionsCount.count ?? 0;
  const totalClicks = clicksCount.count ?? 0;

  return {
    summary: {
      totalAdvertisers: advertisersCount.count ?? 0,
      totalPublishers: publishersCount.count ?? 0,
      activeCampaigns: campaignsCount.count ?? 0,
      totalWebsites: websitesCount.count ?? 0,
      totalImpressions,
      totalClicks,
      totalAdvertiserSpend: round(totalSpend, 2),
      publisherEarnings: round(totalEarnings, 2),
      platformRevenue: round(totalPlatform, 2),
      ctr: totalImpressions > 0 ? round(totalClicks / totalImpressions, 4) : 0,
    },
    timeSeries: (timeSeriesData.data ?? []).map((row) => ({
      date: row.date,
      impressions: row.impressions ?? 0,
      clicks: row.clicks ?? 0,
      ctr: row.impressions > 0 ? round((row.clicks ?? 0) / row.impressions, 4) : 0,
      spend: round(Number(row.spend ?? 0), 2),
      cpc: (row.clicks ?? 0) > 0 ? round(Number(row.spend ?? 0) / row.clicks, 4) : 0,
      cpm:
        (row.impressions ?? 0) > 0
          ? round((Number(row.spend ?? 0) / row.impressions) * 1000, 4)
          : 0,
    })),
    topPublishers,
    topAdvertisers,
    topCampaigns,
  };
}

async function getAdminTopPublishers(
  client: Client,
  filters: AdminAnalyticsFilters,
): Promise<BreakdownRow[]> {
  const { data, error } = await client
    .from("publisher_daily_stats")
    .select("publisher_id, publishers!inner(business_name), impressions, clicks, earnings")
    .gte("date", filters.dateRange.from)
    .lte("date", filters.dateRange.to);

  if (error || !data) return [];

  const publisherMap = new Map<
    string,
    { name: string; impressions: number; clicks: number; earnings: number }
  >();
  for (const row of data) {
    const name = (row.publishers as unknown as { business_name: string }).business_name;
    const existing = publisherMap.get(row.publisher_id) ?? {
      name,
      impressions: 0,
      clicks: 0,
      earnings: 0,
    };
    existing.impressions += row.impressions ?? 0;
    existing.clicks += row.clicks ?? 0;
    existing.earnings += Number(row.earnings ?? 0);
    publisherMap.set(row.publisher_id, existing);
  }

  return Array.from(publisherMap.entries())
    .map(([id, vals]) => ({
      id,
      name: vals.name,
      impressions: vals.impressions,
      clicks: vals.clicks,
      ctr: vals.impressions > 0 ? round(vals.clicks / vals.impressions, 4) : 0,
      spend: 0,
      cpc: 0,
      cpm: 0,
      earnings: round(vals.earnings, 2),
      rpm: vals.impressions > 0 ? round((vals.earnings / vals.impressions) * 1000, 4) : 0,
    }))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 10);
}

async function getAdminTopAdvertisers(
  client: Client,
  filters: AdminAnalyticsFilters,
): Promise<BreakdownRow[]> {
  const { data, error } = await client
    .from("campaign_daily_stats")
    .select("organization_id, organizations!inner(name), impressions, clicks, spend")
    .gte("date", filters.dateRange.from)
    .lte("date", filters.dateRange.to);

  if (error || !data) return [];

  const advertiserMap = new Map<
    string,
    { name: string; impressions: number; clicks: number; spend: number }
  >();
  for (const row of data) {
    const name = (row.organizations as unknown as { name: string }).name;
    const existing = advertiserMap.get(row.organization_id) ?? {
      name,
      impressions: 0,
      clicks: 0,
      spend: 0,
    };
    existing.impressions += row.impressions ?? 0;
    existing.clicks += row.clicks ?? 0;
    existing.spend += Number(row.spend ?? 0);
    advertiserMap.set(row.organization_id, existing);
  }

  return Array.from(advertiserMap.entries())
    .map(([id, vals]) => ({
      id,
      name: vals.name,
      impressions: vals.impressions,
      clicks: vals.clicks,
      ctr: vals.impressions > 0 ? round(vals.clicks / vals.impressions, 4) : 0,
      spend: round(vals.spend, 2),
      cpc: vals.clicks > 0 ? round(vals.spend / vals.clicks, 4) : 0,
      cpm: vals.impressions > 0 ? round((vals.spend / vals.impressions) * 1000, 4) : 0,
      earnings: 0,
      rpm: 0,
    }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 10);
}

async function getAdminTopCampaigns(
  client: Client,
  filters: AdminAnalyticsFilters,
): Promise<BreakdownRow[]> {
  const { data, error } = await client
    .from("campaign_daily_stats")
    .select("campaign_id, campaigns!inner(name), impressions, clicks, spend")
    .gte("date", filters.dateRange.from)
    .lte("date", filters.dateRange.to);

  if (error || !data) return [];

  const campaignMap = new Map<
    string,
    { name: string; impressions: number; clicks: number; spend: number }
  >();
  for (const row of data) {
    const name = (row.campaigns as unknown as { name: string }).name;
    const existing = campaignMap.get(row.campaign_id) ?? {
      name,
      impressions: 0,
      clicks: 0,
      spend: 0,
    };
    existing.impressions += row.impressions ?? 0;
    existing.clicks += row.clicks ?? 0;
    existing.spend += Number(row.spend ?? 0);
    campaignMap.set(row.campaign_id, existing);
  }

  return Array.from(campaignMap.entries())
    .map(([id, vals]) => ({
      id,
      name: vals.name,
      impressions: vals.impressions,
      clicks: vals.clicks,
      ctr: vals.impressions > 0 ? round(vals.clicks / vals.impressions, 4) : 0,
      spend: round(vals.spend, 2),
      cpc: vals.clicks > 0 ? round(vals.spend / vals.clicks, 4) : 0,
      cpm: vals.impressions > 0 ? round((vals.spend / vals.impressions) * 1000, 4) : 0,
      earnings: 0,
      rpm: 0,
    }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 10);
}

// ----------------------------------------------------------------- CSV export

export function buildAdvertiserCsv(
  data: AdvertiserAnalyticsResult,
  filters: AdvertiserAnalyticsFilters,
): string {
  const lines: string[] = [
    "Date,Impressions,Clicks,CTR,Spend,CPC,CPM",
    ...data.timeSeries.map((row) =>
      [
        row.date,
        row.impressions,
        row.clicks,
        formatPct(row.ctr),
        row.spend.toFixed(2),
        row.cpc.toFixed(4),
        row.cpm.toFixed(4),
      ].join(","),
    ),
    "",
    "Top Websites",
    "Website,Impressions,Clicks,CTR",
    ...data.topWebsites.map((row) =>
      [escapeCsv(row.name), row.impressions, row.clicks, formatPct(row.ctr)].join(","),
    ),
    "",
    "Top Ad Zones",
    "Zone,Impressions,Clicks,CTR",
    ...data.topZones.map((row) =>
      [escapeCsv(row.name), row.impressions, row.clicks, formatPct(row.ctr)].join(","),
    ),
    "",
    "Device Performance",
    "Device,Impressions",
    ...data.devicePerformance.map((row) => [escapeCsv(row.name), row.impressions].join(",")),
    "",
    "Country Performance",
    "Country,Impressions",
    ...data.countryPerformance.map((row) => [escapeCsv(row.name), row.impressions].join(",")),
  ];
  return lines.join("\n");
}

export function buildPublisherCsv(
  data: PublisherAnalyticsResult,
  filters: PublisherAnalyticsFilters,
): string {
  const lines: string[] = [
    "Date,Impressions,Clicks,CTR,Earnings,RPM",
    ...data.timeSeries.map((row) =>
      [
        row.date,
        row.impressions,
        row.clicks,
        formatPct(row.ctr),
        row.earnings.toFixed(2),
        row.rpm.toFixed(4),
      ].join(","),
    ),
    "",
    "Top Websites",
    "Website,Impressions,Clicks,CTR,Earnings,RPM",
    ...data.topWebsites.map((row) =>
      [
        escapeCsv(row.name),
        row.impressions,
        row.clicks,
        formatPct(row.ctr),
        row.earnings.toFixed(2),
        row.rpm.toFixed(4),
      ].join(","),
    ),
    "",
    "Top Ad Zones",
    "Zone,Impressions,Clicks,CTR",
    ...data.topZones.map((row) =>
      [escapeCsv(row.name), row.impressions, row.clicks, formatPct(row.ctr)].join(","),
    ),
    "",
    "Daily Earnings",
    "Date,Earnings",
    ...data.dailyEarnings.map((row) => [row.name, row.earnings.toFixed(2)].join(",")),
  ];
  return lines.join("\n");
}

export function buildAdminCsv(data: AdminAnalyticsResult, filters: AdminAnalyticsFilters): string {
  const lines: string[] = [
    "Date,Impressions,Clicks,CTR,Spend,CPC,CPM",
    ...data.timeSeries.map((row) =>
      [
        row.date,
        row.impressions,
        row.clicks,
        formatPct(row.ctr),
        row.spend.toFixed(2),
        row.cpc.toFixed(4),
        row.cpm.toFixed(4),
      ].join(","),
    ),
    "",
    "Top Publishers",
    "Publisher,Impressions,Clicks,CTR,Earnings,RPM",
    ...data.topPublishers.map((row) =>
      [
        escapeCsv(row.name),
        row.impressions,
        row.clicks,
        formatPct(row.ctr),
        row.earnings.toFixed(2),
        row.rpm.toFixed(4),
      ].join(","),
    ),
    "",
    "Top Advertisers",
    "Advertiser,Impressions,Clicks,CTR,Spend,CPC,CPM",
    ...data.topAdvertisers.map((row) =>
      [
        escapeCsv(row.name),
        row.impressions,
        row.clicks,
        formatPct(row.ctr),
        row.spend.toFixed(2),
        row.cpc.toFixed(4),
        row.cpm.toFixed(4),
      ].join(","),
    ),
    "",
    "Top Campaigns",
    "Campaign,Impressions,Clicks,CTR,Spend,CPC,CPM",
    ...data.topCampaigns.map((row) =>
      [
        escapeCsv(row.name),
        row.impressions,
        row.clicks,
        formatPct(row.ctr),
        row.spend.toFixed(2),
        row.cpc.toFixed(4),
        row.cpm.toFixed(4),
      ].join(","),
    ),
  ];
  return lines.join("\n");
}

// ----------------------------------------------------------------- helpers

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function formatPct(value: number): string {
  return (value * 100).toFixed(2) + "%";
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
