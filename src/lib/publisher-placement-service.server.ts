import { z } from "zod";

import type { Ctx } from "@/lib/publisher-service.server";

const placementKeys = [
  "top_page",
  "article_top",
  "between_paragraphs",
  "sidebar",
  "bottom_article",
  "mobile_sticky",
] as const;

export type PlacementKey = (typeof placementKeys)[number];

export const PLACEMENT_DEFINITIONS: Record<PlacementKey, {
  label: string;
  description: string;
  recommendedFormat: string;
  device: "all" | "desktop" | "mobile";
}> = {
  top_page: { label: "Top of page", description: "A high-visibility placement near the top of the page.", recommendedFormat: "responsive", device: "all" },
  article_top: { label: "Top of article", description: "Place an ad directly before the main article content.", recommendedFormat: "responsive", device: "all" },
  between_paragraphs: { label: "Between paragraphs", description: "A native-feeling in-content placement between article paragraphs.", recommendedFormat: "300x250", device: "all" },
  sidebar: { label: "Sidebar", description: "A standard display placement for desktop sidebars.", recommendedFormat: "300x250", device: "desktop" },
  bottom_article: { label: "Bottom of article", description: "A placement after the main article content.", recommendedFormat: "responsive", device: "all" },
  mobile_sticky: { label: "Mobile sticky", description: "A persistent mobile-friendly placement at the bottom of the viewport.", recommendedFormat: "320x50", device: "mobile" },
};

export const placementKeySchema = z.enum(placementKeys);

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function assertWebsiteAccess(ctx: Ctx, websiteId: string) {
  const { data, error } = await ctx.supabase
    .from("websites")
    .select("id, organization_id, publisher_id, verification_status, approval_status")
    .eq("id", websiteId)
    .maybeSingle();
  if (error) throw new Error("We couldn't load this website.");
  if (!data) throw new Error("That website doesn't exist, or you don't have access to it.");
  return data;
}

async function ensureZone(ctx: Ctx, website: any, key: PlacementKey, format: string) {
  const db = await admin();
  const { data: existing } = await db
    .from("website_placements")
    .select("zone_id")
    .eq("website_id", website.id)
    .eq("placement_key", key)
    .maybeSingle();
  if (existing?.zone_id) return existing.zone_id as string;

  const { data: zoneKey, error: keyError } = await db.rpc("generate_zone_key");
  if (keyError || !zoneKey) throw new Error("We couldn't create the ad placement. Please try again.");

  const responsive = format === "responsive";
  const dimensions: Record<string, [number, number]> = {
    "300x250": [300, 250], "336x280": [336, 280], "728x90": [728, 90],
    "970x250": [970, 250], "320x50": [320, 50], "320x100": [320, 100],
  };
  const [width, height] = dimensions[format] ?? [0, 0];
  const { data: zone, error } = await db.from("ad_zones").insert({
    website_id: website.id,
    publisher_id: website.publisher_id,
    organization_id: website.organization_id,
    name: PLACEMENT_DEFINITIONS[key].label,
    zone_key: zoneKey,
    format,
    width: responsive ? null : width,
    height: responsive ? null : height,
    responsive,
  }).select("id, zone_key").single();
  if (error || !zone) throw new Error("We couldn't create the ad placement. Please try again.");
  return zone as { id: string; zone_key: string };
}

export async function listWebsitePlacements(ctx: Ctx, websiteId: string) {
  const website = await assertWebsiteAccess(ctx, websiteId);
  const db = await admin();
  const { data, error } = await db.from("website_placements")
    .select("*, ad_zones(id, zone_key, name, format, status, width, height, responsive)")
    .eq("website_id", website.id).order("created_at", { ascending: true });
  if (error) throw new Error("We couldn't load this website's placements.");
  const rows = new Map((data ?? []).map((row: any) => [row.placement_key, row]));
  return placementKeys.map((key) => ({
    key,
    ...PLACEMENT_DEFINITIONS[key],
    ...(rows.get(key) ?? {
      id: null, website_id: website.id, organization_id: website.organization_id,
      zone_id: null, enabled: false, ad_zones: null,
    }),
  }));
}

export async function setWebsitePlacement(ctx: Ctx, input: {
  websiteId: string; placementKey: PlacementKey; enabled: boolean; format?: string;
}) {
  const website = await assertWebsiteAccess(ctx, input.websiteId);
  if (website.verification_status !== "verified" || website.approval_status !== "approved") {
    throw new Error("Verify and approve your website before activating placements.");
  }

  const definition = PLACEMENT_DEFINITIONS[input.placementKey];
  const allowedFormats = new Set(["300x250", "336x280", "728x90", "970x250", "320x50", "320x100", "responsive"]);
  const format = input.format && allowedFormats.has(input.format) ? input.format : definition.recommendedFormat;
  const db = await admin();

  const { data: current } = await db.from("website_placements")
    .select("zone_id").eq("website_id", website.id).eq("placement_key", input.placementKey).maybeSingle();
  let zone: { id: string; zone_key: string } | null = null;
  if (input.enabled) zone = await ensureZone(ctx, website, input.placementKey, format);
  else if (current?.zone_id) {
    await db.from("ad_zones").update({ status: "suspended" }).eq("id", current.zone_id);
  }

  const { data, error } = await db.from("website_placements").upsert({
    website_id: website.id,
    organization_id: website.organization_id,
    zone_id: zone?.id ?? current?.zone_id ?? null,
    placement_key: input.placementKey,
    label: definition.label,
    enabled: input.enabled,
  }, { onConflict: "website_id,placement_key" })
    .select("*, ad_zones(id, zone_key, name, format, status, width, height, responsive)").single();
  if (error || !data) throw new Error("We couldn't save that placement. Please try again.");

  if (zone?.id) await db.from("ad_zones").update({ status: "active", format }).eq("id", zone.id);
  const zoneKey = zone?.zone_key ?? data.ad_zones?.zone_key;
  const { cacheBumpVersion, cacheDelete, invalidateZoneContextCache } = await import("@/lib/cache.server");
  await Promise.all([
    cacheBumpVersion("website", website.id),
    cacheDelete(`website:${website.id}:detail`),
    invalidateZoneContextCache(zoneKey ? [zoneKey] : []),
  ]);
  return { ...data, key: input.placementKey, ...definition };
}
