/**
 * Server-only audit logging service.
 *
 * Records important administrative and financial events with full context.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Client = SupabaseClient<Database>;
export type Ctx = { supabase: Client; userId: string };

export class AuditError extends Error {}

function fail(message: string): never {
  throw new AuditError(message);
}

async function admin(): Promise<Client> {
  return supabaseAdmin as unknown as Client;
}

export async function logAuditEvent(
  ctx: Ctx,
  input: {
    action: string;
    targetType: string;
    targetId: string;
    targetLabel?: string;
    metadata?: Record<string, unknown>;
  },
  request?: Request,
): Promise<void> {
  const ipAddress = request ? extractIp(request) : undefined;
  const userAgent = request ? (request.headers.get("user-agent") ?? undefined) : undefined;

  const { data: user } = await ctx.supabase.auth.getUser();
  const actorEmail = user?.user?.email ?? "unknown";

  const params: Record<string, unknown> = {
    _actor_id: ctx.userId,
    _actor_email: actorEmail,
    _action: input.action,
    _target_type: input.targetType,
    _target_id: input.targetId,
  };
  if (input.targetLabel) params["_target_label"] = input.targetLabel;
  if (input.metadata && Object.keys(input.metadata).length > 0)
    params["_metadata"] = input.metadata;
  if (ipAddress) params["_ip_address"] = ipAddress;
  if (userAgent) params["_user_agent"] = userAgent;

  await ctx.supabase.rpc("log_audit_event", params as never);
}

export function extractIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

export type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"];

export async function listAuditLogs(
  ctx: Ctx,
  filters: { action?: string; from?: string; to?: string; page?: number; pageSize?: number } = {},
) {
  await assertPlatformStaff(ctx);
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

export async function adminGetAuditLogDetail(ctx: Ctx, logId: string) {
  await assertPlatformStaff(ctx);
  const db = await admin();
  const { data, error } = await (db as any)
    .from("audit_logs")
    .select("*")
    .eq("id", logId)
    .maybeSingle();

  if (error) fail("We couldn't load that audit log.");
  if (!data) fail("That audit log doesn't exist.");
  return data as AuditLog;
}

export async function adminExportAuditLogs(
  ctx: Ctx,
  filters: { action?: string; from?: string; to?: string } = {},
) {
  await assertPlatformStaff(ctx);
  const db = await admin();
  let query = (db as any)
    .from("audit_logs")
    .select(
      "action, actor_email, target_type, target_id, target_label, metadata, ip_address, user_agent, created_at",
    )
    .order("created_at", { ascending: false });

  if (filters.action) query = query.eq("action", filters.action);
  if (filters.from) query = query.gte("created_at", filters.from);
  if (filters.to) query = query.lte("created_at", filters.to);

  const { data, error } = await query;
  if (error) fail("We couldn't export audit logs.");

  const header =
    "Timestamp,Actor Email,Action,Target Type,Target ID,Target Label,IP Address,Metadata\n";
  const rows = (data ?? [])
    .map((row: any) => {
      const meta = row.metadata ? JSON.stringify(row.metadata).replace(/"/g, '""') : "";
      return [
        row.created_at,
        row.actor_email,
        row.action,
        row.target_type,
        row.target_id,
        row.target_label ?? "",
        row.ip_address ?? "",
        meta,
      ]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",");
    })
    .join("\n");

  return header + rows;
}

export async function assertPlatformStaff(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("is_platform_staff", { _user_id: ctx.userId });
  if (error) fail("We couldn't verify your permissions.");
  if (!data) fail("This area requires platform staff access.");
}
