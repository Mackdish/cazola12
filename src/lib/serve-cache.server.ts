/**
 * In-memory serve cache for v1 ad requests.
 *
 * Maps request_id -> { timestamp, zoneId, adId, campaignId, publisherId, websiteId }
 * so the event endpoints can validate that an impression/click corresponds to
 * a real ad serve without relying on HMAC tokens.
 *
 * TTL: 5 minutes. Entries are lazily evicted on read.
 */

type ServeRecord = {
  ts: number;
  zoneId: string;
  adId: string;
  campaignId: string;
  publisherId: string;
  websiteId: string;
};

const CACHE = new Map<string, ServeRecord>();
const TTL_MS = 5 * 60 * 1000;

export function recordServe(input: {
  requestId: string;
  zoneId: string;
  adId: string;
  campaignId: string;
  publisherId: string;
  websiteId: string;
}): void {
  CACHE.set(input.requestId, {
    ts: Date.now(),
    zoneId: input.zoneId,
    adId: input.adId,
    campaignId: input.campaignId,
    publisherId: input.publisherId,
    websiteId: input.websiteId,
  });
  evict();
}

export function consumeServe(requestId: string): ServeRecord | null {
  evict();
  const record = CACHE.get(requestId);
  if (!record) return null;
  CACHE.delete(requestId);
  return record;
}

export function validateServe(requestId: string): ServeRecord | null {
  evict();
  const record = CACHE.get(requestId);
  if (!record) return null;
  return record;
}

function evict(): void {
  const now = Date.now();
  for (const [key, record] of CACHE) {
    if (now - record.ts > TTL_MS) CACHE.delete(key);
  }
}
