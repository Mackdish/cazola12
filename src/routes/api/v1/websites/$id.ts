/**
 * GET /api/v1/websites/:id
 *
 * Publisher website detail endpoint.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getWebsiteDetail, updateWebsite } from "@/lib/publisher-service.server";
import { authenticateRequest } from "@/lib/api-auth.server";
import { assertPublisherAccess } from "@/lib/api-authorization.server";
import { jsonResponse, notFoundError, serverError } from "@/lib/api-response";
import { adminCtx, corsHeaders, domainError, parseJsonBody, preflight } from "@/lib/api-v1.server";

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

const updateWebsiteSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  category: websiteCategoryEnum.optional(),
  monthly_pageviews: z.number().int().min(0).nullable().optional(),
});

export const Route = createFileRoute("/api/v1/websites/$id")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) =>
        preflight("GET, PATCH, OPTIONS", request.headers.get("origin")),

      GET: async ({ request, params }) => {
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
        );
        if (!access.allowed) return access.response!;

        try {
          const detail = await getWebsiteDetail(
            { supabase: supabaseAdmin as never, userId: authResult.context.userId } as never,
            websiteId,
          );
          if (!detail) return notFoundError("Website not found");
          return jsonResponse({ ok: true, data: detail }, 200);
        } catch {
          return serverError("Failed to fetch website");
        }
      },

      PATCH: async ({ request, params }) => {
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
        );
        if (!access.allowed) return access.response!;

        const body = await parseJsonBody(request, updateWebsiteSchema);
        if (!body.ok) return body.response;

        try {
          const updated = await updateWebsite(adminCtx(authResult.context.userId), {
            websiteId,
            ...(body.data.name !== undefined ? { name: body.data.name } : {}),
            ...(body.data.description !== undefined ? { description: body.data.description } : {}),
            ...(body.data.category !== undefined ? { category: body.data.category } : {}),
            ...(body.data.monthly_pageviews !== undefined && body.data.monthly_pageviews !== null
              ? { monthlyPageviews: body.data.monthly_pageviews }
              : {}),
          });
          return jsonResponse(
            { ok: true, data: updated },
            200,
            corsHeaders("GET, PATCH, OPTIONS", request.headers.get("origin")),
          );
        } catch (error) {
          return domainError(error, "Failed to update website");
        }
      },
    },
  },
});
