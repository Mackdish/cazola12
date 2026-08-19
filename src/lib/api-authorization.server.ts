/**
 * Authorization helpers for v1 route handlers.
 *
 * Since v1 routes may use supabaseAdmin (bypassing RLS), these helpers
 * enforce organization-level access control at the application level.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

export async function assertOrganizationAccess(
  userId: string,
  organizationId: string,
  authMethod?: string,
): Promise<{ allowed: true } | { allowed: false; response: Response }> {
  const client = supabaseAdmin as unknown as SupabaseClient<Database>;

  if (authMethod === "api_key") {
    const { data: apiKey } = await client
      .from("api_keys")
      .select("id")
      .eq("key_id", userId)
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .maybeSingle();

    if (apiKey) return { allowed: true };

    return {
      allowed: false,
      response: new Response(JSON.stringify({ ok: false, error: "forbidden", message: "Access denied" }), {
        status: 403,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    };
  }

  const { data: membership } = await client
    .from("organization_members")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (membership) return { allowed: true };

  const { data: platformRole } = await client
    .from("platform_roles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (platformRole) return { allowed: true };

  return {
    allowed: false,
    response: new Response(JSON.stringify({ ok: false, error: "forbidden", message: "Access denied" }), {
      status: 403,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    }),
  };
}

export async function assertAdvertiserAccess(
  userId: string,
  organizationId: string,
  authMethod?: string,
): Promise<{ allowed: true } | { allowed: false; response: Response }> {
  const access = await assertOrganizationAccess(userId, organizationId, authMethod);
  if (!access.allowed) return access;

  const client = supabaseAdmin as unknown as SupabaseClient<Database>;
  const { data: org } = await client
    .from("organizations")
    .select("type")
    .eq("id", organizationId)
    .maybeSingle();

  if (org?.type === "advertiser") return { allowed: true };

  return {
    allowed: false,
    response: new Response(JSON.stringify({ ok: false, error: "forbidden", message: "Not an advertiser" }), {
      status: 403,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    }),
  };
}

export async function assertPublisherAccess(
  userId: string,
  organizationId: string,
  authMethod?: string,
): Promise<{ allowed: true } | { allowed: false; response: Response }> {
  const access = await assertOrganizationAccess(userId, organizationId, authMethod);
  if (!access.allowed) return access;

  const client = supabaseAdmin as unknown as SupabaseClient<Database>;
  const { data: org } = await client
    .from("organizations")
    .select("type")
    .eq("id", organizationId)
    .maybeSingle();

  if (org?.type === "publisher") return { allowed: true };

  return {
    allowed: false,
    response: new Response(JSON.stringify({ ok: false, error: "forbidden", message: "Not a publisher" }), {
      status: 403,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    }),
  };
}
