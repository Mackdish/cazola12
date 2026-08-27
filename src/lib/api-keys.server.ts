/**
 * Server-only API key authentication.
 *
 * API keys are stored hashed. The bearer token format is:
 *   Authorization: Bearer <key_id>:<secret>
 *
 * The key_id is a public identifier. The secret is hashed with SHA-256
 * and compared with timingSafeEqual to prevent timing attacks.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { createHmac, createHash, timingSafeEqual } from "node:crypto";

import type { Database } from "@/integrations/supabase/types";

export type ApiKeyContext = {
  apiKeyId: string;
  organizationId: string;
  permissions: Record<string, string[]>;
};

export type UnauthenticatedError = { status: 401; body: { ok: false; error: string } };
export type ForbiddenError = { status: 403; body: { ok: false; error: string } };

const API_KEY_PREFIX = "tm_";

function getApiKeyPepper(): string {
  const pepper = process.env.API_KEY_PEPPER;
  if (!pepper) {
    throw new Error("API_KEY_PEPPER environment variable is required for API key hashing");
  }
  return pepper;
}

function hashSecret(secret: string): string {
  return createHmac("sha256", getApiKeyPepper()).update(secret).digest("hex");
}

function legacyHashSecret(secret: string): string {
  return createHmac("sha256", secret).update("trademall-api-key").digest("hex");
}

function timingSafeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "hex");
  const bBuf = Buffer.from(b, "hex");
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export async function authenticateApiKey(
  request: Request,
): Promise<ApiKeyContext | UnauthenticatedError> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { status: 401, body: { ok: false, error: "missing_authorization" } };
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return { status: 401, body: { ok: false, error: "missing_token" } };
  }

  const separatorIndex = token.indexOf(":");
  if (separatorIndex === -1) {
    return { status: 401, body: { ok: false, error: "invalid_token_format" } };
  }

  const keyId = token.slice(0, separatorIndex);
  const secret = token.slice(separatorIndex + 1);

  if (!keyId || !secret) {
    return { status: 401, body: { ok: false, error: "invalid_token_format" } };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const client = supabaseAdmin as unknown as SupabaseClient<Database>;

  const { data: apiKey, error } = await client
    .from("api_keys")
    .select("id, key_id, secret_hash, organization_id, permissions, status, expires_at, last_used_at")
    .eq("key_id", keyId)
    .maybeSingle();

  if (error || !apiKey) {
    return { status: 401, body: { ok: false, error: "invalid_api_key" } };
  }

  if (apiKey.status !== "active") {
    return { status: 401, body: { ok: false, error: "api_key_inactive" } };
  }

  if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
    return { status: 401, body: { ok: false, error: "api_key_expired" } };
  }

  const secretHash = hashSecret(secret);
  const legacySecretHash = legacyHashSecret(secret);
  const matchesNew = timingSafeCompare(apiKey.secret_hash, secretHash);
  const matchesLegacy = timingSafeCompare(apiKey.secret_hash, legacySecretHash);

  if (!matchesNew && !matchesLegacy) {
    return { status: 401, body: { ok: false, error: "invalid_api_key" } };
  }

  if (matchesLegacy && !matchesNew) {
    await client
      .from("api_keys")
      .update({ secret_hash: secretHash })
      .eq("id", apiKey.id);
  }

  await client
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", apiKey.id);

  return {
    apiKeyId: apiKey.key_id,
    organizationId: apiKey.organization_id,
    permissions: (apiKey.permissions as Record<string, string[]>) ?? {},
  };
}

export function hasPermission(
  context: ApiKeyContext,
  resource: string,
  action: string,
): boolean {
  const resourcePerms = context.permissions[resource];
  if (!resourcePerms) return false;
  if (resourcePerms.includes("*")) return true;
  return resourcePerms.includes(action);
}

export function assertPermission(
  context: ApiKeyContext,
  resource: string,
  action: string,
): ForbiddenError | null {
  if (!hasPermission(context, resource, action)) {
    return { status: 403, body: { ok: false, error: "insufficient_permissions" } };
  }
  return null;
}
