/**
 * Shared plumbing for /api/v1 route handlers: CORS, auth + org resolution,
 * JSON body parsing and error mapping. Server-only.
 */
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { authenticateRequest, type AuthenticatedContext } from "@/lib/api-auth.server";
import { jsonResponse } from "@/lib/api-response";

const DEFAULT_ALLOWED_ORIGINS = [
  "https://trademall.co.ke",
  "http://localhost:5173",
  "http://localhost:3000",
];

function getAllowedOrigin(requestOrigin: string | null): string | null {
  if (!requestOrigin) return null;
  const envOrigins = (process.env["CORS_ALLOWED_ORIGINS"] || "").split(",").map((o) => o.trim()).filter(Boolean);
  const allowed = envOrigins.length > 0 ? envOrigins : DEFAULT_ALLOWED_ORIGINS;
  if (allowed.includes(requestOrigin)) return requestOrigin;
  return null;
}

export function corsHeaders(methods: string, requestOrigin: string | null = null): Record<string, string> {
  const allowedOrigin = getAllowedOrigin(requestOrigin);
  if (!allowedOrigin) {
    return {
      "Access-Control-Allow-Methods": `${methods}, OPTIONS`,
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    };
  }
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": `${methods}, OPTIONS`,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

export function preflight(methods: string, requestOrigin: string | null = null): Response {
  const allowedOrigin = getAllowedOrigin(requestOrigin);
  if (!allowedOrigin) {
    return new Response(JSON.stringify({ ok: false, error: "forbidden", message: "Origin not allowed" }), {
      status: 403,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
  return new Response(null, { status: 204, headers: corsHeaders(methods, requestOrigin) });
}

export function publicCorsHeaders(methods: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": `${methods}, OPTIONS`,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

export function publicPreflight(methods: string): Response {
  return new Response(null, { status: 204, headers: publicCorsHeaders(methods) });
}

/** Service-role context shaped like the one the domain services expect. */
export function adminCtx(userId: string) {
  return { supabase: supabaseAdmin as never, userId } as never;
}

export type AuthOk = { ok: true; context: AuthenticatedContext };
export type AuthFail = { ok: false; response: Response };

export async function requireAuth(request: Request): Promise<AuthOk | AuthFail> {
  const result = await authenticateRequest(request);
  if (!result.authenticated) return { ok: false, response: result.response };
  return { ok: true, context: result.context };
}

/**
 * Resolves the organization for a request: API keys are pinned to their own
 * organization, session callers may pass ?organization_id=.
 */
export function resolveOrganizationId(
  request: Request,
  context: AuthenticatedContext,
): { ok: true; organizationId: string } | { ok: false; response: Response } {
  const fromQuery = new URL(request.url).searchParams.get("organization_id");
  const organizationId =
    context.authMethod === "api_key" ? context.organizationId : (fromQuery ?? context.organizationId);

  if (!z.string().uuid().safeParse(organizationId).success) {
    return {
      ok: false,
      response: jsonResponse(
        { ok: false, error: "invalid_request", message: "Invalid or missing organization_id" },
        400,
      ),
    };
  }
  return { ok: true, organizationId };
}

export async function parseJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
  maxBytes = 1024 * 1024,
): Promise<{ ok: true; data: T } | { ok: false; response: Response }> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > maxBytes) {
    return {
      ok: false,
      response: jsonResponse(
        { ok: false, error: "invalid_request", message: `Request body exceeds maximum size of ${maxBytes} bytes` },
        413,
      ),
    };
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: jsonResponse({ ok: false, error: "invalid_request", message: "Invalid JSON body" }, 400),
    };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: jsonResponse(
        {
          ok: false,
          error: "validation_error",
          message: "Request validation failed",
          details: parsed.error.flatten().fieldErrors,
        },
        400,
      ),
    };
  }
  return { ok: true, data: parsed.data };
}

/** Domain services throw friendly Errors; surface the message, never a stack. */
export function domainError(error: unknown, fallback: string): Response {
  const message = error instanceof Error && error.message ? error.message : fallback;
  const safe = message.length <= 200 && !/\n|select |insert |update /i.test(message);
  return jsonResponse({ ok: false, error: "invalid_request", message: safe ? message : fallback }, 400);
}

export async function organizationOfRow(
  table: "ads" | "ad_zones" | "websites" | "campaigns",
  id: string,
): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from(table)
    .select("organization_id")
    .eq("id", id)
    .maybeSingle();
  return (data as { organization_id: string } | null)?.organization_id ?? null;
}
