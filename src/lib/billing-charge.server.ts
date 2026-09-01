/**
 * Serving-path billing. Server-only, deliberately tiny.
 *
 * One RPC per billable event. The database function does the whole charge in a
 * single transaction with the wallet row locked, so duplicate beacons, spent
 * budgets, paused campaigns and empty wallets are all rejected there rather
 * than being guessed at here.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import {
  amount,
  type BillingEventType,
  type ChargeReason,
  type ChargeResult,
} from "@/lib/billing-domain";

export type ChargeInput = {
  eventType: BillingEventType;
  requestId: string;
  campaignId: string;
  adId: string;
  publisherId: string;
  websiteId: string;
  adZoneId: string;
};

export async function chargeAdEvent(input: ChargeInput): Promise<ChargeResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const client = supabaseAdmin as unknown as SupabaseClient<Database>;

  const { data, error } = await client.rpc("charge_campaign_event", {
    _event_type: input.eventType,
    _request_id: input.requestId,
    _campaign_id: input.campaignId,
    _ad_id: input.adId,
    _publisher_id: input.publisherId,
    _website_id: input.websiteId,
    _ad_zone_id: input.adZoneId,
  });

  if (error) {
    console.error("charge_campaign_event failed", error.message);
    return { ok: false, reason: "error", amount: 0, publisherAmount: 0, platformAmount: 0 };
  }

  const result = (data ?? {}) as {
    ok?: boolean;
    reason?: string;
    amount?: number | string;
    publisher_amount?: number | string;
    platform_amount?: number | string;
  };

  const chargeResult: ChargeResult = {
    ok: result.ok === true,
    reason: (result.reason ?? "error") as ChargeReason,
    amount: amount(result.amount),
    publisherAmount: amount(result.publisher_amount),
    platformAmount: amount(result.platform_amount),
  };

  if (!chargeResult.ok && (chargeResult.reason === "insufficient_funds" || chargeResult.reason === "budget_exhausted")) {
    await client
      .from("campaigns")
      .update({ status: "paused", pause_reason: chargeResult.reason })
      .eq("id", input.campaignId)
      .eq("status", "active");
  }

  return chargeResult;
}

/**
 * Organizations whose wallet can still fund a charge. Used to drop unfundable
 * campaigns before selection so we don't serve an impression we can't bill.
 */
export async function fundedOrganizationIds(organizationIds: string[]): Promise<Set<string>> {
  if (organizationIds.length === 0) return new Set();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const client = supabaseAdmin as unknown as SupabaseClient<Database>;

  const { data, error } = await client
    .from("wallets")
    .select("organization_id, balance_amount")
    .in("organization_id", organizationIds)
    .gt("balance_amount", 0);

  // On a read failure, fall back to serving: delivery is more important than
  // perfect pacing, and the charge itself still enforces the balance.
  if (error) return new Set(organizationIds);
  return new Set((data ?? []).map((row) => row.organization_id));
}
