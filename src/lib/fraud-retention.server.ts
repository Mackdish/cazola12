/**
 * Fraud data retention.
 *
 * Raw IP addresses are retained for a limited window for fraud investigation,
 * then nulled out so the platform does not store identifiable data indefinitely.
 * Country/region/bot_score are kept because they are not identifying on their own.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const IP_RETENTION_DAYS = 90;
export const IP_RETENTION_MS = IP_RETENTION_DAYS * 24 * 60 * 60 * 1000;

export async function purgeExpiredIpAddresses(): Promise<{
  impressionsNulled: number;
  clicksNulled: number;
  durationMs: number;
}> {
  const t0 = Date.now();
  const cutoff = new Date(Date.now() - IP_RETENTION_MS).toISOString();

  let impressionsNulled = 0;
  let clicksNulled = 0;

  try {
    const [{ count: impCount }, { count: clickCount }] = await Promise.all([
      supabaseAdmin
        .from("impressions")
        .update({ ip_address: null })
        .not("ip_address", "is", null)
        .lt("created_at", cutoff)
        .select("*", { count: "exact", head: true }),
      supabaseAdmin
        .from("clicks")
        .update({ ip_address: null })
        .not("ip_address", "is", null)
        .lt("created_at", cutoff)
        .select("*", { count: "exact", head: true }),
    ]);

    impressionsNulled = impCount ?? 0;
    clicksNulled = clickCount ?? 0;
  } catch (err) {
    console.error("[fraud-retention] purge failed", err);
  }

  const durationMs = Date.now() - t0;
  console.info("[fraud-retention] purge_complete", {
    impressionsNulled,
    clicksNulled,
    cutoff,
    durationMs,
  });

  return { impressionsNulled, clicksNulled, durationMs };
}
