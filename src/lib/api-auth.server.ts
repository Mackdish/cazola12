/**
 * Authentication helpers for v1 route handlers.
 *
 * Supports two authentication methods:
 * 1. Supabase JWT: Authorization: Bearer <jwt_token>
 * 2. API key:     Authorization: Bearer <key_id>:<secret>
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { authenticateApiKey, type ApiKeyContext } from "@/lib/api-keys.server";

export type AuthenticatedContext = {
  userId: string;
  organizationId: string;
  authMethod: "supabase" | "api_key";
  apiKeyId?: string;
  permissions: Record<string, string[]>;
};

export type AuthResult =
  | { authenticated: true; context: AuthenticatedContext }
  | { authenticated: false; response: Response };

export async function authenticateRequest(request: Request): Promise<AuthResult> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      authenticated: false,
      response: new Response(JSON.stringify({ ok: false, error: "unauthorized", message: "Missing authorization header" }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    };
  }

  const token = authHeader.slice(7).trim();

  // Try API key authentication first (format: key_id:secret)
  if (token.includes(":")) {
    const apiKeyResult = await authenticateApiKey(request);
    if ("apiKeyId" in apiKeyResult) {
      return {
        authenticated: true,
        context: {
          userId: apiKeyResult.apiKeyId,
          organizationId: apiKeyResult.organizationId,
          authMethod: "api_key",
          apiKeyId: apiKeyResult.apiKeyId,
          permissions: apiKeyResult.permissions,
        },
      };
    }
    // If API key auth fails, fall through to Supabase auth
  }

  // Try Supabase JWT authentication
  try {
    const SUPABASE_URL = process.env["SUPABASE_URL"] || "";

    const SUPABASE_PUBLISHABLE_KEY =
      process.env["SUPABASE_PUBLISHABLE_KEY"] ||
      process.env["SUPABASE_ANON_KEY"] ||
      "";

    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      return {
        authenticated: false,
        response: new Response(JSON.stringify({ ok: false, error: "unauthorized", message: "Missing Supabase environment variables" }), {
          status: 401,
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        }),
      };
    }

    const supabase = createClient<Database>(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY,
      {
        global: {
          headers: { Authorization: `Bearer ${token}` },
        },
        auth: {
          storage: undefined,
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return {
        authenticated: false,
        response: new Response(JSON.stringify({ ok: false, error: "unauthorized", message: "Invalid token" }), {
          status: 401,
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        }),
      };
    }

    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", data.user.id)
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    return {
      authenticated: true,
      context: {
        userId: data.user.id,
        organizationId: (membership as { organization_id: string } | null)?.organization_id ?? data.user.id,
        authMethod: "supabase",
        permissions: {},
      },
    };
  } catch {
    return {
      authenticated: false,
      response: new Response(JSON.stringify({ ok: false, error: "unauthorized", message: "Authentication failed" }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    };
  }
}
