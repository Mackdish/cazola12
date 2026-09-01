/**
 * V1 ad-serving helpers that accept explicit identifiers instead of HMAC tokens.
 * Reuses existing impression/click/billing/fraud logic from ad-serving.server.ts.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { recordImpression, recordClick } from "@/lib/ad-serving.server";

export type V1ImpressionInput = {
  requestId: string;
  adId: string;
  campaignId: string;
  publisherId: string;
  websiteId: string;
  adZoneId: string;
  device?: string | null;
  browser?: string | null;
  os?: string | null;
  country?: string | null;
  ipAddress?: string;
  userAgent?: string;
};

export type V1ClickInput = {
  requestId: string;
  adId: string;
  campaignId: string;
  publisherId: string;
  websiteId: string;
  adZoneId: string;
  ipAddress?: string;
  userAgent?: string;
};

export async function recordImpressionV1(input: V1ImpressionInput): Promise<"recorded" | "duplicate" | "failed"> {
  const payload = {
    rid: input.requestId,
    adId: input.adId,
    campaignId: input.campaignId,
    publisherId: input.publisherId,
    websiteId: input.websiteId,
    zoneId: input.adZoneId,
    device: (input.device ?? "other") as never,
    browser: (input.browser ?? "other") as never,
    os: (input.os ?? "other") as never,
    country: input.country ?? null,
    exp: Math.floor(Date.now() / 1000) + 3600,
  };

  return recordImpression(payload, input.ipAddress, input.userAgent, undefined, false, undefined, undefined);
}

export async function recordClickV1(input: V1ClickInput): Promise<{ destination: string } | null> {
  const payload = {
    rid: input.requestId,
    adId: input.adId,
    campaignId: input.campaignId,
    publisherId: input.publisherId,
    websiteId: input.websiteId,
    zoneId: input.adZoneId,
    device: "other",
    browser: "other",
    os: "other",
    country: null,
    exp: Math.floor(Date.now() / 1000) + 3600,
  };

  return recordClick(payload, input.ipAddress, input.userAgent, undefined, false, undefined, undefined);
}

export async function resolveAdContext(adId: string): Promise<{
  campaignId: string;
  publisherId: string;
  websiteId: string;
  adZoneId: string;
} | null> {
  const { data: ad } = await supabaseAdmin
    .from("ads")
    .select("campaign_id")
    .eq("id", adId)
    .maybeSingle();

  if (!ad) return null;

  const { data: campaign } = await supabaseAdmin
    .from("campaigns")
    .select("organization_id")
    .eq("id", ad.campaign_id)
    .maybeSingle();

  // Find the ad zone for this website/publisher
  const { data: adZone } = await supabaseAdmin
    .from("ad_zones")
    .select("id, publisher_id, website_id")
    .limit(1)
    .maybeSingle();

  if (!adZone) return null;

  return {
    campaignId: ad.campaign_id,
    publisherId: adZone.publisher_id,
    websiteId: adZone.website_id,
    adZoneId: adZone.id,
  };
}
