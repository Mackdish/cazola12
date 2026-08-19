/**
 * Auto Ads service.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

export type AutoAdsConfig = Database["public"]["Tables"]["auto_ads_config"]["Row"];

export async function getAutoAdsConfig(websiteId: string): Promise<AutoAdsConfig | null> {
  const { data, error } = await supabaseAdmin
    .from("auto_ads_config")
    .select("*")
    .eq("website_id", websiteId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ?? null;
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
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export function generateAutoAdsScript(websiteId: string): string {
  const script = `
(function() {
  var script = document.createElement('script');
  script.async = true;
  script.src = 'https://ads.trademall.co.ke/auto.js';
  script.dataset.websiteId = '${websiteId}';
  document.head.appendChild(script);
})();
`.trim();
  return script;
}
