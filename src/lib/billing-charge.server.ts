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
const FUNDED_ORG_CACHE_TTL_MS = 2_000;
const FUNDED_ORG_CACHE_MAX_ENTRIES = 2_000;
const FUNDED_ORG_CACHE = new Map<string, { funded: boolean; expiresAt: number }>();

function pruneFundedOrgCache(now: number) {
  for (const [organizationId, entry] of FUNDED_ORG_CACHE) {
    if (entry.expiresAt <= now) FUNDED_ORG_CACHE.delete(organizationId);
  }
  while (FUNDED_ORG_CACHE.size > FUNDED_ORG_CACHE_MAX_ENTRIES) {
    const oldest = FUNDED_ORG_CACHE.keys().next().value;
    if (oldest === undefined) break;
    FUNDED_ORG_CACHE.delete(oldest);
  }
}

/**
 * Organizations whose wallet can still fund a charge. Used to drop unfundable
 * campaigns before selection so we don't serve an impression we can't bill.
 *
 * The result is cached for only 2 seconds. This removes a repeated wallet query
 * from the hot path while keeping payment/refund changes visible quickly.
 * The billing RPC remains authoritative and can still reject a stale result.
 */
export async function fundedOrganizationIds(organizationIds: string[]): Promise<Set<string>> {
  const ids = [...new Set(organizationIds.filter(Boolean))];
  if (ids.length === 0) return new Set();

  const now = Date.now();
  pruneFundedOrgCache(now);

  const funded = new Set<string>();
  const missing: string[] = [];

  for (const organizationId of ids) {
    const cached = FUNDED_ORG_CACHE.get(organizationId);
    if (cached && cached.expiresAt > now) {
      if (cached.funded) funded.add(organizationId);
    } else {
      missing.push(organizationId);
    }
  }

  if (missing.length === 0) return funded;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const client = supabaseAdmin as unknown as SupabaseClient<Database>;

  const { data, error } = await client
    .from("wallets")
    .select("organization_id, balance_amount")
    .in("organization_id", missing)
    .eq("currency", "KES")
    .gt("balance_amount", 0);

  if (error) {
    // Do not cache a read failure. The charge RPC remains the authoritative
    // financial gate and can reject the event if the wallet is actually empty.
    console.warn("[billing] funded-wallet lookup failed", error.message);
    for (const organizationId of missing) funded.add(organizationId);
    return funded;
  }

  const fundedIds = new Set((data ?? []).map((row) => row.organization_id));
  const expiresAt = now + FUNDED_ORG_CACHE_TTL_MS;
  for (const organizationId of missing) {
    const isFunded = fundedIds.has(organizationId);
    FUNDED_ORG_CACHE.set(organizationId, { funded: isFunded, expiresAt });
    if (isFunded) funded.add(organizationId);
  }

  return funded;
}
