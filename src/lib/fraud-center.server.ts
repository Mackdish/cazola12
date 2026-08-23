/**
 * Server-only fraud center service.
 *
 * Provides admin interfaces for investigating and resolving fraud signals.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;
type Ctx = { supabase: Client; userId: string };

export class FraudCenterError extends Error {}

function fail(message: string): never {
  throw new FraudCenterError(message);
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Client;
}

export type FraudEvent = Database["public"]["Tables"]["fraud_events"]["Row"];
export type BlockedIp = Database["public"]["Tables"]["blocked_ips"]["Row"];
export type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"];

export type FraudEventFilters = {
  status?: string;
  severity?: string;
  eventType?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};

export async function listFraudEvents(ctx: Ctx, filters: FraudEventFilters = {}) {
  await assertPlatformStaff(ctx);
  const db = await admin();
  let query = (db as any)
    .from("fraud_events")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.severity) query = query.eq("severity", filters.severity);
  if (filters.eventType) query = query.eq("event_type", filters.eventType);
  if (filters.from) query = query.gte("created_at", filters.from);
  if (filters.to) query = query.lte("created_at", filters.to);

  const pageSize = Math.max(1, filters.pageSize ?? 20);
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const [dataRes, countRes] = await Promise.all([
    (
      query as never as {
        range: (from: number, to: number) => Promise<{ data: FraudEvent[]; error: Error | null }>;
      }
    ).range(from, to),
    query.select("*", { count: "exact", head: true }),
  ]);

  if (dataRes.error) fail("We couldn't load fraud events.");
  const total = countRes.count ?? 0;

  return {
    events: (dataRes.data ?? []) as FraudEvent[],
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function listBlockedIps(ctx: Ctx) {
  await assertPlatformStaff(ctx);
  const db = await admin();
  const { data, error } = await (db as any)
    .from("blocked_ips")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) fail("We couldn't load blocked IPs.");
  return (data ?? []) as BlockedIp[];
}

export async function listBlockedIpHits(ctx: Ctx, filters: { from?: string; to?: string } = {}) {
  await assertPlatformStaff(ctx);
  const db = await admin();
  let query = (db as any)
    .from("fraud_events")
    .select("*", { count: "exact" })
    .eq("event_type", "blocked_ip")
    .order("created_at", { ascending: false });

  if (filters.from) query = query.gte("created_at", filters.from);
  if (filters.to) query = query.lte("created_at", filters.to);

  const { data, error, count } = await query.limit(100);
  if (error) fail("We couldn't load blocked IP hits.");
  return { hits: (data ?? []) as FraudEvent[], total: count ?? 0 };
}

export async function getBotScoreDistribution(ctx: Ctx, from?: string, to?: string) {
  await assertPlatformStaff(ctx);
  const db = await admin();

  const impressionsQuery = db.from("impressions").select("bot_score").eq("is_likely_bot", true);
  const clicksQuery = db.from("clicks").select("bot_score").eq("is_likely_bot", true);

  if (from) {
    impressionsQuery.gte("created_at", from);
    clicksQuery.gte("created_at", from);
  }
  if (to) {
    impressionsQuery.lte("created_at", to);
    clicksQuery.lte("created_at", to);
  }

  const [{ data: impressions }, { data: clicks }] = await Promise.all([
    impressionsQuery,
    clicksQuery,
  ]);

  const distribution = new Map<string, { label: string; count: number }>();
  const buckets = [
    { key: "0-10", label: "0–10 (likely bot)", min: 0, max: 10 },
    { key: "11-30", label: "11–30 (suspicious)", min: 11, max: 30 },
    { key: "31-50", label: "31–50 (low risk)", min: 31, max: 50 },
    { key: "51-100", label: "51–100 (human)", min: 51, max: 100 },
  ];

  for (const bucket of buckets) {
    distribution.set(bucket.key, { label: bucket.label, count: 0 });
  }

  for (const row of impressions ?? []) {
    if (row.bot_score == null) continue;
    for (const bucket of buckets) {
      if (row.bot_score >= bucket.min && row.bot_score <= bucket.max) {
        const entry = distribution.get(bucket.key)!;
        entry.count += 1;
        break;
      }
    }
  }

  for (const row of clicks ?? []) {
    if (row.bot_score == null) continue;
    for (const bucket of buckets) {
      if (row.bot_score >= bucket.min && row.bot_score <= bucket.max) {
        const entry = distribution.get(bucket.key)!;
        entry.count += 1;
        break;
      }
    }
  }

  return Array.from(distribution.entries()).map(([key, value]) => ({ key, ...value }));
}

export async function listFlaggedEvents(ctx: Ctx, filters: { from?: string; to?: string; page?: number; pageSize?: number } = {}) {
  await assertPlatformStaff(ctx);
  const db = await admin();

  const pageSize = Math.max(1, filters.pageSize ?? 20);
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let impCountQuery = db
    .from("impressions")
    .select("id", { count: "exact", head: true })
    .eq("is_likely_bot", true);

  let clickCountQuery = db
    .from("clicks")
    .select("id", { count: "exact", head: true })
    .eq("is_likely_bot", true);

  if (filters.from) {
    impCountQuery = impCountQuery.gte("created_at", filters.from);
    clickCountQuery = clickCountQuery.gte("created_at", filters.from);
  }
  if (filters.to) {
    impCountQuery = impCountQuery.lte("created_at", filters.to);
    clickCountQuery = clickCountQuery.lte("created_at", filters.to);
  }

  const [{ count: impCount }, { count: clickCount }] = await Promise.all([
    impCountQuery,
    clickCountQuery,
  ]);

  const total = (impCount ?? 0) + (clickCount ?? 0);

  let impDataQuery = db
    .from("impressions")
    .select("id, request_id, campaign_id, publisher_id, website_id, ad_zone_id, ip_address, country, bot_score, is_likely_bot, created_at")
    .eq("is_likely_bot", true)
    .order("created_at", { ascending: false })
    .range(from, to);

  let clickDataQuery = db
    .from("clicks")
    .select("id, request_id, ad_id, campaign_id, publisher_id, website_id, ad_zone_id, ip_address, country, bot_score, is_likely_bot, created_at")
    .eq("is_likely_bot", true)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.from) {
    impDataQuery = impDataQuery.gte("created_at", filters.from);
    clickDataQuery = clickDataQuery.gte("created_at", filters.from);
  }
  if (filters.to) {
    impDataQuery = impDataQuery.lte("created_at", filters.to);
    clickDataQuery = clickDataQuery.lte("created_at", filters.to);
  }

  const [{ data: impressions }, { data: clicks }] = await Promise.all([
    impDataQuery,
    clickDataQuery,
  ]);

  const events = [
    ...(impressions ?? []).map((row: any) => ({ ...row, event_type: "impression" as const })),
    ...(clicks ?? []).map((row: any) => ({ ...row, event_type: "click" as const })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return {
    events: events.slice(0, pageSize),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function recordBlockedIpHit(ipAddress: string, zoneKey: string, eventType: "serve" | "impression" | "click") {
  const { redis } = await import("@/lib/redis.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as unknown as Client;

  const { error } = await db.from("fraud_events").insert({
    event_type: "blocked_ip",
    actor_type: "ip",
    actor_id: ipAddress,
    ip_address: ipAddress,
    target_type: "zone",
    target_id: zoneKey,
    severity: "blocked",
    status: "open",
    score: 0,
    signals: { event: eventType },
    country: null,
    user_agent: null,
  });

  if (error) {
    console.error("[blocklist] failed to record hit", error);
  }
}

export async function blockIp(ctx: Ctx, ipAddress: string, reason: string, durationHours = 24) {
  const db = await admin();
  const { data, error } = await db.rpc(
    "block_ip" as never,
    {
      _ip_address: ipAddress,
      _reason: reason,
      _blocked_by: ctx.userId,
      _duration_hours: durationHours,
    } as never,
  );

  if (error) fail("We couldn't block that IP.");

  const { redis } = await import("@/lib/redis.server");
  if (redis) {
    try {
      await redis.sadd("blocked_ips", ipAddress);
    } catch (err) {
      console.error("[blocklist] redis sync failed on block", err);
    }
  }

  const { logAuditEvent } = await import("@/lib/audit-log.server");
  await logAuditEvent(ctx, {
    action: "fraud.ip_block",
    targetType: "ip_address",
    targetId: ipAddress,
    metadata: { reason, durationHours },
  });

  return data;
}

export async function unblockIp(ctx: Ctx, ipAddress: string) {
  const db = await admin();
  const { data, error } = await db.rpc(
    "unblock_ip" as never,
    {
      _ip_address: ipAddress,
    } as never,
  );

  if (error) fail("We couldn't unblock that IP.");

  const { redis } = await import("@/lib/redis.server");
  if (redis) {
    try {
      await redis.srem("blocked_ips", ipAddress);
    } catch (err) {
      console.error("[blocklist] redis sync failed on unblock", err);
    }
  }

  const { logAuditEvent } = await import("@/lib/audit-log.server");
  await logAuditEvent(ctx, {
    action: "fraud.ip_unblock",
    targetType: "ip_address",
    targetId: ipAddress,
  });

  return data;
}

export async function updateFraudEventStatus(
  ctx: Ctx,
  eventId: string,
  status: string,
  reviewNotes?: string,
) {
  await assertPlatformStaff(ctx);
  const db = await admin();
  const { data, error } = await (db as any)
    .from("fraud_events")
    .update({
      status,
      reviewed_by: ctx.userId,
      reviewed_at: new Date().toISOString(),
      ...(reviewNotes ? { review_notes: reviewNotes } : {}),
    })
    .eq("id", eventId)
    .select("*")
    .maybeSingle();

  if (error) fail("We couldn't update that fraud event.");
  if (!data) fail("That fraud event doesn't exist.");

  const { logAuditEvent } = await import("@/lib/audit-log.server");
  await logAuditEvent(ctx, {
    action: `fraud.event.${status}`,
    targetType: "fraud_event",
    targetId: eventId,
    metadata: { reviewNotes },
  });

  return data as FraudEvent;
}

export async function listAuditLogs(
  ctx: Ctx,
  filters: { action?: string; from?: string; to?: string; page?: number; pageSize?: number } = {},
) {
  const db = await admin();
  let query = (db as any)
    .from("audit_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (filters.action) query = query.eq("action", filters.action);
  if (filters.from) query = query.gte("created_at", filters.from);
  if (filters.to) query = query.lte("created_at", filters.to);

  const pageSize = Math.max(1, filters.pageSize ?? 20);
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const [dataRes, countRes] = await Promise.all([
    (
      query as never as {
        range: (from: number, to: number) => Promise<{ data: AuditLog[]; error: Error | null }>;
      }
    ).range(from, to),
    query.select("*", { count: "exact", head: true }),
  ]);

  if (dataRes.error) fail("We couldn't load audit logs.");
  const total = countRes.count ?? 0;

  return {
    logs: (dataRes.data ?? []) as AuditLog[],
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function syncBlockedIpsToRedis(): Promise<{ synced: number }> {
  const db = await admin();
  const { data, error } = await (db as any)
    .from("blocked_ips")
    .select("ip_address")
    .eq("is_active", true)
    .or("expires_at.is.null,expires_at.gt.now()");

  if (error) {
    console.error("[blocklist] sync failed", error);
    return { synced: 0 };
  }

  const { redis } = await import("@/lib/redis.server");
  if (!redis) return { synced: 0 };

  const ips = (data ?? []).map((row: BlockedIp) => row.ip_address).filter(Boolean);
  if (ips.length === 0) return { synced: 0 };

  try {
    await redis.sadd("blocked_ips", ...ips);
    console.info(`[blocklist] synced ${ips.length} IPs to Redis`);
  } catch (err) {
    console.error("[blocklist] redis sync failed", err);
  }

  return { synced: ips.length };
}

export async function assertPlatformStaff(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("is_platform_staff", { _user_id: ctx.userId });
  if (error) fail("We couldn't verify your permissions.");
  if (!data) fail("This area requires platform staff access.");
}
