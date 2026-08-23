import { redis } from "@/lib/redis.server";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

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
    const cached = await redis.get<string>(versionedKey);
    if (cached !== null) {
      return JSON.parse(cached) as T;
    }
  } catch (err) {
    console.error("[cache] versioned get failed", err);
  }

  if (opts.legacyKey) {
    try {
      const legacy = await redis.get<string>(opts.legacyKey);
      if (legacy !== null) {
        return JSON.parse(legacy) as T;
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
