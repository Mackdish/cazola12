/**
 * Server-only advertiser service.
 *
 * Callers pass an authenticated Supabase client, so RLS scopes every read and
 * write to the signed-in user's organizations. Admin-only actions additionally
 * assert platform roles before touching gated columns.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import {
  adFormatSpec,
  assertTransition,
  normalizeDestinationUrl,
  validateCreativeAgainstFormat,
  type AdFormat,
  type BidType,
  type BrowserType,
  type CampaignObjective,
  type CampaignStatus,
  type DeviceType,
  type OsType,
} from "@/lib/advertiser-domain";
import type { WebsiteCategory } from "@/lib/publisher-domain";

type Client = SupabaseClient<Database>;
type CampaignUpdate = Database["public"]["Tables"]["campaigns"]["Update"];
type AdUpdate = Database["public"]["Tables"]["ads"]["Update"];

export type Ctx = { supabase: Client; userId: string };

export class ServiceError extends Error {}

function fail(message: string): never {
  throw new ServiceError(message);
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Client;
}

async function loadPlatformSettings(ctx: Ctx) {
  const { data, error } = await ctx.supabase.from("platform_settings").select("*").maybeSingle();
  if (error) fail("We couldn't load platform settings.");
  const r = data as any;
  return {
    campaignMinimumBudget: Number(r?.campaign_minimum_budget ?? 500),
    minimumDailyBudget: Number(r?.minimum_daily_budget ?? 100),
    startingCpc: Number(r?.starting_cpc ?? 5),
    currency: r?.currency ?? "KES",
    maximumBidAmount: Number(r?.maximum_bid_amount ?? 10_000),
    maximumCampaignBudget: Number(r?.maximum_campaign_budget ?? 100_000_000),
    maximumDailyBudget: Number(r?.maximum_daily_budget ?? 100_000_000),
  };
}

// -------------------------------------------------------------- advertiser

/** Verifies the signed-in user belongs to the organization (trusted lookup). */
async function assertOrgMember(ctx: Ctx, organizationId: string) {
  const db = await admin();
  const { data, error } = await db
    .from("organization_members")
    .select("id, role, status")
    .eq("organization_id", organizationId)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (error) fail("We couldn't verify your organization access.");
  if (!data || data.status !== "active")
    fail("You don't have permission to manage this organization.");
  return data;
}

export async function getAdvertiserProfile(ctx: Ctx, organizationId: string) {
  await assertOrgMember(ctx, organizationId);
  const db = await admin();
  const { data, error } = await db
    .from("advertisers")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) fail("We couldn't load your advertiser profile.");
  return data ?? null;
}

export async function saveAdvertiserProfile(
  ctx: Ctx,
  input: {
    organizationId: string;
    businessName: string;
    contactEmail: string;
    industry?: string | null | undefined;
    contactPhone?: string | null | undefined;
  },
) {
  await assertOrgMember(ctx, input.organizationId);
  const db = await admin();
  const { data, error } = await db.rpc("ensure_advertiser", {
    _organization_id: input.organizationId,
    _business_name: input.businessName,
    _contact_email: input.contactEmail,
    ...(input.industry ? { _industry: input.industry } : {}),
    ...(input.contactPhone ? { _contact_phone: input.contactPhone } : {}),
  });
  if (error) {
    if (/not authorized/i.test(error.message))
      fail("You don't have permission to manage this organization.");
    if (/not an advertiser/i.test(error.message))
      fail("This organization isn't an advertiser organization.");
    fail("We couldn't save your advertiser profile. Please try again.");
  }
  return Array.isArray(data) ? data[0]! : data!;
}


export async function requireAdvertiser(ctx: Ctx, organizationId: string) {
  const advertiser = await getAdvertiserProfile(ctx, organizationId);
  if (!advertiser) fail("Complete your advertiser profile before continuing.");
  return advertiser;
}

// ---------------------------------------------------------------- campaigns

export async function listCampaigns(ctx: Ctx, organizationId: string) {
  const { data, error } = await ctx.supabase
    .from("campaigns")
    .select("*, ads(id, status, approval_status), ad_groups(id)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (error) fail("We couldn't load your campaigns.");
  return (data ?? []).map((row) => {
    const { ads, ad_groups, ...campaign } = row as typeof row & {
      ads: Array<{ id: string }>;
      ad_groups: Array<{ id: string }>;
    };
    return { ...campaign, adCount: ads?.length ?? 0, adGroupCount: ad_groups?.length ?? 0 };
  });
}

export async function getCampaignDetail(ctx: Ctx, campaignId: string) {
  const campaign = await ctx.supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .maybeSingle();
  if (campaign.error) fail("We couldn't load that campaign.");
  if (!campaign.data) fail("That campaign doesn't exist, or you don't have access to it.");

  const [groups, ads, targeting, assets] = await Promise.all([
    ctx.supabase.from("ad_groups").select("*").eq("campaign_id", campaignId).order("created_at"),
    ctx.supabase
      .from("ads")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false }),
    ctx.supabase.from("campaign_targeting").select("*").eq("campaign_id", campaignId).maybeSingle(),
    ctx.supabase
      .from("media_assets")
      .select("*")
      .eq("organization_id", campaign.data.organization_id)
      .order("created_at", { ascending: false }),
  ]);
  if (groups.error) fail("We couldn't load ad groups.");
  if (ads.error) fail("We couldn't load ads.");
  if (targeting.error) fail("We couldn't load targeting.");
  if (assets.error) fail("We couldn't load creatives.");

  return {
    campaign: campaign.data,
    adGroups: groups.data ?? [],
    ads: ads.data ?? [],
    targeting: targeting.data ?? null,
    mediaAssets: assets.data ?? [],
  };
}

export async function createCampaign(
  ctx: Ctx,
  input: {
    organizationId: string;
    name: string;
    objective: CampaignObjective;
    bidType: BidType;
    bidAmount: number;
    totalBudget: number;
    dailyBudget?: number | null | undefined;
    startDate?: string | null | undefined;
    endDate?: string | null | undefined;
    landingPageUrl: string;
  },
) {
  const advertiser = await requireAdvertiser(ctx, input.organizationId);
  const db = await admin();
  const landing = normalizeDestinationUrl(input.landingPageUrl);
  if (!landing) fail("Enter a valid https landing page URL.");
  if (input.startDate && input.endDate && input.endDate < input.startDate) {
    fail("The end date must come after the start date.");
  }
  if (input.dailyBudget && input.dailyBudget > input.totalBudget) {
    fail("The daily budget can't exceed the total budget.");
  }

  const settings = await loadPlatformSettings(ctx);
  if (input.totalBudget < settings.campaignMinimumBudget) {
    fail(`Total budget must be at least ${settings.campaignMinimumBudget}.`);
  }
  if (input.dailyBudget && input.dailyBudget < settings.minimumDailyBudget) {
    fail(`Daily budget must be at least ${settings.minimumDailyBudget}.`);
  }
  if (input.bidAmount < settings.startingCpc) {
    fail(`Bid amount must be at least ${settings.startingCpc}.`);
  }
  if (input.bidAmount > settings.maximumBidAmount) {
    fail(`Bid amount cannot exceed ${settings.maximumBidAmount}.`);
  }
  if (input.totalBudget > settings.maximumCampaignBudget) {
    fail(`Total budget cannot exceed ${settings.maximumCampaignBudget}.`);
  }
  if (input.dailyBudget && input.dailyBudget > settings.maximumDailyBudget) {
    fail(`Daily budget cannot exceed ${settings.maximumDailyBudget}.`);
  }

  const { data, error } = await db
    .from("campaigns")
    .insert({
      advertiser_id: advertiser.id,
      organization_id: input.organizationId,
      name: input.name.trim(),
      objective: input.objective,
      bid_type: input.bidType,
      bid_amount: input.bidAmount,
      total_budget: input.totalBudget,
      daily_budget: input.dailyBudget ?? null,
      start_date: input.startDate ?? null,
      end_date: input.endDate ?? null,
      landing_page_url: landing,
      status: "draft",
    })
    .select("*")
    .single();
  if (error) {
    if (error.code === "42501") fail("You don't have permission to create campaigns here.");
    if (error.code === "23503")
      fail("A required record is missing. Please complete your organization setup first.");
    fail(`Campaign creation failed: ${error.message ?? "Please try again."}`);
  }

  // Every campaign starts with a default ad group so ads always have a home.
  const { error: groupError } = await db.from("ad_groups").insert({
    campaign_id: data!.id,
    organization_id: input.organizationId,
    name: "Default ad group",
    status: "active",
  });
  if (groupError) {
    fail(`Could not create default ad group: ${groupError.message}`);
  }

  return data!;
}

export async function updateCampaign(
  ctx: Ctx,
  input: {
    campaignId: string;
    name?: string | undefined;
    objective?: CampaignObjective | undefined;
    bidType?: BidType | undefined;
    bidAmount?: number | undefined;
    totalBudget?: number | undefined;
    dailyBudget?: number | null | undefined;
    startDate?: string | null | undefined;
    endDate?: string | null | undefined;
    landingPageUrl?: string | undefined;
  },
) {
  const current = await loadOwnCampaign(ctx, input.campaignId);
  if (current.status !== "draft" && current.status !== "rejected") {
    fail("Only draft or rejected campaigns can be edited. Pause the campaign first.");
  }

  const patch: CampaignUpdate = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.objective !== undefined) patch.objective = input.objective;
  if (input.bidType !== undefined) patch.bid_type = input.bidType;
  if (input.bidAmount !== undefined) patch.bid_amount = input.bidAmount;
  if (input.totalBudget !== undefined) patch.total_budget = input.totalBudget;
  if (input.dailyBudget !== undefined) patch.daily_budget = input.dailyBudget;
  if (input.startDate !== undefined) patch.start_date = input.startDate;
  if (input.endDate !== undefined) patch.end_date = input.endDate;
  if (input.landingPageUrl !== undefined) {
    const landing = normalizeDestinationUrl(input.landingPageUrl);
    if (!landing) fail("Enter a valid https landing page URL.");
    patch.landing_page_url = landing;
  }
  if (Object.keys(patch).length === 0) fail("Nothing to update.");

  const settings = await loadPlatformSettings(ctx);
  const newTotal = input.totalBudget ?? Number(current.total_budget);
  const newDaily = input.dailyBudget ?? (current.daily_budget ? Number(current.daily_budget) : null);
  const newBid = input.bidAmount ?? Number(current.bid_amount);

  if (newTotal < settings.campaignMinimumBudget) {
    fail(`Total budget must be at least ${settings.campaignMinimumBudget}.`);
  }
  if (newDaily !== null && newDaily < settings.minimumDailyBudget) {
    fail(`Daily budget must be at least ${settings.minimumDailyBudget}.`);
  }
  if (newBid < settings.startingCpc) {
    fail(`Bid amount must be at least ${settings.startingCpc}.`);
  }
  if (newBid > settings.maximumBidAmount) {
    fail(`Bid amount cannot exceed ${settings.maximumBidAmount}.`);
  }
  if (newTotal > settings.maximumCampaignBudget) {
    fail(`Total budget cannot exceed ${settings.maximumCampaignBudget}.`);
  }
  if (newDaily !== null && newDaily > settings.maximumDailyBudget) {
    fail(`Daily budget cannot exceed ${settings.maximumDailyBudget}.`);
  }

  const db = await admin();
  const { data, error } = await db
    .from("campaigns")
    .update(patch)
    .eq("id", input.campaignId)
    .select("*")
    .maybeSingle();
  if (error) fail("We couldn't update that campaign.");
  if (!data) fail("That campaign doesn't exist, or you don't have access to it.");
  return data;
}

async function loadOwnCampaign(ctx: Ctx, campaignId: string) {
  const db = await admin();
  const { data, error } = await db
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .maybeSingle();
  if (error) fail("We couldn't load that campaign.");
  if (!data) fail("That campaign doesn't exist, or you don't have access to it.");
  return data;
}

/** Advertiser-driven lifecycle move (submit, pause, resume, complete, rework). */
export async function setCampaignStatus(
  ctx: Ctx,
  input: { campaignId: string; status: CampaignStatus },
) {
  const current = await loadOwnCampaign(ctx, input.campaignId);
  try {
    assertTransition(current.status, input.status, "advertiser");
  } catch (error) {
    fail(error instanceof Error ? error.message : "That status change isn't allowed.");
  }

  if (input.status === "pending_review") {
    await assertCampaignSubmittable(ctx, current.id);
  }

  const patch: CampaignUpdate = { status: input.status };
  if (input.status === "pending_review") patch.submitted_at = new Date().toISOString();

  const db = await admin();
  const { data, error } = await db
    .from("campaigns")
    .update(patch)
    .eq("id", input.campaignId)
    .select("*")
    .maybeSingle();
  if (error) fail("We couldn't update that campaign.");
  if (!data) fail("That campaign doesn't exist, or you don't have access to it.");
  return data;
}

async function assertCampaignSubmittable(ctx: Ctx, campaignId: string) {
  const campaign = await loadOwnCampaign(ctx, campaignId);
  if (!campaign.landing_page_url) fail("Add a landing page URL before submitting.");
  if (Number(campaign.total_budget) <= 0) fail("Set a total budget before submitting.");
  if (Number(campaign.bid_amount) <= 0) fail("Set a bid amount before submitting.");

  const settings = await loadPlatformSettings(ctx);
  if (Number(campaign.total_budget) < settings.campaignMinimumBudget) {
    fail(`Total budget must be at least ${settings.campaignMinimumBudget}.`);
  }
  if (campaign.daily_budget && Number(campaign.daily_budget) < settings.minimumDailyBudget) {
    fail(`Daily budget must be at least ${settings.minimumDailyBudget}.`);
  }
  if (Number(campaign.bid_amount) < settings.startingCpc) {
    fail(`Bid amount must be at least ${settings.startingCpc}.`);
  }

  const { data: ads, error } = await ctx.supabase
    .from("ads")
    .select("id, media_asset_id")
    .eq("campaign_id", campaignId);
  if (error) fail("We couldn't check this campaign's ads.");
  if (!ads || ads.length === 0) fail("Add at least one ad before submitting.");
  if (ads.some((ad) => !ad.media_asset_id)) fail("Every ad needs a creative before submitting.");
}

// ---------------------------------------------------------------- ad groups

export async function createAdGroup(ctx: Ctx, input: { campaignId: string; name: string }) {
  const campaign = await loadOwnCampaign(ctx, input.campaignId);
  const { data, error } = await ctx.supabase
    .from("ad_groups")
    .insert({
      campaign_id: campaign.id,
      organization_id: campaign.organization_id,
      name: input.name.trim(),
    })
    .select("*")
    .single();
  if (error) {
    if (error.code === "42501") fail("You don't have permission to create ad groups here.");
    fail("We couldn't create that ad group.");
  }
  return data!;
}

export async function setAdGroupStatus(
  ctx: Ctx,
  input: { adGroupId: string; status: "active" | "suspended" },
) {
  const { data, error } = await ctx.supabase
    .from("ad_groups")
    .update({ status: input.status })
    .eq("id", input.adGroupId)
    .select("*")
    .maybeSingle();
  if (error) fail("We couldn't update that ad group.");
  if (!data) fail("That ad group doesn't exist, or you don't have access to it.");
  return data;
}

// --------------------------------------------------------------------- ads

export async function listAds(ctx: Ctx, organizationId: string) {
  const { data, error } = await ctx.supabase
    .from("ads")
    .select(
      "*, campaigns(id, name, status), ad_groups(id, name), media_assets!ads_media_asset_id_fkey(id, file_name, width, height, mime_type)",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (error) fail("We couldn't load your ads.");
  return data ?? [];
}

export async function createAd(
  ctx: Ctx,
  input: {
    campaignId: string;
    adGroupId: string;
    name: string;
    format: AdFormat;
    destinationUrl: string;
    mediaAssetId?: string | null | undefined;
    adType?: string | null | undefined;
    brandName?: string | null | undefined;
    logoMediaAssetId?: string | null | undefined;
    headlines?: string[] | null | undefined;
    longHeadline?: string | null | undefined;
    descriptions?: string[] | null | undefined;
    cta?: string | null | undefined;
    trackingUrl?: string | null | undefined;
    optimization?: string | null | undefined;
  },
) {
  const campaign = await loadOwnCampaign(ctx, input.campaignId);
  const destination = normalizeDestinationUrl(input.destinationUrl);
  if (!destination) fail("Enter a valid https destination URL.");

  const group = await ctx.supabase
    .from("ad_groups")
    .select("id, campaign_id")
    .eq("id", input.adGroupId)
    .maybeSingle();
  if (group.error) fail("We couldn't load that ad group.");
  if (!group.data || group.data.campaign_id !== campaign.id)
    fail("That ad group isn't part of this campaign.");

  if (input.mediaAssetId)
    await assertCreativeFits(ctx, input.mediaAssetId, campaign.organization_id, input.format);

  const adType = (input.adType ?? "static_image") as Database["public"]["Enums"]["ad_type"];

  const { data, error } = await ctx.supabase
    .from("ads")
    .insert({
      campaign_id: campaign.id,
      ad_group_id: group.data.id,
      organization_id: campaign.organization_id,
      name: input.name.trim(),
      format: input.format,
      ad_type: adType,
      destination_url: destination,
      media_asset_id: input.mediaAssetId ?? null,
      brand_name: input.brandName?.trim() ?? null,
      logo_media_asset_id: input.logoMediaAssetId ?? null,
      headlines: (input.headlines ?? []) as never,
      long_headline: input.longHeadline?.trim() ?? null,
      descriptions: (input.descriptions ?? []) as never,
      cta: input.cta?.trim() ?? null,
      tracking_url: input.trackingUrl?.trim() ?? null,
      optimization: input.optimization ?? "auto_optimize",
    })
    .select("*")
    .single();
  if (error) {
    if (error.code === "42501") fail("You don't have permission to create ads here.");
    fail(`We couldn't create that ad: ${error.message ?? "Please try again."}`);
  }

  if (input.mediaAssetId) {
    await ctx.supabase
      .from("media_assets")
      .update({ ad_id: data!.id, campaign_id: campaign.id })
      .eq("id", input.mediaAssetId);
  }
  return data!;
}

async function assertCreativeFits(
  ctx: Ctx,
  mediaAssetId: string,
  organizationId: string,
  format: AdFormat,
) {
  const { data, error } = await ctx.supabase
    .from("media_assets")
    .select("id, organization_id, width, height, status")
    .eq("id", mediaAssetId)
    .maybeSingle();
  if (error) fail("We couldn't load that creative.");
  if (!data || data.organization_id !== organizationId)
    fail("That creative doesn't belong to your organization.");
  if (data.status !== "ready") fail("That creative isn't available.");
  if (data.width === null || data.height === null)
    fail("That creative has no readable dimensions.");
  const check = validateCreativeAgainstFormat(format, { width: data.width, height: data.height });
  if (!check.ok) fail(check.message);
  // touch the spec so unknown formats fail loudly
  adFormatSpec(format);
}

export async function attachCreativeToAd(ctx: Ctx, input: { adId: string; mediaAssetId: string }) {
  const ad = await ctx.supabase.from("ads").select("*").eq("id", input.adId).maybeSingle();
  if (ad.error) fail("We couldn't load that ad.");
  if (!ad.data) fail("That ad doesn't exist, or you don't have access to it.");
  await assertCreativeFits(ctx, input.mediaAssetId, ad.data.organization_id, ad.data.format);

  const { data, error } = await ctx.supabase
    .from("ads")
    .update({ media_asset_id: input.mediaAssetId })
    .eq("id", input.adId)
    .select("*")
    .maybeSingle();
  if (error || !data) fail("We couldn't attach that creative.");

  await ctx.supabase
    .from("media_assets")
    .update({ ad_id: data.id, campaign_id: data.campaign_id })
    .eq("id", input.mediaAssetId);
  return data;
}

export async function setAdStatus(
  ctx: Ctx,
  input: { adId: string; status: "active" | "suspended" | "pending" },
) {
  const { data, error } = await ctx.supabase
    .from("ads")
    .update({ status: input.status })
    .eq("id", input.adId)
    .select("*")
    .maybeSingle();
  if (error) fail("We couldn't update that ad.");
  if (!data) fail("That ad doesn't exist, or you don't have access to it.");
  return data;
}

// --------------------------------------------------------------- targeting

export async function saveTargeting(
  ctx: Ctx,
  input: {
    campaignId: string;
    countries: string[];
    counties: string[];
    cities: string[];
    devices: DeviceType[];
    operatingSystems: OsType[];
    browsers: BrowserType[];
    websiteCategories: WebsiteCategory[];
    schedule: Record<string, Array<{ start: number; end: number }>>;
  },
) {
  const campaign = await loadOwnCampaign(ctx, input.campaignId);
  const row = {
    campaign_id: campaign.id,
    organization_id: campaign.organization_id,
    countries: input.countries,
    counties: input.counties,
    cities: input.cities,
    devices: input.devices,
    operating_systems: input.operatingSystems,
    browsers: input.browsers,
    website_categories: input.websiteCategories,
    schedule: input.schedule,
  };
  const { data, error } = await ctx.supabase
    .from("campaign_targeting")
    .upsert(row, { onConflict: "campaign_id" })
    .select("*")
    .single();
  if (error) {
    if (error.code === "42501") fail("You don't have permission to change targeting here.");
    fail("We couldn't save targeting. Please try again.");
  }
  return data!;
}

// ------------------------------------------------------------------- admin

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

export async function adminListAdvertisers(ctx: Ctx) {
  await assertPlatformStaff(ctx);
  const { data, error } = await ctx.supabase
    .from("advertisers")
    .select("*, organizations(id, name, slug, status), campaigns(id, status, approval_status)")
    .order("created_at", { ascending: false });
  if (error) fail("We couldn't load advertisers.");
  return data ?? [];
}

export async function adminListCampaigns(ctx: Ctx) {
  await assertPlatformStaff(ctx);
  const { data, error } = await ctx.supabase
    .from("campaigns")
    .select("*, advertisers(id, business_name, approval_status), ads(*), organizations(id, name)")
    .order("created_at", { ascending: false });
  if (error) fail("We couldn't load campaigns.");
  return data ?? [];
}

export async function adminGetCampaignDetail(ctx: Ctx, campaignId: string) {
  await assertPlatformStaff(ctx);
  const campaign = await ctx.supabase
    .from("campaigns")
    .select(
      "*, advertisers(id, business_name, contact_email, approval_status), organizations(id, name)",
    )
    .eq("id", campaignId)
    .maybeSingle();
  if (campaign.error) fail("We couldn't load that campaign.");
  if (!campaign.data) fail("That campaign doesn't exist.");

  const [ads, targeting] = await Promise.all([
    ctx.supabase
      .from("ads")
      .select("*, media_assets!ads_media_asset_id_fkey(*)")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false }),
    ctx.supabase.from("campaign_targeting").select("*").eq("campaign_id", campaignId).maybeSingle(),
  ]);
  if (ads.error) fail("We couldn't load that campaign's ads.");
  if (targeting.error) fail("We couldn't load that campaign's targeting.");

  return { campaign: campaign.data, ads: ads.data ?? [], targeting: targeting.data ?? null };
}

/** Approve / reject / pause / reactivate — the only path that writes gated columns. */
export async function adminReviewCampaign(
  ctx: Ctx,
  input: {
    campaignId: string;
    action: "approve" | "reject" | "pause" | "reactivate" | "complete";
    reason?: string | null | undefined;
  },
) {
  await assertPlatformAdmin(ctx);
  const current = await ctx.supabase
    .from("campaigns")
    .select("id, status, name")
    .eq("id", input.campaignId)
    .maybeSingle();
  if (current.error) fail("We couldn't load that campaign.");
  if (!current.data) fail("That campaign doesn't exist.");

  const target: CampaignStatus =
    input.action === "approve"
      ? "approved"
      : input.action === "reject"
        ? "rejected"
        : input.action === "pause"
          ? "paused"
          : input.action === "complete"
            ? "completed"
            : "active";

  if (input.action === "reject" && !(input.reason ?? "").trim()) {
    fail("A rejection reason is required.");
  }

  try {
    assertTransition(current.data.status, target, "admin");
  } catch (error) {
    fail(error instanceof Error ? error.message : "That status change isn't allowed.");
  }

  const patch: CampaignUpdate = {
    status: target,
    reviewed_at: new Date().toISOString(),
    rejection_reason: input.action === "reject" ? (input.reason ?? "").trim() : null,
  };
  if (input.action === "approve") patch.approval_status = "approved";
  if (input.action === "reject") patch.approval_status = "rejected";

  const service = await admin();
  const { data, error } = await service
    .from("campaigns")
    .update(patch)
    .eq("id", input.campaignId)
    .select("*")
    .maybeSingle();
  if (error) fail("We couldn't save that review.");
  if (!data) fail("That campaign doesn't exist.");

  const { logAuditEvent } = await import("@/lib/audit-log.server");
  await logAuditEvent(ctx, {
    action: `campaign.${input.action}`,
    targetType: "campaign",
    targetId: input.campaignId,
    targetLabel: current.data.name,
    metadata: { fromStatus: current.data.status, toStatus: target, reason: input.reason ?? null },
  });

  const adPatch: AdUpdate =
    input.action === "approve"
      ? { approval_status: "approved", status: "active" }
      : input.action === "reject"
        ? {
            approval_status: "rejected",
            status: "suspended",
            rejection_reason: (input.reason ?? "").trim(),
          }
        : {};
  if (Object.keys(adPatch).length > 0) {
    await service.from("ads").update(adPatch).eq("campaign_id", input.campaignId);
  }

  return data;
}

export async function adminReviewAdvertiser(
  ctx: Ctx,
  input: {
    advertiserId: string;
    approvalStatus?: "pending" | "approved" | "rejected" | undefined;
    status?: "active" | "pending" | "suspended" | undefined;
    reason?: string | null | undefined;
  },
) {
  await assertPlatformAdmin(ctx);
  if (input.approvalStatus === "rejected" && !(input.reason ?? "").trim()) {
    fail("A rejection reason is required.");
  }
  const patch: Database["public"]["Tables"]["advertisers"]["Update"] = {};
  if (input.approvalStatus) patch.approval_status = input.approvalStatus;
  if (input.status) patch.status = input.status;
  if (input.reason !== undefined) patch.rejection_reason = input.reason?.trim() || null;
  if (Object.keys(patch).length === 0) fail("Nothing to update.");

  const service = await admin();
  const { data, error } = await service
    .from("advertisers")
    .update(patch)
    .eq("id", input.advertiserId)
    .select("*")
    .maybeSingle();
  if (error) fail("We couldn't update that advertiser.");
  if (!data) fail("That advertiser doesn't exist.");

  const { logAuditEvent } = await import("@/lib/audit-log.server");
  await logAuditEvent(ctx, {
    action: `advertiser.${input.approvalStatus ?? input.status ?? "update"}`,
    targetType: "advertiser",
    targetId: input.advertiserId,
    metadata: { patch, reason: input.reason ?? null },
  });

  return data;
}

export async function adminReviewAd(
  ctx: Ctx,
  input: { adId: string; action: "approve" | "reject"; reason?: string | null | undefined },
) {
  await assertPlatformAdmin(ctx);
  if (input.action === "reject" && !(input.reason ?? "").trim())
    fail("A rejection reason is required.");
  const service = await admin();
  const { data, error } = await service
    .from("ads")
    .update(
      input.action === "approve"
        ? { approval_status: "approved", status: "active", rejection_reason: null }
        : {
            approval_status: "rejected",
            status: "suspended",
            rejection_reason: (input.reason ?? "").trim(),
          },
    )
    .eq("id", input.adId)
    .select("*")
    .maybeSingle();
  if (error) fail("We couldn't save that review.");
  if (!data) fail("That ad doesn't exist.");

  const { logAuditEvent } = await import("@/lib/audit-log.server");
  await logAuditEvent(ctx, {
    action: `ad.${input.action}`,
    targetType: "ad",
    targetId: input.adId,
    metadata: { reason: input.reason ?? null },
  });

  return data;
}

export async function adminGetAdvertiserDetail(ctx: Ctx, advertiserId: string) {
  await assertPlatformStaff(ctx);
  const advertiser = await ctx.supabase
    .from("advertisers")
    .select("*, organizations(id, name, slug, status)")
    .eq("id", advertiserId)
    .maybeSingle();
  if (advertiser.error) fail("We couldn't load that advertiser.");
  if (!advertiser.data) fail("That advertiser doesn't exist.");

  const [campaigns, spend] = await Promise.all([
    ctx.supabase
      .from("campaigns")
      .select("*, ads(*), campaign_targeting(*)")
      .eq("advertiser_id", advertiserId)
      .order("created_at", { ascending: false }),
    ctx.supabase
      .from("campaign_spend")
      .select("amount, publisher_amount, platform_amount, event_type, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  if (campaigns.error) fail("We couldn't load that advertiser's campaigns.");
  if (spend.error) fail("We couldn't load that advertiser's spend.");

  return {
    advertiser: advertiser.data,
    campaigns: campaigns.data ?? [],
    spend: spend.data ?? [],
  };
}

export async function adminListAds(
  ctx: Ctx,
  filters: {
    campaignId?: string;
    status?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  } = {},
) {
  await assertPlatformStaff(ctx);
  let query = ctx.supabase
    .from("ads")
    .select("*, campaigns(name, status), media_assets!ads_media_asset_id_fkey(*), advertisers(business_name)", {
      count: "exact",
    })
    .order("created_at", { ascending: false });

  if (filters.campaignId) query = query.eq("campaign_id", filters.campaignId);
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status as any);
  if (filters.search) {
    query = query.or(`name.ilike.%${filters.search}%,destination_url.ilike.%${filters.search}%`);
  }

  const pageSize = Math.max(1, filters.pageSize ?? 20);
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const [dataRes, countRes] = await Promise.all([
    (query as any).range(from, to),
    (query as any).select("*", { count: "exact", head: true }),
  ]);

  if (dataRes.error) fail("We couldn't load ads.");
  return {
    ads: dataRes.data ?? [],
    total: countRes.count ?? 0,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil((countRes.count ?? 0) / pageSize)),
  };
}

export async function adminGetAdDetail(ctx: Ctx, adId: string) {
  await assertPlatformStaff(ctx);
  const ad = await ctx.supabase
    .from("ads")
    .select("*, campaigns(*), media_assets!ads_media_asset_id_fkey(*), advertisers(business_name)")
    .eq("id", adId)
    .maybeSingle();
  if (ad.error) fail("We couldn't load that ad.");
  if (!ad.data) fail("That ad doesn't exist.");

  const performance = await ctx.supabase
    .from("campaign_spend")
    .select("event_type, amount, publisher_amount, platform_amount, created_at")
    .eq("ad_id", adId)
    .order("created_at", { ascending: false })
    .limit(50);

  return { ad: ad.data, performance: performance.data ?? [] };
}

export async function adminArchiveAd(ctx: Ctx, adId: string) {
  await assertPlatformAdmin(ctx);
  const service = await admin();
  const { data, error } = await service
    .from("ads")
    .update({ status: "suspended" as any })
    .eq("id", adId)
    .select("*")
    .maybeSingle();
  if (error) fail("We couldn't archive that ad.");
  if (!data) fail("That ad doesn't exist.");

  const { logAuditEvent } = await import("@/lib/audit-log.server");
  await logAuditEvent(ctx, {
    action: "ad.archive",
    targetType: "ad",
    targetId: adId,
  });

  return data;
}

export async function adminListCreatives(
  ctx: Ctx,
  filters: {
    organizationId?: string;
    status?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  } = {},
) {
  await assertPlatformStaff(ctx);
  let query = ctx.supabase
    .from("media_assets")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (filters.organizationId) query = query.eq("organization_id", filters.organizationId);
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status as any);
  if (filters.search) query = query.ilike("file_name", `%${filters.search}%`);

  const pageSize = Math.max(1, filters.pageSize ?? 20);
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const [dataRes, countRes] = await Promise.all([
    (query as any).range(from, to),
    (query as any).select("*", { count: "exact", head: true }),
  ]);

  if (dataRes.error) fail("We couldn't load creatives.");
  return {
    creatives: dataRes.data ?? [],
    total: countRes.count ?? 0,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil((countRes.count ?? 0) / pageSize)),
  };
}

export async function adminDeleteCreative(ctx: Ctx, assetId: string) {
  await assertPlatformAdmin(ctx);
  const asset = await ctx.supabase.from("media_assets").select("*").eq("id", assetId).maybeSingle();
  if (asset.error) fail("We couldn't load that creative.");
  if (!asset.data) fail("That creative doesn't exist.");

  const service = await admin();
  if (asset.data.storage_provider === "supabase" && asset.data.storage_path) {
    await service.storage.from(asset.data.bucket).remove([asset.data.storage_path]);
  }

  const { error } = await service.from("media_assets").delete().eq("id", assetId);
  if (error) fail("We couldn't delete that creative.");

  const { logAuditEvent } = await import("@/lib/audit-log.server");
  await logAuditEvent(ctx, {
    action: "creative.delete",
    targetType: "media_asset",
    targetId: assetId,
    metadata: { fileName: asset.data.file_name },
  });

  return { ok: true };
}
