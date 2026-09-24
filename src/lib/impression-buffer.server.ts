/**
 * Impression event buffering via Redis Streams.
 *
 * Decouples high-volume impression writes from the ad-serving request path:
 *  1. Requests append events to a Redis Stream (XADD).
 *  2. A separate flush worker (scheduled handler / external cron) batch-reads
 *     from the stream using a consumer group and bulk-inserts into Supabase.
 *
 * Graceful degradation: if Redis is unreachable, falls back to the direct
 * Supabase insert path so no impression is silently lost.
 */

import { redis } from "@/lib/redis.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { evaluateImpressionFraud, recordFraudEvent } from "@/lib/fraud-detection.server";
import { chargeAdEvent } from "@/lib/billing-charge.server";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const IMPRESSION_STREAM_KEY = "impressions:stream";
export const IMPRESSION_STREAM_MAX_LEN = 100_000;
export const IMPRESSION_CONSUMER_GROUP = "impression-flush-group";
export const IMPRESSION_CONSUMER_NAME = "worker-1";
export const IMPRESSION_BATCH_SIZE = 500;
export const IMPRESSION_FLUSH_INTERVAL_MS = 10_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ImpressionEvent {
  request_id: string;
  ad_id: string;
  campaign_id: string;
  publisher_id: string;
  website_id: string;
  ad_zone_id: string;
  device_type: string | null;
  browser: string | null;
  operating_system: string | null;
  country: string | null;
  ip_address?: string;
  user_agent?: string;
  bot_score?: number | null;
  is_likely_bot?: boolean;
  region?: string | null;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Persistence check
// ---------------------------------------------------------------------------

export async function checkRedisPersistence(): Promise<{ aof: boolean; rdb: boolean; checked: boolean }> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.warn("[impression-buffer] Cannot check Redis persistence: UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set");
    return { aof: false, rdb: false, checked: false };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${url}/info`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[impression-buffer] Redis INFO check failed: ${response.status} ${response.statusText}`);
      return { aof: false, rdb: false, checked: false };
    }

    const text = await response.text();
    const hasAof = /aof_enabled\s*:\s*1/.test(text) || /aofuse/.test(text);
    const hasRdb = /rdb_last_save_time/.test(text) || /rdb_changes_since_last_save/.test(text);

    if (!hasAof && !hasRdb) {
      console.warn("[impression-buffer] Redis persistence NOT detected. AOF/RDB may be disabled. Buffering is unsafe until persistence is verified.");
    } else {
      console.info(`[impression-buffer] Redis persistence check: aof=${hasAof}, rdb=${hasRdb}`);
    }

    return { aof: hasAof, rdb: hasRdb, checked: true };
  } catch (err) {
    console.warn("[impression-buffer] Redis persistence check error:", err);
    return { aof: false, rdb: false, checked: false };
  }
}

// ---------------------------------------------------------------------------
// Stream write
// ---------------------------------------------------------------------------

export async function bufferImpression(event: ImpressionEvent): Promise<boolean> {
  if (!redis) return false;

  try {
    await redis.xadd(
      IMPRESSION_STREAM_KEY,
      "*",
      { data: JSON.stringify(event) },
      {
        trim: {
          type: "MAXLEN",
          comparison: "~",
          threshold: IMPRESSION_STREAM_MAX_LEN,
        },
      },
    );
    return true;
  } catch (err) {
    console.error("[impression-buffer] xadd failed", err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Consumer group management
// ---------------------------------------------------------------------------

export async function ensureConsumerGroup(): Promise<void> {
  if (!redis) return;

  try {
    await redis.xgroup(
      IMPRESSION_STREAM_KEY,
      {
        type: "CREATE",
        group: IMPRESSION_CONSUMER_GROUP,
        id: "$",
        options: { MKSTREAM: true },
      },
    );
    console.info(`[impression-buffer] Created consumer group ${IMPRESSION_CONSUMER_GROUP}`);
  } catch (err: any) {
    const message = err?.message ?? String(err);
    if (message.includes("BUSYGROUP")) {
      return;
    }
    console.error("[impression-buffer] xgroup create failed", err);
  }
}

// ---------------------------------------------------------------------------
// Batch flush
// ---------------------------------------------------------------------------

export async function flushImpressionBatch(): Promise<{
  flushed: number;
  failed: number;
  durationMs: number;
}> {
  if (!redis) {
    return { flushed: 0, failed: 0, durationMs: 0 };
  }

  const t0 = Date.now();
  let flushed = 0;
  let failed = 0;

  try {
    await ensureConsumerGroup();

    // Read this consumer's pending entries first. A previous implementation
    // only read ">", so an event whose billing step failed became permanently
    // pending and was never retried.
    let result = await redis.xreadgroup(
      IMPRESSION_CONSUMER_GROUP,
      IMPRESSION_CONSUMER_NAME,
      IMPRESSION_STREAM_KEY,
      "0",
      { count: IMPRESSION_BATCH_SIZE },
    );

    if (!result || result.length === 0) {
      result = await redis.xreadgroup(
        IMPRESSION_CONSUMER_GROUP,
        IMPRESSION_CONSUMER_NAME,
        IMPRESSION_STREAM_KEY,
        ">",
        { count: IMPRESSION_BATCH_SIZE },
      );
    }

    if (!result || result.length === 0) {
      return { flushed: 0, failed: 0, durationMs: Date.now() - t0 };
    }

    const events: Array<{ id: string; event: ImpressionEvent }> = [];
    const malformedIds: string[] = [];

    for (const [streamKey, entries] of result as any[]) {
      for (const [id, fields] of entries) {
        try {
          const raw = (fields as any).data;
          if (typeof raw !== "string") throw new Error("missing_data");
          events.push({ id: id as string, event: JSON.parse(raw) as ImpressionEvent });
        } catch {
          // Poison messages can never be processed; acknowledge them so they
          // do not block the consumer forever.
          malformedIds.push(id as string);
          failed++;
        }
      }
    }

    if (malformedIds.length > 0) {
      try {
        await redis.xack(IMPRESSION_STREAM_KEY, IMPRESSION_CONSUMER_GROUP, malformedIds);
      } catch (err) {
        console.error("[impression-buffer] malformed-message xack failed", err);
      }
    }

    if (events.length > 0) {
      const insertError = await bulkInsertImpressions(events.map((entry) => entry.event));
      if (insertError) {
        console.error("[impression-buffer] bulk insert failed", insertError);
        failed += events.length;
      } else {
        const ackIds: string[] = [];
        for (const entry of events) {
          try {
            const processed = await processImpressionEvent(entry.event);
            if (processed) {
              ackIds.push(entry.id);
              flushed++;
            } else {
              // Keep the message pending so transient billing failures are
              // retried on the next flush.
              failed++;
            }
          } catch (err) {
            failed++;
            console.error("[impression-buffer] post-insert processing failed", {
              requestId: entry.event.request_id,
              err,
            });
          }
        }

        if (ackIds.length > 0) {
          try {
            await redis.xack(IMPRESSION_STREAM_KEY, IMPRESSION_CONSUMER_GROUP, ackIds);
          } catch (err) {
            console.error("[impression-buffer] xack failed", err);
          }
        }
      }
    }
  } catch (err) {
    console.error("[impression-buffer] flush batch failed", err);
  }

  const durationMs = Date.now() - t0;
  console.debug("[impression-buffer] flush_complete", {
    flushed,
    failed,
    durationMs,
  });

  return { flushed, failed, durationMs };
}

// ---------------------------------------------------------------------------
// Bulk insert helper
// ---------------------------------------------------------------------------

async function bulkInsertImpressions(events: ImpressionEvent[]): Promise<any> {
  const rows = events.map((e) => ({
    request_id: e.request_id,
    ad_id: e.ad_id,
    campaign_id: e.campaign_id,
    publisher_id: e.publisher_id,
    website_id: e.website_id,
    ad_zone_id: e.ad_zone_id,
    device_type: e.device_type,
    browser: e.browser,
    operating_system: e.operating_system,
    country: e.country,
    ip_address: e.ip_address ?? null,
    region: e.region ?? null,
    bot_score: e.bot_score ?? null,
    is_likely_bot: e.is_likely_bot ?? false,
    created_at: new Date(e.timestamp).toISOString(),
  }));

  const { error } = await supabaseAdmin
    .from("impressions")
    .upsert(rows, { onConflict: "request_id", ignoreDuplicates: true });

  return error;
}

async function processImpressionEvent(event: ImpressionEvent): Promise<boolean> {
  if (event.ip_address) {
    try {
      const evaluation = await evaluateImpressionFraud(supabaseAdmin as never, {
        ipAddress: event.ip_address,
        userAgent: event.user_agent ?? "",
        campaignId: event.campaign_id,
        publisherId: event.publisher_id,
        websiteId: event.website_id,
        adZoneId: event.ad_zone_id,
        requestId: event.request_id,
      });
      await recordFraudEvent(supabaseAdmin as never, evaluation, {
        eventType: "impression_fraud",
        actorType: "ip",
        actorId: event.ip_address,
        targetType: "campaign",
        targetId: event.campaign_id,
        ipAddress: event.ip_address,
        userAgent: event.user_agent ?? "",
        country: event.country ?? "",
      });
    } catch {
      // Fraud detection failure must not break impression recording
    }
  }

  if (!event.is_likely_bot) {
    const charge = await chargeAdEvent({
      eventType: "impression",
      requestId: event.request_id,
      campaignId: event.campaign_id,
      adId: event.ad_id,
      publisherId: event.publisher_id,
      websiteId: event.website_id,
      adZoneId: event.ad_zone_id,
    });

    // Only transient RPC errors should keep the stream message pending.
    // Permanent business outcomes (duplicate, no funds, exhausted budget, etc.)
    // are already resolved and must not be retried forever.
    return charge.ok || charge.reason !== "error";
  }

  if (typeof event.bot_score === "number" && event.bot_score >= 11 && event.bot_score <= 30) {
    console.info("[ad] bot_score_tier_11_30", {
      requestId: event.request_id,
      campaignId: event.campaign_id,
      botScore: event.bot_score,
    });
  }

  return true;
}

// ---------------------------------------------------------------------------
// Backlog / observability
// ---------------------------------------------------------------------------

export async function getStreamBacklog(): Promise<number> {
  if (!redis) return 0;
  try {
    // XLEN counts acknowledged history too. XPENDING is the actual work queue.
    const pending = await redis.xpending(IMPRESSION_STREAM_KEY, IMPRESSION_CONSUMER_GROUP);
    if (typeof pending === "number") return pending;
    if (pending && typeof pending === "object" && "pending" in pending) {
      const count = Number((pending as { pending?: unknown }).pending);
      return Number.isFinite(count) ? count : 0;
    }
    return 0;
  } catch {
    return 0;
  }
}

export async function getPendingInfo(): Promise<any> {
  if (!redis) return null;
  try {
    return await redis.xpending(IMPRESSION_STREAM_KEY, IMPRESSION_CONSUMER_GROUP);
  } catch {
    return null;
  }
}
