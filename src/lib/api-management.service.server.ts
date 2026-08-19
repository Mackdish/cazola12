/**
 * API Management service.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

function hashSecret(secret: string): string {
  return createHmac("sha256", secret).update("trademall-api-key").digest("hex");
}

function timingSafeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "hex");
  const bBuf = Buffer.from(b, "hex");
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export type ApiKey = Database["public"]["Tables"]["api_keys"]["Row"];
export type ApiRequestLog = Database["public"]["Tables"]["api_request_logs"]["Row"];

export async function listApiKeysForOrganization(organizationId: string): Promise<ApiKey[]> {
  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) throw new Error("We couldn't load API keys.");
  return data ?? [];
}

export async function createApiKeyForOrganization(input: {
  organizationId: string;
  name?: string;
  permissions?: Record<string, string[]>;
  expiresAt?: string | null;
}): Promise<ApiKey & { token?: string }> {
  const randomBytes = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const keyId = `tm_${randomBytes.slice(0, 22)}`;
  const secret = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .insert({
      key_id: keyId,
      organization_id: input.organizationId,
      secret_hash: hashSecret(secret),
      secret_last4: secret.slice(-4),
      permissions: (input.permissions ?? {}) as never,
      expires_at: input.expiresAt ?? null,
    })
    .select("*")
    .single();

  if (error || !data) throw new Error("We couldn't create that API key.");

  return {
    ...(data as unknown as ApiKey),
    token: `${keyId}:${secret}`,
  };
}

export async function revokeApiKeyForOrganization(
  organizationId: string,
  keyId: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("api_keys")
    .update({ status: "revoked" })
    .eq("organization_id", organizationId)
    .eq("key_id", keyId);

  if (error) throw new Error("We couldn't revoke that API key.");
}

export async function logApiRequest(input: {
  organizationId: string;
  apiKeyId?: string | null;
  endpoint: string;
  method: string;
  statusCode: number;
  status: Database["public"]["Enums"]["api_request_status"];
  responseTimeMs?: number | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestBody?: unknown | null;
  responseBody?: unknown | null;
  errorMessage?: string | null;
}): Promise<void> {
  try {
    const payload: Record<string, unknown> = {
      organization_id: input.organizationId,
      api_key_id: input.apiKeyId ?? null,
      endpoint: input.endpoint,
      method: input.method,
      status_code: input.statusCode,
      status: input.status,
      response_time_ms: input.responseTimeMs ?? null,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
      error_message: input.errorMessage ?? null,
    };
    if (input.requestBody !== undefined && input.requestBody !== null) {
      payload["request_body"] = input.requestBody;
    }
    if (input.responseBody !== undefined && input.responseBody !== null) {
      payload["response_body"] = input.responseBody;
    }
    await supabaseAdmin.from("api_request_logs").insert(payload as never);
  } catch {
    // Silent fail - logging should not break the API
  }
}

export async function getApiRequestLogs(
  organizationId: string,
  filters?: {
    endpoint?: string;
    status?: string;
    from?: string;
    to?: string;
    limit?: number;
  },
): Promise<ApiRequestLog[]> {
  let query = supabaseAdmin
    .from("api_request_logs")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(filters?.limit ?? 100);

  if (filters?.endpoint) {
    query = query.eq("endpoint", filters.endpoint);
  }
  if (filters?.status) {
    query = query.eq("status", filters.status as never);
  }
  if (filters?.from) {
    query = query.gte("created_at", filters.from);
  }
  if (filters?.to) {
    query = query.lte("created_at", filters.to);
  }

  const { data, error } = await query;
  if (error) throw new Error("We couldn't load API request logs.");
  return data ?? [];
}

export async function getApiStats(organizationId: string): Promise<{
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  todayRequests: number;
  monthRequests: number;
  lastRequest: string | null;
}> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data: allData } = await supabaseAdmin
    .from("api_request_logs")
    .select("status_code, created_at")
    .eq("organization_id", organizationId);

  const logs = allData ?? [];
  const totalRequests = logs.length;
  const successfulRequests = logs.filter((l) => l.status_code >= 200 && l.status_code < 300).length;
  const failedRequests = logs.filter((l) => l.status_code >= 400 || l.status_code === 0).length;
  const todayRequests = logs.filter((l) => l.created_at >= todayStart).length;
  const monthRequests = logs.filter((l) => l.created_at >= monthStart).length;
  const lastRequest = logs.length > 0 ? logs[0]!.created_at : null;

  return {
    totalRequests,
    successfulRequests,
    failedRequests,
    todayRequests,
    monthRequests,
    lastRequest,
  };
}
