import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  blockIp,
  getBotScoreDistribution,
  listAuditLogs,
  listBlockedIps,
  listBlockedIpHits,
  listFlaggedEvents,
  listFraudEvents,
  unblockIp,
  updateFraudEventStatus,
} from "@/lib/fraud-center.server";
import { adminExportAuditLogs, adminGetAuditLogDetail } from "@/lib/audit-log.server";

const uuid = z.string().uuid();

export const fetchFraudEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        status: z.string().optional(),
        severity: z.string().optional(),
        eventType: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        page: z.number().int().min(1).optional(),
        pageSize: z.number().int().min(1).max(100).optional(),
      })
      .parse(data),
  )
  .handler(({ data, context }) => listFraudEvents(context, data as never));

export const fetchBlockedIps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) => listBlockedIps(context));

export const fetchAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        action: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        page: z.number().int().min(1).optional(),
        pageSize: z.number().int().min(1).max(100).optional(),
      })
      .parse(data),
  )
  .handler(({ data, context }) => listAuditLogs(context, data as never));

export const blockIpAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        ipAddress: z.string().ip(),
        reason: z.string().trim().min(3).max(500),
        durationHours: z.number().int().min(1).max(720).optional(),
      })
      .parse(data),
  )
  .handler(({ data, context }) =>
    blockIp(context, data.ipAddress, data.reason, data.durationHours),
  );

export const unblockIpAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ ipAddress: z.string().ip() }).parse(data))
  .handler(({ data, context }) => unblockIp(context, data.ipAddress));

export const reviewFraudEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        eventId: uuid,
        status: z.enum(["open", "reviewed", "resolved", "dismissed"]),
        reviewNotes: z.string().trim().max(1000).optional().nullable(),
      })
      .parse(data),
  )
  .handler(({ data, context }) =>
    updateFraudEventStatus(context, data.eventId, data.status, data.reviewNotes ?? undefined),
  );

export const fetchAuditLogDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ logId: uuid }).parse(data))
  .handler(({ data, context }) => adminGetAuditLogDetail(context, data.logId));

export const exportAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        action: z.string().optional().nullable(),
        from: z.string().optional().nullable(),
        to: z.string().optional().nullable(),
      })
      .parse(data),
  )
  .handler(({ data, context }) => adminExportAuditLogs(context, data as never));

export const fetchBotScoreDistribution = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .parse(data),
  )
  .handler(({ data, context }) => getBotScoreDistribution(context, data.from, data.to));

export const fetchBlockedIpHits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .parse(data),
  )
  .handler(({ data, context }) => listBlockedIpHits(context, data));

export const fetchFlaggedEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        from: z.string().optional(),
        to: z.string().optional(),
        page: z.number().int().min(1).optional(),
        pageSize: z.number().int().min(1).max(100).optional(),
      })
      .parse(data),
  )
  .handler(({ data, context }) => listFlaggedEvents(context, data));
