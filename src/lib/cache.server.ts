import { redis } from "@/lib/redis.server";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/**
 * @upstash/redis deserializes JSON automatically, so a value written with
 * `JSON.stringify(...)` comes back from `get()` already parsed (an object), not
 * as the original string. Calling `JSON.parse` on that object throws
 * ("[object Object]" is not valid JSON), which made every cache read fail and
 * fall through to the database while paying for the wasted Redis round trips.
 * Accept both shapes: raw JSON text is parsed, anything already decoded is
 * returned as is.
 */
export function decodeCached<T>(raw: unknown): T {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as T;
    }
  }
  return raw as T;
}

async function getVersion(versionKey: string): Promise<number> {
  if (!redis) return 1;
  try {
    const v = await redis.get<number>(versionKey);
    if (v != null && Number.isInteger(v)) return v;
  } catch (err) {
    console.error("[cache] version get failed", err);
  }
  return 1;
}

async function bumpVersion(versionKey: string): Promise<number> {
  if (!redis) return 1;
  try {
    const next = await redis.incr(versionKey);
    if (next === 1) await redis.expire(versionKey, 86400);
    return next;
  } catch (err) {
    console.error("[cache] version bump failed", err);
    return 1;
  }
}

export async function cachedGet<T extends JsonValue>(
  key: string,
  ttlSeconds: number,
  supplier: () => Promise<T>,
): Promise<T> {
  if (!redis) return supplier();

  try {
    const cached = await redis.get<unknown>(key);
    if (cached !== null) {
      return decodeCached<T>(cached);
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

export async function cachedGetVersioned<T extends JsonValue>(
  opts: {
    prefix: string;
    id: string;
    ttlSeconds: number;
    supplier: () => Promise<T>;
    legacyKey?: string;
  },
): Promise<T> {
  const versionKey = `${opts.prefix}:${opts.id}:version`;
  const version = await getVersion(versionKey);
  const versionedKey = `${opts.prefix}:${opts.id}:v${version}`;

  if (!redis) return opts.supplier();

  try {
    const cached = await redis.get<unknown>(versionedKey);
    if (cached !== null) {
      return decodeCached<T>(cached);
    }
  } catch (err) {
    console.error("[cache] versioned get failed", err);
  }

  if (opts.legacyKey) {
    try {
      const legacy = await redis.get<unknown>(opts.legacyKey);
      if (legacy !== null) {
        return decodeCached<T>(legacy);
      }
    } catch (err) {
      console.error("[cache] legacy get failed", err);
    }
  }

  const value = await opts.supplier();

  try {
    await redis.setex(versionedKey, opts.ttlSeconds, JSON.stringify(value));
  } catch (err) {
    console.error("[cache] versioned set failed", err);
  }

  return value;
}

export async function cacheBumpVersion(prefix: string, id: string): Promise<void> {
  await bumpVersion(`${prefix}:${id}:version`);
}

export async function cachedServePathGet<T extends JsonValue>(
  key: string,
  ttlSeconds: number,
  supplier: () => Promise<T>,
): Promise<T> {
  const cacheKey = `zone_context:v2:${key}`;
  if (!redis) return supplier();

  try {
    const cached = await redis.get<unknown>(cacheKey);
    if (cached !== null) {
      console.debug("[ad] zone_context cache_hit=true", key);
      return decodeCached<T>(cached);
    }
  } catch (err) {
    console.error("[cache] zone_context get failed", err);
  }

  console.debug("[ad] zone_context cache_hit=false", key);
  const value = await supplier();

  try {
    await redis.setex(cacheKey, ttlSeconds, JSON.stringify(value));
  } catch (err) {
    console.error("[cache] zone_context set failed", err);
  }

  return value;
}

export async function invalidateZoneContextCache(zoneKeys: string[]): Promise<void> {
  if (!redis || zoneKeys.length === 0) return;
  try {
    await Promise.all(zoneKeys.map((key) => cacheDelete(`zone_context:v2:${key}`)));
  } catch (err) {
    console.error("[cache] zone_context invalidation failed", err);
  }
}
