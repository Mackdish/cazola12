import { redis } from "@/lib/redis.server";

export type FrequencyCap = { impressions: number; periodHours: number } | null;

export async function checkFrequencyCap(
  sessionId: string,
  campaignId: string,
  cap: FrequencyCap,
): Promise<{ capped: boolean; count: number }> {
  if (!cap || !sessionId || !redis) return { capped: false, count: 0 };

  const key = `fcap:${sessionId}:${campaignId}`;
  const ttlSeconds = cap.periodHours * 3600;

  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, ttlSeconds);
  }

  return { capped: count > cap.impressions, count };
}
