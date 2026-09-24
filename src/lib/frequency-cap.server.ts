import { redis } from "@/lib/redis.server";

export type FrequencyCap = { impressions: number; periodHours: number } | null;

function keyFor(sessionId: string, campaignId: string): string {
  return `fcap:${sessionId}:${campaignId}`;
}

/**
 * Read the current cap without mutating it.
 * A serving request must not consume an impression just because the campaign
 * was considered during the auction.
 */
export async function checkFrequencyCap(
  sessionId: string,
  campaignId: string,
  cap: FrequencyCap,
): Promise<{ capped: boolean; count: number }> {
  if (!cap || !sessionId || !redis) return { capped: false, count: 0 };

  const key = keyFor(sessionId, campaignId);
  try {
    const raw = await redis.get(key);
    const count = Number(raw ?? 0);
    return { capped: count >= cap.impressions, count };
  } catch (error) {
    // Frequency-cap infrastructure is advisory. A Redis outage must not turn
    // a valid ad request into a no-fill response.
    console.warn("[frequency-cap] read failed; failing open", {
      campaignId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { capped: false, count: 0 };
  }
}

/**
 * Consume one frequency-cap impression after a campaign has actually won.
 * This keeps candidate evaluation side-effect free.
 */
export async function recordFrequencyCap(
  sessionId: string,
  campaignId: string,
  cap: FrequencyCap,
): Promise<number> {
  if (!cap || !sessionId || !redis) return 0;

  const key = keyFor(sessionId, campaignId);
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, Math.max(1, Math.ceil(cap.periodHours * 3600)));
  }
  return count;
}
