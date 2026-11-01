/**
 * Billing safety net. Server-only.
 *
 * Impressions and clicks are inserted first and billed second. When the billing
 * step fails in between, the event stays recorded but unbilled (and a client
 * retry can't fix it: the duplicate request_id short-circuits before billing).
 * `retryUnbilledEvents` finds those events and bills them. charge_campaign_event
 * is idempotent on (request_id, event_type), so a retry can never double-charge.
 *
 * `reconcileBilling` compares the ledgers that must always agree and logs loudly
 * when they do not.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type RetryResult = {
  scanned: number;
  charged: number;
  settled: number; // duplicate: someone else billed it first
  skipped: number; // terminal reasons: paused / no funds / not billable
  failed: number; // transient errors, retried later
};

type UnbilledRow = {
  event_type: "impression" | "click";
  request_id: string;
  campaign_id: string;
  ad_id: string;
  publisher_id: string;
  website_id: string;
  ad_zone_id: string;
};

// Reasons that will not fix themselves in the next few minutes.
const TERMINAL = new Set([
  "not_billable",
  "campaign_inactive",
  "unknown_campaign",
  "budget_exhausted",
  "insufficient_funds",
  "no_wallet",
  "invalid_request",
]);

async function admin(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient;
}

export async function retryUnbilledEvents(limit = 50): Promise<RetryResult> {
  const result: RetryResult = { scanned: 0, charged: 0, settled: 0, skipped: 0, failed: 0 };
  const client = await admin();

  const { data, error } = await client.rpc("find_unbilled_events", { _limit: limit });
  if (error) {
    // Most likely the migration has not been applied yet.
    console.error("[billing-retry] scan failed", error.message);
    return result;
  }

  const rows = (data ?? []) as UnbilledRow[];
  result.scanned = rows.length;
  if (rows.length === 0) return result;

  const { chargeAdEvent } = await import("@/lib/billing-charge.server");

  for (const row of rows) {
    const charge = await chargeAdEvent({
      eventType: row.event_type,
      requestId: row.request_id,
      campaignId: row.campaign_id,
      adId: row.ad_id,
      publisherId: row.publisher_id,
      websiteId: row.website_id,
      adZoneId: row.ad_zone_id,
    });

    if (charge.ok) {
      result.charged += 1;
      continue;
    }
    if (charge.reason === "duplicate") {
      result.settled += 1;
      continue;
    }
    if (TERMINAL.has(charge.reason)) result.skipped += 1;
    else result.failed += 1;

    // Count the attempt so a stuck event backs off and eventually stops being
    // retried instead of starving newer events.
    const { error: attemptError } = await client.rpc("record_billing_retry", {
      _event_type: row.event_type,
      _request_id: row.request_id,
      _reason: charge.reason,
    });
    if (attemptError) console.warn("[billing-retry] attempt not recorded", attemptError.message);
  }

  if (result.charged > 0 || result.failed > 0) {
    console.warn("[billing-retry] recovered unbilled events", result);
  }
  return result;
}

export type ReconciliationDay = {
  day: string;
  impressions: number;
  clicks: number;
  spend_rows: number;
  spend_total: number;
  wallet_debit_total: number;
  publisher_gross_total: number;
  wallet_diff: number;
  publisher_diff: number;
  unbilled_events: number;
};

/** Differences below this are rounding noise (amounts are stored to 6 dp). */
const TOLERANCE = 0.01;

export function findReconciliationProblems(days: ReconciliationDay[]): ReconciliationDay[] {
  return days.filter(
    (d) =>
      Math.abs(Number(d.wallet_diff)) > TOLERANCE ||
      Math.abs(Number(d.publisher_diff)) > TOLERANCE ||
      Number(d.unbilled_events) > 0,
  );
}

export async function reconcileBilling(days = 3): Promise<{
  checked: number;
  problems: ReconciliationDay[];
}> {
  const client = await admin();
  const { data, error } = await client.rpc("billing_reconciliation", { _days: days });
  if (error) {
    console.error("[billing-reconcile] failed", error.message);
    return { checked: 0, problems: [] };
  }
  const rows = ((data ?? []) as ReconciliationDay[]).map((r) => ({
    ...r,
    wallet_diff: Number(r.wallet_diff),
    publisher_diff: Number(r.publisher_diff),
    unbilled_events: Number(r.unbilled_events),
  }));
  const problems = findReconciliationProblems(rows);
  if (problems.length > 0) {
    console.error("[billing-reconcile] LEDGER MISMATCH", { problems });
  } else {
    console.info("[billing-reconcile] ledgers agree", { days: rows.length });
  }
  return { checked: rows.length, problems };
}
