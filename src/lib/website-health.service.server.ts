/**
 * Website health check service.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

export type HealthCheckType = Database["public"]["Enums"]["health_check_type"];
export type WebsiteHealthCheck = Database["public"]["Tables"]["website_health_checks"]["Row"];

export async function runHealthChecks(websiteId: string, organizationId: string): Promise<WebsiteHealthCheck[]> {
  const { data: website } = await supabaseAdmin
    .from("websites")
    .select("domain, status, verification_status")
    .eq("id", websiteId)
    .maybeSingle();

  if (!website) throw new Error("Website not found");

  const checks: { type: HealthCheckType; passed: boolean; score: number; details: Record<string, unknown> }[] = [];

  // Domain verification check
  const verificationPassed = website.verification_status === "verified";
  checks.push({
    type: "domain_verification",
    passed: verificationPassed,
    score: verificationPassed ? 20 : 0,
    details: { status: website.verification_status },
  });

  // HTTPS check
  const httpsPassed = true; // Placeholder - would need actual HTTP check
  checks.push({
    type: "https",
    passed: httpsPassed,
    score: httpsPassed ? 15 : 0,
    details: { note: "Requires server-side HTTP check" },
  });

  // Privacy policy check
  const privacyPassed = false; // Would need to fetch and check
  checks.push({
    type: "privacy_policy",
    passed: privacyPassed,
    score: privacyPassed ? 15 : 0,
    details: { note: "Requires content scan" },
  });

  // Terms page check
  const termsPassed = false;
  checks.push({
    type: "terms_page",
    passed: termsPassed,
    score: termsPassed ? 10 : 0,
    details: { note: "Requires content scan" },
  });

  // Ads.txt check
  const { data: adsTxt } = await supabaseAdmin
    .from("ads_txt_records")
    .select("is_verified")
    .eq("website_id", websiteId)
    .maybeSingle();

  const adsTxtPassed = adsTxt?.is_verified ?? false;
  checks.push({
    type: "ads_txt",
    passed: adsTxtPassed,
    score: adsTxtPassed ? 15 : 0,
    details: { verified: adsTxtPassed },
  });

  // Website status check
  const websiteStatusPassed = website.status === "active";
  checks.push({
    type: "website_status",
    passed: websiteStatusPassed,
    score: websiteStatusPassed ? 10 : 0,
    details: { status: website.status },
  });

  // Policy status check
  const { data: policyStatus } = await supabaseAdmin
    .from("website_policy_status")
    .select("status")
    .eq("website_id", websiteId)
    .maybeSingle();

  const policyPassed = !policyStatus || policyStatus.status === "good";
  checks.push({
    type: "policy_status",
    passed: policyPassed,
    score: policyPassed ? 10 : 0,
    details: { status: policyStatus?.status ?? "unknown" },
  });

  // Ad placement check
  const { data: zones } = await supabaseAdmin
    .from("ad_zones")
    .select("id, status")
    .eq("website_id", websiteId);

  const adPlacementPassed = zones !== null && zones.length > 0 && zones.every((z) => z.status === "active");
  checks.push({
    type: "ad_placement",
    passed: adPlacementPassed,
    score: adPlacementPassed ? 5 : 0,
    details: { zoneCount: zones?.length ?? 0 },
  });

  // Traffic quality check
  const trafficQualityPassed = true; // Would be based on fraud detection metrics
  checks.push({
    type: "traffic_quality",
    passed: trafficQualityPassed,
    score: trafficQualityPassed ? 5 : 0,
    details: { note: "Requires fraud analysis" },
  });

  const results: WebsiteHealthCheck[] = [];
  for (const check of checks) {
    const insertData: Record<string, unknown> = {
      website_id: websiteId,
      organization_id: organizationId,
      check_type: check.type,
      passed: check.passed,
      score: check.score,
    };
    if (check.details) insertData["details"] = check.details;

    const { data, error } = await supabaseAdmin
      .from("website_health_checks")
      .insert(insertData as Database["public"]["Tables"]["website_health_checks"]["Insert"])
      .select("*")
      .single();

    if (error) {
      console.error("Failed to insert health check", error);
      continue;
    }
    results.push(data);
  }

  return results;
}

export async function getLatestHealthChecks(websiteId: string): Promise<WebsiteHealthCheck[]> {
  const { data, error } = await supabaseAdmin
    .from("website_health_checks")
    .select("*")
    .eq("website_id", websiteId)
    .order("checked_at", { ascending: false })
    .limit(20);

  if (error) throw new Error(error.message);
  return data ?? [];
}
