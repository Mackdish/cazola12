/**
 * Publisher policy center service.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import type { PolicyStatus, ViolationSeverity, ViolationStatus } from "@/lib/publisher-policy.domain";

export type PublisherPolicy = Database["public"]["Tables"]["publisher_policies"]["Row"];
export type WebsitePolicyStatus = Database["public"]["Tables"]["website_policy_status"]["Row"];
export type PolicyViolation = Database["public"]["Tables"]["policy_violations"]["Row"];

export async function listPolicies(organizationId: string): Promise<PublisherPolicy[]> {
  const { data, error } = await supabaseAdmin
    .from("publisher_policies")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createPolicy(
  organizationId: string,
  input: {
    title: string;
    description: string;
    category: string;
    severity: ViolationSeverity;
  },
): Promise<PublisherPolicy> {
  const { data, error } = await supabaseAdmin
    .from("publisher_policies")
    .insert({
      organization_id: organizationId,
      title: input.title,
      description: input.description,
      category: input.category,
      severity: input.severity,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updatePolicy(
  policyId: string,
  input: {
    title?: string;
    description?: string;
    category?: string;
    severity?: ViolationSeverity;
    isActive?: boolean;
  },
): Promise<PublisherPolicy> {
  const { data, error } = await supabaseAdmin
    .from("publisher_policies")
    .update(input as never)
    .eq("id", policyId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deletePolicy(policyId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("publisher_policies")
    .delete()
    .eq("id", policyId);

  if (error) throw new Error(error.message);
}

export async function getWebsitePolicyStatus(websiteId: string): Promise<WebsitePolicyStatus | null> {
  const { data, error } = await supabaseAdmin
    .from("website_policy_status")
    .select("*")
    .eq("website_id", websiteId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ?? null;
}

export async function setWebsitePolicyStatus(
  websiteId: string,
  organizationId: string,
  status: PolicyStatus,
): Promise<WebsitePolicyStatus> {
  const { data, error } = await supabaseAdmin
    .from("website_policy_status")
    .upsert({
      website_id: websiteId,
      organization_id: organizationId,
      status,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function listViolations(websiteId: string): Promise<PolicyViolation[]> {
  const { data, error } = await supabaseAdmin
    .from("policy_violations")
    .select("*")
    .eq("website_id", websiteId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createViolation(
  organizationId: string,
  input: {
    websiteId: string;
    violationType: string;
    severity: ViolationSeverity;
    description: string;
    evidence?: Record<string, unknown> | undefined;
    policyId?: string | undefined;
  },
): Promise<PolicyViolation> {
  const insertData: Record<string, unknown> = {
    organization_id: organizationId,
    website_id: input.websiteId,
    violation_type: input.violationType,
    severity: input.severity,
    description: input.description,
    policy_id: input.policyId ?? null,
    status: "open",
  };
  if (input.evidence) insertData["evidence"] = input.evidence;

  const { data, error } = await supabaseAdmin
    .from("policy_violations")
    .insert(insertData as Database["public"]["Tables"]["policy_violations"]["Insert"])
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateViolation(
  violationId: string,
  input: {
    status?: ViolationStatus | undefined;
    adminNotes?: string | undefined;
    resolvedAt?: string | undefined;
  },
): Promise<PolicyViolation> {
  const { data, error } = await supabaseAdmin
    .from("policy_violations")
    .update(input as never)
    .eq("id", violationId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function listAllViolations(organizationId: string): Promise<PolicyViolation[]> {
  const { data, error } = await supabaseAdmin
    .from("policy_violations")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}
