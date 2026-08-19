/**
 * Ads.txt management service.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

export type AdsTxtRecord = Database["public"]["Tables"]["ads_txt_records"]["Row"];

const TRADEMALL_SELLER_ID = "trademall.co.ke";

export function generateSellerRecord(publisherId: string, domain: string): string {
  return `${TRADEMALL_SELLER_ID}, ${publisherId}, DIRECT`;
}

export async function getAdsTxtRecord(websiteId: string): Promise<AdsTxtRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("ads_txt_records")
    .select("*")
    .eq("website_id", websiteId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ?? null;
}

export async function createAdsTxtRecord(
  websiteId: string,
  organizationId: string,
  domain: string,
  publisherId: string,
): Promise<AdsTxtRecord> {
  const sellerRecord = generateSellerRecord(publisherId, domain);

  const { data, error } = await supabaseAdmin
    .from("ads_txt_records")
    .upsert({
      website_id: websiteId,
      organization_id: organizationId,
      domain,
      seller_record: sellerRecord,
      is_verified: false,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function verifyAdsTxt(websiteId: string, domain: string): Promise<{ verified: boolean; error?: string }> {
  const { data: record } = await supabaseAdmin
    .from("ads_txt_records")
    .select("seller_record")
    .eq("website_id", websiteId)
    .maybeSingle();

  if (!record) {
    return { verified: false, error: "No ads.txt record found" };
  }

  try {
    const response = await fetch(`https://${domain}/ads.txt`, {
      headers: { Accept: "text/plain" },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return { verified: false, error: `HTTP ${response.status}` };
    }

    const content = await response.text();
    const normalizedContent = content.replace(/\r\n/g, "\n").trim();
    const normalizedRecord = record.seller_record.trim();

    const verified = normalizedContent.includes(normalizedRecord);

    await supabaseAdmin
      .from("ads_txt_records")
      .update({
        is_verified: verified,
        last_verified_at: new Date().toISOString(),
        verification_error: verified ? null : "Record not found in ads.txt",
      })
      .eq("website_id", websiteId);

    const result: { verified: boolean; error?: string } = { verified };
    if (!verified) result.error = "Record not found in ads.txt";
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await supabaseAdmin
      .from("ads_txt_records")
      .update({
        is_verified: false,
        last_verified_at: new Date().toISOString(),
        verification_error: message,
      })
      .eq("website_id", websiteId);

    return { verified: false, error: message };
  }
}
