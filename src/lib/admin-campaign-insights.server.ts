import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

export type AdminCampaignInsightsFilters = { dateRange: { from: string; to: string } };
export type CampaignInsight = {
  id: string; name: string; status: string; objective: string | null;
  bidType: string | null; bidAmount: number; dailyBudget: number; totalBudget: number;
  spentAmount: number; impressions: number; clicks: number; conversions: number;
  ctr: number; cpc: number; cpm: number; remainingBudget: number;
  startDate: string | null; endDate: string | null; advertiserId: string | null;
};
export type InsightBreakdown = { name: string; impressions: number; clicks: number; ctr: number };
export type AdminCampaignInsights = {
  campaigns: CampaignInsight[];
  countries: InsightBreakdown[];
  devices: InsightBreakdown[];
  browsers: InsightBreakdown[];
  operatingSystems: InsightBreakdown[];
  publishers: InsightBreakdown[];
};

const round = (value: number, places = 2) => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

export async function getAdminCampaignInsights(
  db: Client,
  filters: AdminCampaignInsightsFilters,
): Promise<AdminCampaignInsights> {
  const from = `${filters.dateRange.from}T00:00:00Z`;
  const to = `${filters.dateRange.to}T23:59:59Z`;
  const [campaignResult, statsResult, impressionsResult] = await Promise.all([
    db.from("campaigns").select(
      "id,name,status,objective,bid_type,bid_amount,daily_budget,total_budget,spent_amount,impressions_count,clicks_count,start_date,end_date,advertiser_id",
    ).order("created_at", { ascending: false }),
    db.from("campaign_daily_stats").select("campaign_id,impressions,clicks,spend,conversions")
      .gte("date", filters.dateRange.from).lte("date", filters.dateRange.to),
    db.from("impressions").select(
      "campaign_id,country,device_type,browser,operating_system,website_id,websites(name),created_at",
    ).eq("is_likely_bot", false).gte("created_at", from).lte("created_at", to),
  ]);

  if (campaignResult.error) throw new Error("Unable to load campaign records.");
  if (statsResult.error) throw new Error("Unable to load campaign performance.");
  if (impressionsResult.error) throw new Error("Unable to load audience insights.");

  const totals = new Map<string, { impressions: number; clicks: number; spend: number; conversions: number }>();
  for (const row of statsResult.data ?? []) {
    const value = totals.get(row.campaign_id) ?? { impressions: 0, clicks: 0, spend: 0, conversions: 0 };
    value.impressions += row.impressions ?? 0;
    value.clicks += row.clicks ?? 0;
    value.spend += Number(row.spend ?? 0);
    value.conversions += row.conversions ?? 0;
    totals.set(row.campaign_id, value);
  }

  const campaigns = (campaignResult.data ?? []).map((campaign) => {
    const value = totals.get(campaign.id) ?? { impressions: 0, clicks: 0, spend: 0, conversions: 0 };
    const impressions = value.impressions;
    const clicks = value.clicks;
    const spend = round(value.spend);
    const totalBudget = Number(campaign.total_budget ?? 0);
    return {
      id: campaign.id, name: campaign.name, status: campaign.status,
      objective: campaign.objective, bidType: campaign.bid_type,
      bidAmount: Number(campaign.bid_amount ?? 0), dailyBudget: Number(campaign.daily_budget ?? 0),
      totalBudget, spentAmount: spend,
      impressions, clicks, conversions: value.conversions,
      ctr: impressions ? round(clicks / impressions, 4) : 0,
      cpc: clicks ? round(spend / clicks, 4) : 0,
      cpm: impressions ? round((spend / impressions) * 1000, 4) : 0,
      remainingBudget: round(Math.max(0, totalBudget - Number(campaign.spent_amount ?? 0))),
      startDate: campaign.start_date, endDate: campaign.end_date, advertiserId: campaign.advertiser_id,
    };
  }).sort((a, b) => b.spendAmount - a.spendAmount);

  const aggregate = (key: "country" | "device_type" | "browser" | "operating_system" | "website_id") => {
    const map = new Map<string, { impressions: number; clicks: number }>();
    for (const row of impressionsResult.data ?? []) {
      const raw = row[key];
      if (!raw) continue;
      const name = String(raw);
      const current = map.get(name) ?? { impressions: 0, clicks: 0 };
      current.impressions += 1;
      map.set(name, current);
    }
    return Array.from(map.entries()).map(([name, value]) => ({
      name, impressions: value.impressions, clicks: value.clicks,
      ctr: value.impressions ? round(value.clicks / value.impressions, 4) : 0,
    })).sort((a, b) => b.impressions - a.impressions).slice(0, 15);
  };

  const publishersMap = new Map<string, number>();
  for (const row of impressionsResult.data ?? []) {
    const name = (row.websites as unknown as { name?: string } | null)?.name;
    if (name) publishersMap.set(name, (publishersMap.get(name) ?? 0) + 1);
  }
  const publishers = Array.from(publishersMap.entries())
    .map(([name, impressions]) => ({ name, impressions, clicks: 0, ctr: 0 }))
    .sort((a, b) => b.impressions - a.impressions).slice(0, 15);

  return {
    campaigns,
    countries: aggregate("country"),
    devices: aggregate("device_type"),
    browsers: aggregate("browser"),
    operatingSystems: aggregate("operating_system"),
    publishers,
  };
}
