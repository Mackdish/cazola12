/**
 * Auto Ads service.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import { cachedGetVersioned, cacheDelete, cacheBumpVersion } from "@/lib/cache.server";

export type AutoAdsConfig = Database["public"]["Tables"]["auto_ads_config"]["Row"];

export async function getAutoAdsConfig(websiteId: string): Promise<AutoAdsConfig | null> {
  return cachedGetVersioned({
    prefix: "website",
    id: websiteId,
    ttlSeconds: 300,
    legacyKey: `website:${websiteId}:auto_ads`,
    supplier: async () => {
      const { data, error } = await supabaseAdmin
        .from("auto_ads_config")
        .select("*")
        .eq("website_id", websiteId)
        .maybeSingle();

      if (error) throw new Error(error.message);
      return data ?? null;
    },
  });
}

async function syncAutoAdsPlacements(websiteId: string, organizationId: string, enabled: boolean, config: { responsiveAdsEnabled?: boolean | null; bannerAdsEnabled?: boolean | null; mobileAdsEnabled?: boolean | null }) {
  const placementKeys = enabled
    ? [
        ...(config.responsiveAdsEnabled !== false ? ["top_page", "article_top", "bottom_article"] : []),
        ...(config.mobileAdsEnabled !== false ? ["mobile_sticky"] : []),
      ]
    : [];

  const { data: website, error: websiteError } = await supabaseAdmin
    .from("websites")
    .select("id, publisher_id")
    .eq("id", websiteId)
    .maybeSingle();
  if (websiteError || !website) throw new Error("Website not found");

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("website_placements")
    .select("id, placement_key, zone_id, enabled, ad_zones(id, zone_key, status, format)")
    .eq("website_id", websiteId);
  if (existingError) throw new Error(existingError.message);

  const existingByKey = new Map((existing ?? []).map((row: any) => [row.placement_key, row]));

  const definitions: Record<string, { label: string; format: string }> = {
    top_page: { label: "Top of page", format: "responsive" },
    article_top: { label: "Top of article", format: "responsive" },
    bottom_article: { label: "Bottom of article", format: "responsive" },
    mobile_sticky: { label: "Mobile sticky", format: "320x50" },
  };

  for (const key of ["top_page", "article_top", "bottom_article", "mobile_sticky"]) {
    const shouldEnable = placementKeys.includes(key);
    const current: any = existingByKey.get(key);

    let zoneId = current?.zone_id ?? null;
    let zoneKey = current?.ad_zones?.zone_key ?? null;

    if (shouldEnable && !zoneId) {
      const { data: generatedZoneKey, error: keyError } = await supabaseAdmin.rpc("generate_zone_key");
      if (keyError || !generatedZoneKey) throw new Error("We couldn't create the automatic ad placement.");
      const definition = definitions[key];
      const responsive = definition.format === "responsive";
      const { data: zone, error: zoneError } = await supabaseAdmin
        .from("ad_zones")
        .insert({
          website_id: websiteId,
          publisher_id: website.publisher_id,
          organization_id: organizationId,
          name: definition.label,
          zone_key: generatedZoneKey,
          format: definition.format,
          width: responsive ? null : 320,
          height: responsive ? null : 50,
          responsive,
          status: "active",
        })
        .select("id, zone_key")
        .single();
      if (zoneError || !zone) throw new Error("We couldn't create the automatic ad placement.");
      zoneId = zone.id;
      zoneKey = zone.zone_key;
    }

    if (zoneId) {
      await supabaseAdmin
        .from("ad_zones")
        .update({ status: shouldEnable ? "active" : "suspended" })
        .eq("id", zoneId);
    }

    const { error: upsertError } = await supabaseAdmin
      .from("website_placements")
      .upsert({
        website_id: websiteId,
        organization_id: organizationId,
        zone_id: zoneId,
        placement_key: key,
        label: definitions[key].label,
        enabled: shouldEnable,
      }, { onConflict: "website_id,placement_key" });
    if (upsertError) throw new Error(upsertError.message);
  }

  const { invalidateZoneContextCache, cacheBumpVersion, cacheDelete } = await import("@/lib/cache.server");
  const keys = (existing ?? [])
    .map((row: any) => row.ad_zones?.zone_key)
    .filter(Boolean);
  if (zoneKeyForInvalidation(placementKeys, existingByKey)) keys.push(...zoneKeyForInvalidation(placementKeys, existingByKey));
  await Promise.all([
    cacheBumpVersion("website", websiteId),
    cacheDelete(`website:${websiteId}:detail`),
    invalidateZoneContextCache([...new Set(keys)]),
  ]);
}

function zoneKeyForInvalidation(keys: string[], rows: Map<string, any>): string[] {
  return keys.map((key) => rows.get(key)?.ad_zones?.zone_key).filter(Boolean);
}

export async function createAutoAdsConfig(
  websiteId: string,
  organizationId: string,
): Promise<AutoAdsConfig> {
  const { data, error } = await supabaseAdmin
    .from("auto_ads_config")
    .insert({
      website_id: websiteId,
      organization_id: organizationId,
      status: "disabled",
      ad_load: "balanced",
      enabled_formats: [],
      excluded_pages: [],
      excluded_selectors: [],
      min_spacing: 300,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  await cacheBumpVersion("website", websiteId);
  await cacheDelete(`website:${websiteId}:auto_ads`);
  await syncAutoAdsPlacements(websiteId, organizationId, false, data);
  return data;
}

export async function updateAutoAdsConfig(
  websiteId: string,
  input: {
    status?: "enabled" | "disabled" | undefined;
    adLoad?: "low" | "balanced" | "high" | undefined;
    enabledFormats?: string[] | undefined;
    excludedPages?: string[] | undefined;
    excludedSelectors?: string[] | undefined;
    minSpacing?: number | undefined;
    anchorAdsEnabled?: boolean | undefined;
    overlayAdsEnabled?: boolean | undefined;
    mobileAdsEnabled?: boolean | undefined;
    bannerAdsEnabled?: boolean | undefined;
    responsiveAdsEnabled?: boolean | undefined;
  },
): Promise<AutoAdsConfig> {
  const { data, error } = await supabaseAdmin
    .from("auto_ads_config")
    .update(input as Database["public"]["Tables"]["auto_ads_config"]["Update"])
    .eq("website_id", websiteId)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (data) {
    const { data: website } = await supabaseAdmin
      .from("websites")
      .select("organization_id")
      .eq("id", websiteId)
      .maybeSingle();
    if (!website?.organization_id) throw new Error("Website not found");
    await cacheBumpVersion("website", websiteId);
    await cacheDelete(`website:${websiteId}:auto_ads`);
    await syncAutoAdsPlacements(websiteId, website.organization_id, data.status === "enabled", data);
    return data;
  }

  const { data: website } = await supabaseAdmin
    .from("websites")
    .select("organization_id")
    .eq("id", websiteId)
    .maybeSingle();

  if (!website?.organization_id) {
    throw new Error("Website not found");
  }

  const { data: created, error: createError } = await supabaseAdmin
    .from("auto_ads_config")
    .insert({
      website_id: websiteId,
      organization_id: website.organization_id,
      status: input.status ?? "disabled",
      ad_load: input.adLoad ?? "balanced",
      enabled_formats: input.enabledFormats ?? [],
      excluded_pages: input.excludedPages ?? [],
      excluded_selectors: input.excludedSelectors ?? [],
      min_spacing: input.minSpacing ?? 300,
      anchor_ads_enabled: input.anchorAdsEnabled ?? true,
      overlay_ads_enabled: input.overlayAdsEnabled ?? true,
      mobile_ads_enabled: input.mobileAdsEnabled ?? true,
      banner_ads_enabled: input.bannerAdsEnabled ?? true,
      responsive_ads_enabled: input.responsiveAdsEnabled ?? true,
    })
    .select("*")
    .single();
  if (createError || !created) throw new Error(createError?.message ?? "We couldn't create Auto Ads settings.");
  await cacheBumpVersion("website", websiteId);
  await cacheDelete(`website:${websiteId}:auto_ads`);
  await syncAutoAdsPlacements(websiteId, website.organization_id, created.status === "enabled", created);
  return created;
}

export function generateAutoAdsScript(websiteId: string): string {
  const script = `
(function() {
  var script = document.createElement('script');
  script.async = true;
  script.src = 'https://ads.trademall.co.ke/ad/loader.js';
  document.head.appendChild(script);
})();
`.trim();
  return script;
}
