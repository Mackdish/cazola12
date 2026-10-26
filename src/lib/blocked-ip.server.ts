/**
 * Blocked-IP lookup shared by every ad and tracking endpoint.
 *
 * The blocklist is an optimisation layered on top of fraud detection, not a
 * dependency of serving. If Redis is unreachable or misconfigured the lookup
 * must not turn into an HTTP 500 for every visitor on every publisher site, so
 * it fails open and logs loudly instead. Billing and fraud checks still run.
 */
import { redis } from "@/lib/redis.server";

export async function isIpBlocked(ipAddress: string | null | undefined): Promise<boolean> {
  if (!redis || !ipAddress) return false;
  try {
    return Boolean(await redis.sismember("blocked_ips", ipAddress));
  } catch (error) {
    console.error("[ad] blocklist_lookup_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
