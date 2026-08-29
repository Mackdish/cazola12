/**
 * POST /api/v1/websites/:id/verify
 *
 * Initiates website domain verification.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { startVerification } from "@/lib/publisher-service.server";
import { authenticateRequest } from "@/lib/api-auth.server";
import { assertPublisherAccess } from "@/lib/api-authorization.server";
import { jsonResponse, validationError, notFoundError, serverError } from "@/lib/api-response";
import { corsHeaders, preflight } from "@/lib/api-v1.server";
import { checkRateLimit, extractIpAddress, getRateLimitConfig } from "@/lib/rate-limit.server";

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
} as const;

const verifySchema = z.object({
  method: z.enum(["dns_txt", "meta_tag", "html_file"]),
});

export const Route = createFileRoute("/api/v1/websites/$id/verify")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => preflight("POST, OPTIONS", request.headers.get("origin")),

      POST: async ({ request, params }) => {
        const authResult = await authenticateRequest(request);
        if (!authResult.authenticated) return authResult.response!;

        const websiteId = params.id;
        if (!z.string().uuid().safeParse(websiteId).success) {
          return jsonResponse(
            { ok: false, error: "invalid_request", message: "Invalid website id" },
            400,
          );
        }

        const { data: website } = await supabaseAdmin
          .from("websites")
          .select("organization_id")
          .eq("id", websiteId)
          .maybeSingle();

        if (!website) return notFoundError("Website not found");

        const access = await assertPublisherAccess(
          authResult.context.userId,
          website.organization_id,
          authResult.context.authMethod,
          "admin",
        );
        if (!access.allowed) return access.response!;

        checkRateLimit(supabaseAdmin as never, getRateLimitConfig("domain_verification"), extractIpAddress(request), authResult.context.userId, website.organization_id);

        let body: unknown = null;
        try {
          body = await request.json();
        } catch {
          return jsonResponse(
            { ok: false, error: "invalid_request", message: "Invalid JSON" },
            400,
          );
        }

        const parsed = verifySchema.safeParse(body);
        if (!parsed.success) {
          return jsonResponse(
            { ok: false, error: "validation_error", details: parsed.error.flatten().fieldErrors },
            400,
          );
        }

        try {
          const verification = await startVerification(
            { supabase: supabaseAdmin as never, userId: authResult.context.userId } as never,
            { websiteId: websiteId, method: parsed.data.method },
          );
          return jsonResponse({ ok: true, data: verification }, 200);
        } catch {
          return serverError("Failed to start verification");
        }
      },
    },
  },
});
