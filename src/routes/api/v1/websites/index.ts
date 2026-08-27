/**
 * GET /api/v1/websites
 * POST /api/v1/websites
 *
 * Publisher websites endpoints.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { listWebsites, createWebsite } from "@/lib/publisher-service.server";
import { authenticateRequest } from "@/lib/api-auth.server";
import { assertPublisherAccess } from "@/lib/api-authorization.server";
import { jsonResponse, validationError, serverError } from "@/lib/api-response";
import { corsHeaders, preflight } from "@/lib/api-v1.server";

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
} as const;

const websiteCategoryEnum = z.enum([
  "news",
  "technology",
  "business",
  "finance",
  "entertainment",
  "sports",
  "lifestyle",
  "health",
  "education",
  "travel",
  "gaming",
  "automotive",
  "food",
  "science",
  "other",
]);

const createWebsiteSchema = z.object({
  domain: z.string().trim().min(3).max(255),
  name: z.string().trim().min(2).max(120),
  category: websiteCategoryEnum,
  monthly_pageviews: z.number().int().min(0).optional().nullable(),
});

export const Route = createFileRoute("/api/v1/websites/")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) =>
        preflight("GET, POST, OPTIONS", request.headers.get("origin")),

      GET: async ({ request }) => {
        const authResult = await authenticateRequest(request);
        if (!authResult.authenticated) return authResult.response!;

        const url = new URL(request.url);
        let organizationId =
          url.searchParams.get("organization_id") ?? authResult.context.organizationId;

        if (authResult.context.authMethod === "api_key") {
          organizationId = authResult.context.organizationId;
        }

        if (!z.string().uuid().safeParse(organizationId).success) {
          return jsonResponse(
            { ok: false, error: "invalid_request", message: "Invalid organization_id" },
            400,
          );
        }

        const access = await assertPublisherAccess(
          authResult.context.userId,
          organizationId,
          authResult.context.authMethod,
          "analyst",
        );
        if (!access.allowed) return access.response!;

        try {
          const websites = await listWebsites(
            { supabase: supabaseAdmin as never, userId: authResult.context.userId } as never,
            organizationId,
          );
          return jsonResponse({ ok: true, data: websites }, 200);
        } catch {
          return serverError("Failed to fetch websites");
        }
      },

      POST: async ({ request }) => {
        const authResult = await authenticateRequest(request);
        if (!authResult.authenticated) return authResult.response!;

        const organizationId = authResult.context.organizationId;
        const access = await assertPublisherAccess(
          authResult.context.userId,
          organizationId,
          authResult.context.authMethod,
          "admin",
        );
        if (!access.allowed) return access.response!;

        let body: unknown = null;
        try {
          body = await request.json();
        } catch {
          return jsonResponse(
            { ok: false, error: "invalid_request", message: "Invalid JSON" },
            400,
          );
        }

        const parsed = createWebsiteSchema.safeParse(body);
        if (!parsed.success) {
          return jsonResponse(
            { ok: false, error: "validation_error", details: parsed.error.flatten().fieldErrors },
            400,
          );
        }

        try {
          const website = await createWebsite(
            { supabase: supabaseAdmin as never, userId: authResult.context.userId } as never,
            {
              organizationId,
              domain: parsed.data.domain,
              name: parsed.data.name,
              category: parsed.data.category,
              monthlyPageviews: parsed.data.monthly_pageviews ?? undefined,
            },
          );
          return jsonResponse({ ok: true, data: website }, 201);
        } catch {
          return serverError("Failed to create website");
        }
      },
    },
  },
});
