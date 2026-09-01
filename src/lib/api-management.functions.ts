import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import {
  createApiKeyForOrganization,
  getApiRequestLogs,
  getApiStats,
  listApiKeysForOrganization,
  logApiRequest,
  revokeApiKeyForOrganization,
} from "@/lib/api-management.service.server";

const uuid = z.string().uuid();
const orgInput = z.object({ organizationId: uuid });

export const fetchApiKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => orgInput.parse(data))
  .handler(({ data }) => listApiKeysForOrganization(data.organizationId));

export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        organizationId: uuid,
        name: z.string().trim().min(2).max(120).optional(),
        permissions: z.record(z.string(), z.array(z.string())).optional(),
        expiresAt: z.string().datetime().nullable().optional(),
      })
      .parse(data),
  )
  .handler(({ data }) => {
    const clean = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== undefined),
    ) as Record<string, unknown>;
    const args: Parameters<typeof createApiKeyForOrganization>[0] = {
      organizationId: clean["organizationId"] as string,
    };
    const name = clean["name"];
    if (typeof name === "string") args.name = name;
    const permissions = clean["permissions"];
    if (permissions && typeof permissions === "object")
      args.permissions = permissions as Record<string, string[]>;
    const expiresAt = clean["expiresAt"];
    if (expiresAt === null || typeof expiresAt === "string") args.expiresAt = expiresAt ?? null;
    return createApiKeyForOrganization(args);
  });

export const revokeApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ organizationId: uuid, keyId: z.string() }).parse(data))
  .handler(({ data }) => revokeApiKeyForOrganization(data.organizationId, data.keyId));

export const fetchApiStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => orgInput.parse(data))
  .handler(({ data }) => getApiStats(data.organizationId));

export const fetchApiRequestLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        organizationId: uuid,
        endpoint: z.string().optional(),
        status: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        limit: z.number().int().positive().optional(),
      })
      .parse(data),
  )
  .handler(({ data }) => {
    const { organizationId, ...filters } = data;
    const cleanFilters = Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v !== undefined),
    );
    return getApiRequestLogs(organizationId, cleanFilters as never);
  });

export const logApiRequestFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data }) => {
    const input = (data ?? {}) as {
      organizationId: string;
      endpoint: string;
      method: string;
      statusCode: number;
      status: string;
      responseTimeMs?: number | null;
      ipAddress?: string | null;
      userAgent?: string | null;
      requestBody?: unknown | null;
      responseBody?: unknown | null;
      errorMessage?: string | null;
    };
    await logApiRequest({
      organizationId: input.organizationId,
      endpoint: input.endpoint,
      method: input.method,
      statusCode: input.statusCode,
      status: input.status as Database["public"]["Enums"]["api_request_status"],
      responseTimeMs: input.responseTimeMs ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      requestBody: input.requestBody ?? null,
      responseBody: input.responseBody ?? null,
      errorMessage: input.errorMessage ?? null,
    });
    return { ok: true };
  });
