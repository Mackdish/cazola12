/**
 * GET /api/v1/ad-zones
 * POST /api/v1/ad-zones
 *
 * Publisher ad zone endpoints.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { listAdZones, createAdZone } from "@/lib/publisher-service.server";
import { authenticateRequest } from "@/lib/api-auth.server";
import { assertPublisherAccess } from "@/lib/api-authorization.server";
import { jsonResponse, serverError } from "@/lib/api-response";
import { corsHeaders, preflight } from "@/lib/api-v1.server";

const formatEnum = z.enum([
  "300x250",
  "336x280",
  "728x90",
  "970x250",
  "320x50",
  "320x100",
  "responsive",
]);

const createZoneSchema = z.object({
  name: z.string().trim().min(2).max(120),
  website_id: z.string().uuid(),
  format: formatEnum,
  width: z.number().int().positive().optional().nullable(),
  height: z.number().int().positive().optional().nullable(),
  responsive: z.boolean().optional().default(false),
});

export const Route = createFileRoute("/api/v1/ad-zones/")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => preflight("GET, POST", request.headers.get("origin")),

      GET: async ({ request }) => {
        const authResult = await authenticateRequest(request);
        if (!authResult.authenticated) return authResult.response!;

        const url = new URL(request.url);
        let organizationId =
          url.searchParams.get("organization_id") ?? authResult.context.organizationId;
        const websiteId = url.searchParams.get("website_id");

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
          const zones = await listAdZones(
            { supabase: supabaseAdmin as never, userId: authResult.context.userId } as never,
            organizationId,
          );
          return jsonResponse(
            { ok: true, data: zones },
            200,
            corsHeaders("GET", request.headers.get("origin")),
          );
        } catch {
          return serverError("Failed to fetch ad zones");
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

        const parsed = createZoneSchema.safeParse(body);
        if (!parsed.success) {
          return jsonResponse(
            { ok: false, error: "validation_error", details: parsed.error.flatten().fieldErrors },
            400,
          );
        }

        try {
          const zone = await createAdZone(
            { supabase: supabaseAdmin as never, userId: authResult.context.userId } as never,
            {
              websiteId: parsed.data.website_id,
              name: parsed.data.name,
              format: parsed.data.format,
            },
          );
          return jsonResponse(
            { ok: true, data: zone },
            201,
            corsHeaders("POST", request.headers.get("origin")),
          );
        } catch {
          return serverError("Failed to create ad zone");
        }
      },
    },
  },
});
