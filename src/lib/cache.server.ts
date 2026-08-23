import { redis } from "@/lib/redis.server";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export async function cachedGet<T extends JsonValue>(
  key: string,
  ttlSeconds: number,
  supplier: () => Promise<T>,
): Promise<T> {
  if (!redis) return supplier();

  try {
    const cached = await redis.get<string>(key);
    if (cached !== null) {
      return JSON.parse(cached) as T;
    }
  } catch (err) {
    console.error("[cache] get failed", err);
  }

  const value = await supplier();

  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (err) {
    console.error("[cache] set failed", err);
  }

  return value;
}

export async function cacheDelete(key: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(key);
  } catch (err) {
    console.error("[cache] delete failed", err);
  }
}
