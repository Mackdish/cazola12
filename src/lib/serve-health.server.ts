/**
 * Synthetic serve check. Server-only.
 *
 * Requests an ad for one live zone per format using the real serve path and
 * logs the outcome, so a platform that has silently stopped filling is noticed
 * by us rather than by a publisher. It never records an impression, so it never
 * bills anyone.
 *
 * Log lines to alert on in Workers Logs:
 *   [synthetic] FAILING   - the signing secret is bad, or zones serve nothing
 *   [synthetic] DEGRADED  - some zones fall back to the house ad
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type SyntheticOutcome = "ad" | "house_ad" | "no_ad" | "error";

export type SyntheticZoneResult = {
  zone: string;
  format: string;
  outcome: SyntheticOutcome;
  reason?: string;
  ms: number;
};

export type SyntheticReport = {
  status: "healthy" | "degraded" | "failing" | "idle";
  secret: string;
  zones: SyntheticZoneResult[];
};

/** One zone per format: enough coverage without hammering the database. */
export function pickZonesByFormat<T extends { format: string }>(zones: T[], max = 6): T[] {
  const seen = new Set<string>();
  const picked: T[] = [];
  for (const zone of zones) {
    if (seen.has(zone.format)) continue;
    seen.add(zone.format);
    picked.push(zone);
    if (picked.length >= max) break;
  }
  return picked;
}

export function summarize(
  secret: string,
  zones: SyntheticZoneResult[],
): SyntheticReport["status"] {
  if (secret !== "ok") return "failing";
  if (zones.length === 0) return "idle";
  if (zones.some((z) => z.outcome === "error")) return "failing";
  const filled = zones.filter((z) => z.outcome === "ad").length;
  if (filled === zones.length) return "healthy";
  // Nothing filled at all while zones exist: serving is effectively down.
  return filled === 0 ? "failing" : "degraded";
}

export async function runSyntheticServeCheck(): Promise<SyntheticReport> {
  const { tokenSecretStatus } = await import("@/lib/ad-token.server");
  const secret = tokenSecretStatus();

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const client = supabaseAdmin as unknown as SupabaseClient;
  const { data, error } = await client
    .from("ad_zones")
    .select("zone_key, format, websites!inner(status, approval_status, verification_status)")
    .eq("status", "active")
    .eq("websites.status", "active")
    .eq("websites.approval_status", "approved")
    .eq("websites.verification_status", "verified")
    .limit(60);

  if (error) {
    console.error("[synthetic] zone lookup failed", error.message);
    return { status: "failing", secret, zones: [] };
  }

  const zones = pickZonesByFormat((data ?? []) as { zone_key: string; format: string }[]);
  const { serveAd } = await import("@/lib/ad-serving.server");

  const results: SyntheticZoneResult[] = [];
  for (const zone of zones) {
    const t0 = Date.now();
    try {
      const res = await serveAd({
        zoneKey: zone.zone_key,
        userAgent: "TradeMall-Synthetic/1.0",
        country: null,
        county: null,
        city: null,
        requestId: crypto.randomUUID(),
        // No IP / origin: skips the blocklist and the domain binding on purpose.
        ipAddress: "",
        origin: null,
      });
      const outcome: SyntheticOutcome = !res.ok
        ? "no_ad"
        : res.fillType === "house_ad"
          ? "house_ad"
          : "ad";
      results.push({
        zone: zone.zone_key,
        format: zone.format,
        outcome,
        ...(res.ok ? {} : { reason: res.reason }),
        ms: Date.now() - t0,
      });
    } catch (e) {
      results.push({
        zone: zone.zone_key,
        format: zone.format,
        outcome: "error",
        reason: e instanceof Error ? e.message : String(e),
        ms: Date.now() - t0,
      });
    }
  }

  const status = summarize(secret, results);
  const report: SyntheticReport = { status, secret, zones: results };
  if (status === "failing") console.error("[synthetic] FAILING", report);
  else if (status === "degraded") console.warn("[synthetic] DEGRADED", report);
  else console.info("[synthetic] ok", { status, zones: results.length });
  return report;
}
