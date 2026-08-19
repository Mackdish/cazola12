/**
 * Ad Reports service.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

export type AdReport = Database["public"]["Tables"]["ad_reports"]["Row"];

export async function createAdReport(
  organizationId: string,
  input: {
    adId: string;
    campaignId: string;
    websiteId: string;
    adZoneId: string;
    reason: string;
    description?: string;
    reporterIp?: string;
    userAgent?: string;
  },
): Promise<AdReport> {
  const { data, error } = await supabaseAdmin
    .from("ad_reports")
    .insert({
      organization_id: organizationId,
      ad_id: input.adId,
      campaign_id: input.campaignId,
      website_id: input.websiteId,
      ad_zone_id: input.adZoneId,
      reason: input.reason as never,
      description: input.description ?? null,
      reporter_ip: input.reporterIp ?? null,
      user_agent: input.userAgent ?? null,
      status: "pending",
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function listAdReports(websiteId?: string, status?: string): Promise<AdReport[]> {
  let query = supabaseAdmin.from("ad_reports").select("*");

  if (websiteId) {
    query = query.eq("website_id", websiteId);
  }

  if (status) {
    query = query.eq("status", status as never);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function updateAdReport(
  reportId: string,
  input: {
    status?: string | undefined;
    adminNotes?: string | undefined;
    reviewedBy?: string | undefined;
  },
): Promise<AdReport> {
  const { data, error } = await supabaseAdmin
    .from("ad_reports")
    .update({
      ...input,
      reviewed_at: input.status ? new Date().toISOString() : undefined,
    } as Database["public"]["Tables"]["ad_reports"]["Update"])
    .eq("id", reportId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}
