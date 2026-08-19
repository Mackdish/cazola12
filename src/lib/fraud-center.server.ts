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

export async function assertPlatformStaff(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("is_platform_staff", { _user_id: ctx.userId });
  if (error) fail("We couldn't verify your permissions.");
  if (!data) fail("This area requires platform staff access.");
}
