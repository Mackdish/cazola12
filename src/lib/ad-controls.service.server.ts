/**
 * Ad Controls service.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database, Json } from "@/integrations/supabase/types";

export type AdControls = Database["public"]["Tables"]["ad_controls"]["Row"];

export async function getAdControls(websiteId: string, adZoneId?: string): Promise<AdControls | null> {
  let query = supabaseAdmin
    .from("ad_controls")
    .select("*")
    .eq("website_id", websiteId);

  if (adZoneId) {
    query = query.eq("ad_zone_id", adZoneId);
  } else {
    query = query.is("ad_zone_id", null);
  }

  const { data, error } = await query.maybeSingle();

  if (error) throw new Error(error.message);
  return data ?? null;
}

export async function createAdControls(
  websiteId: string,
  organizationId: string,
  adZoneId?: string,
): Promise<AdControls> {
  const { data, error } = await supabaseAdmin
    .from("ad_controls")
    .insert({
      website_id: websiteId,
      organization_id: organizationId,
      ad_zone_id: adZoneId ?? null,
      allowed_formats: [] as Json,
      blocked_categories: [] as Json,
      blocked_advertisers: [] as Json,
      responsive_enabled: true,
      lazy_loading_enabled: true,
      refresh_mode: "none",
    } as Database["public"]["Tables"]["ad_controls"]["Insert"])
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateAdControls(
  controlsId: string,
  input: {
    allowedFormats?: string[] | undefined;
    blockedCategories?: string[] | undefined;
    blockedAdvertisers?: string[] | undefined;
    maxFrequency?: number | undefined;
    responsiveEnabled?: boolean | undefined;
    lazyLoadingEnabled?: boolean | undefined;
    refreshMode?: "none" | "time_based" | "scroll_based" | undefined;
    refreshIntervalSeconds?: number | undefined;
  },
): Promise<AdControls> {
  const { data, error } = await supabaseAdmin
    .from("ad_controls")
    .update(input as Database["public"]["Tables"]["ad_controls"]["Update"])
    .eq("id", controlsId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}
