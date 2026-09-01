/**
 * Server-only platform settings service.
 *
 * Reads and writes the singleton platform_settings row. Billing-specific
 * helpers live in billing-service.server.ts so existing imports keep working.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { logAuditEvent } from "@/lib/audit-log.server";
import type { Ctx } from "@/lib/advertiser-service.server";

type Client = SupabaseClient<Database>;

export class SettingsError extends Error {}

function fail(message: string): never {
  throw new SettingsError(message);
}

async function admin(): Promise<Client> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Client;
}

export type PlatformSettings = {
  publisherRevenueShare: number;
  earningsHoldDays: number;
  minimumPayoutAmount: number;
  campaignMinimumBudget: number;
  minimumDailyBudget: number;
  startingCpc: number;
  currency: string;
  maximumBidAmount: number;
  maximumCampaignBudget: number;
  maximumDailyBudget: number;
  assumedCtr: number;
  defaultBidAmount: number;
  defaultTotalBudget: number;
  maximumCreativeSizeBytes: number;
  supportedCountries: string[];
  supportedCurrencies: string[];
  platformStatus: "active" | "maintenance" | "disabled";
};

function mapSettings(
  row: Database["public"]["Tables"]["platform_settings"]["Row"] | null,
): PlatformSettings {
  const r = row as any;
  return {
    publisherRevenueShare: Number(r?.publisher_revenue_share ?? 0.4),
    earningsHoldDays: r?.earnings_hold_days ?? 7,
    minimumPayoutAmount: Number(r?.minimum_payout_amount ?? 0),
    campaignMinimumBudget: Number(r?.campaign_minimum_budget ?? 300),
    minimumDailyBudget: Number(r?.minimum_daily_budget ?? 100),
    startingCpc: Number(r?.starting_cpc ?? 5),
    currency: r?.currency ?? "KES",
    maximumBidAmount: Number(r?.maximum_bid_amount ?? 10000),
    maximumCampaignBudget: Number(r?.maximum_campaign_budget ?? 100_000_000),
    maximumDailyBudget: Number(r?.maximum_daily_budget ?? 100_000_000),
    assumedCtr: Number(r?.assumed_ctr ?? 0.01),
    defaultBidAmount: Number(r?.default_bid_amount ?? 5),
    defaultTotalBudget: Number(r?.default_total_budget ?? 300),
    maximumCreativeSizeBytes: r?.maximum_creative_size_bytes ?? 5 * 1024 * 1024,
    supportedCountries: (r?.supported_countries as string[]) ?? ["KE", "NG", "ZA", "UG", "TZ", "GH", "RW"],
    supportedCurrencies: (r?.supported_currencies as string[]) ?? ["KES"],
    platformStatus: (r?.platform_status as PlatformSettings["platformStatus"]) ?? "active",
  };
}

export async function getPlatformSettings(ctx: Ctx): Promise<PlatformSettings> {
  const db = await admin();
  const { data, error } = await db.from("platform_settings").select("*").maybeSingle();
  if (error) fail("We couldn't load the platform settings.");
  return mapSettings(data);
}

export async function updatePlatformSettings(ctx: Ctx, input: Partial<PlatformSettings>) {
  await assertPlatformAdmin(ctx);
  const db = await admin();

  const patch: Record<string, unknown> = {};
  if (input.publisherRevenueShare !== undefined)
    patch["publisher_revenue_share"] = input.publisherRevenueShare;
  if (input.earningsHoldDays !== undefined) patch["earnings_hold_days"] = input.earningsHoldDays;
  if (input.minimumPayoutAmount !== undefined)
    patch["minimum_payout_amount"] = input.minimumPayoutAmount;
  if (input.campaignMinimumBudget !== undefined)
    patch["campaign_minimum_budget"] = input.campaignMinimumBudget;
  if (input.minimumDailyBudget !== undefined)
    patch["minimum_daily_budget"] = input.minimumDailyBudget;
  if (input.startingCpc !== undefined) patch["starting_cpc"] = input.startingCpc;
  if (input.currency !== undefined) patch["currency"] = input.currency;
  if (input.maximumBidAmount !== undefined)
    patch["maximum_bid_amount"] = input.maximumBidAmount;
  if (input.maximumCampaignBudget !== undefined)
    patch["maximum_campaign_budget"] = input.maximumCampaignBudget;
  if (input.maximumDailyBudget !== undefined)
    patch["maximum_daily_budget"] = input.maximumDailyBudget;
  if (input.assumedCtr !== undefined) patch["assumed_ctr"] = input.assumedCtr;
  if (input.defaultBidAmount !== undefined)
    patch["default_bid_amount"] = input.defaultBidAmount;
  if (input.defaultTotalBudget !== undefined)
    patch["default_total_budget"] = input.defaultTotalBudget;
  if (input.maximumCreativeSizeBytes !== undefined)
    patch["maximum_creative_size_bytes"] = input.maximumCreativeSizeBytes;
  if (input.supportedCountries !== undefined)
    patch["supported_countries"] = input.supportedCountries;
  if (input.supportedCurrencies !== undefined)
    patch["supported_currencies"] = input.supportedCurrencies;
  if (input.platformStatus !== undefined) patch["platform_status"] = input.platformStatus;

  if (Object.keys(patch).length === 0) fail("Nothing to update.");

  const { data, error } = await (db as any)
    .from("platform_settings")
    .update(patch)
    .select("*")
    .maybeSingle();
  if (error) fail("We couldn't update the platform settings.");
  if (!data) fail("Platform settings not found.");

  const { logAuditEvent } = await import("@/lib/audit-log.server");
  await logAuditEvent(ctx, {
    action: "settings.platform.update",
    targetType: "platform_settings",
    targetId: "platform_settings",
    metadata: patch,
  });

  return mapSettings(data);
}

export async function assertPlatformAdmin(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("is_platform_admin", { _user_id: ctx.userId });
  if (error) fail("We couldn't verify your permissions.");
  if (!data) fail("This action requires platform admin access.");
}

export async function assertPlatformStaff(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("is_platform_staff", { _user_id: ctx.userId });
  if (error) fail("We couldn't verify your permissions.");
  if (!data) fail("This area requires platform staff access.");
}
