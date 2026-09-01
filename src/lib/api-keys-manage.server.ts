/**
 * API key issuance / listing / revocation. Server-only.
 *
 * Secrets are shown exactly once, at creation. Only the HMAC hash and the last
 * four characters are stored.
 */
import { createHmac, randomBytes } from "node:crypto";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { readEnv } from "@/lib/runtime-env.server";

const KEY_ID_PREFIX = "tm_";

function getApiKeyPepper(): string {
  const pepper = readEnv("API_KEY_PEPPER");
  if (!pepper) {
    throw new Error(
      "API_KEY_PEPPER missing — checked: runtime env cache, process.env, import.meta.env",
    );
  }
  return pepper;
}

function hashSecret(secret: string): string {
  return createHmac("sha256", getApiKeyPepper()).update(secret).digest("hex");
}

export type IssuedApiKey = {
  id: string;
  key_id: string;
  secret_last4: string;
  status: string;
  permissions: Record<string, string[]>;
  expires_at: string | null;
  created_at: string;
  /** Present only on creation. */
  token?: string;
};

export async function listApiKeys(organizationId: string) {
  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .select("id, key_id, secret_last4, status, permissions, expires_at, created_at, last_used_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (error) throw new Error("We couldn't load API keys.");
  return data ?? [];
}

export async function createApiKey(input: {
  organizationId: string;
  permissions?: Record<string, string[]>;
  expiresAt?: string | null;
}): Promise<IssuedApiKey> {
  const keyId = `${KEY_ID_PREFIX}${randomBytes(9).toString("hex")}`;
  const secret = randomBytes(32).toString("hex");

  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .insert({
      key_id: keyId,
      organization_id: input.organizationId,
      secret_hash: hashSecret(secret),
      secret_last4: secret.slice(-4),
      permissions: (input.permissions ?? {
        campaigns: ["read"],
        ads: ["read"],
        websites: ["read"],
        "ad-zones": ["read"],
      }) as never,
      expires_at: input.expiresAt ?? null,
    })
    .select("id, key_id, secret_last4, status, permissions, expires_at, created_at")
    .single();

  if (error || !data) throw new Error("We couldn't create that API key.");

  return {
    ...(data as unknown as IssuedApiKey),
    token: `${keyId}:${secret}`,
  };
}

export async function revokeApiKey(organizationId: string, keyId: string) {
  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .update({ status: "revoked" })
    .eq("organization_id", organizationId)
    .eq("key_id", keyId)
    .select("id, key_id, status")
    .maybeSingle();
  if (error) throw new Error("We couldn't revoke that API key.");
  return data;
}
