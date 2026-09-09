import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { adFormatSpec, validateCreativeAgainstFormat, normalizeDestinationUrl, type AdFormat } from "@/lib/advertiser-domain";
import type { Ctx } from "@/lib/advertiser-service.server";

export class AdEditError extends Error {}

function fail(message: string): never {
  throw new AdEditError(message);
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient<Database>;
}

async function assertAdvertiserAccess(ctx: Ctx, organizationId: string) {
  const db = await admin();
  const { data, error } = await db
    .from("organization_members")
    .select("id, status")
    .eq("organization_id", organizationId)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (error || !data || data.status !== "active") fail("You don't have permission to edit this ad.");
}

async function assertCreative(ctx: Ctx, assetId: string, organizationId: string, format: AdFormat) {
  const db = await admin();
  const { data, error } = await db
    .from("media_assets")
    .select("id, organization_id, width, height, status")
    .eq("id", assetId)
    .maybeSingle();
  if (error) fail("We couldn't load that creative.");
  if (!data || data.organization_id !== organizationId) fail("That creative doesn't belong to your organization.");
  if (data.status !== "ready") fail("That creative isn't available.");
  if (data.width === null || data.height === null) fail("That creative has no readable dimensions.");
  const check = validateCreativeAgainstFormat(format, { width: data.width, height: data.height });
  if (!check.ok) fail(check.message);
  adFormatSpec(format);
}

export async function updateAdvertiserAd(
  ctx: Ctx,
  input: {
    adId: string;
    name: string;
    format: AdFormat;
    destinationUrl: string;
    mediaAssetId: string;
    brandName?: string | null;
    logoMediaAssetId?: string | null;
    headlines: string[];
    longHeadline?: string | null;
    descriptions: string[];
    cta?: string | null;
    trackingUrl?: string | null;
    optimization?: string | null;
  },
) {
  const db = await admin();
  const { data: ad, error: adError } = await db
    .from("ads")
    .select("id, organization_id, approval_status, status, media_asset_id")
    .eq("id", input.adId)
    .maybeSingle();
  if (adError) fail("We couldn't load that ad.");
  if (!ad) fail("That ad doesn't exist.");

  await assertAdvertiserAccess(ctx, ad.organization_id);
  await assertCreative(ctx, input.mediaAssetId, ad.organization_id, input.format);

  const destination = normalizeDestinationUrl(input.destinationUrl);
  if (!destination) fail("Enter a valid HTTPS destination URL.");
  if (input.name.trim().length < 2) fail("Ad name is required.");
  if (!input.headlines.length) fail("Add at least one headline.");
  if (!input.descriptions.length) fail("Add at least one description.");
  if (input.headlines.length > 5 || input.headlines.some((value) => value.trim().length > 90)) fail("Headlines must contain at most 5 items of 90 characters each.");
  if (input.descriptions.length > 5 || input.descriptions.some((value) => value.trim().length > 150)) fail("Descriptions must contain at most 5 items of 150 characters each.");
  if (input.longHeadline && input.longHeadline.trim().length > 120) fail("Long headline must be 120 characters or fewer.");
  if (input.cta && input.cta.trim().length > 40) fail("Call-to-action must be 40 characters or fewer.");

  const reReviewRequired = ad.approval_status === "approved" || ad.status === "active" || ad.approval_status === "pending";
  const patch: Database["public"]["Tables"]["ads"]["Update"] = {
    name: input.name.trim(),
    format: input.format,
    destination_url: destination,
    media_asset_id: input.mediaAssetId,
    brand_name: input.brandName?.trim() || null,
    logo_media_asset_id: input.logoMediaAssetId || null,
    headlines: input.headlines.map((value) => value.trim()) as never,
    long_headline: input.longHeadline?.trim() || null,
    descriptions: input.descriptions.map((value) => value.trim()) as never,
    cta: input.cta?.trim() || null,
    tracking_url: input.trackingUrl?.trim() || null,
    optimization: input.optimization?.trim() || "auto_optimize",
    ...(reReviewRequired ? { approval_status: "pending", status: "pending", rejection_reason: null } : { approval_status: "pending", rejection_reason: null }),
  };

  const { data, error } = await db.from("ads").update(patch).eq("id", input.adId).select("*").maybeSingle();
  if (error || !data) fail("We couldn't save your ad changes.");

  if (input.mediaAssetId !== ad.media_asset_id) {
    await db.from("media_assets").update({ ad_id: data.id, campaign_id: data.campaign_id }).eq("id", input.mediaAssetId);
  }

  const { logAuditEvent } = await import("@/lib/audit-log.server");
  await logAuditEvent(ctx, {
    action: "ad.updated",
    targetType: "ad",
    targetId: input.adId,
    metadata: { reReviewRequired, mediaAssetId: input.mediaAssetId },
  });

  return data;
}
