/**
 * GET   /api/v1/ad-zones/:id — zone detail (including its embed key)
 * PATCH /api/v1/ad-zones/:id — activate or suspend a zone
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { setAdZoneStatus } from "@/lib/publisher-service.server";
import { assertPublisherAccess } from "@/lib/api-authorization.server";
import { jsonResponse, notFoundError, serverError } from "@/lib/api-response";
import {
  adminCtx,
  corsHeaders,
  domainError,
  organizationOfRow,
  parseJsonBody,
  preflight,
  requireAuth,
} from "@/lib/api-v1.server";

const METHODS = "GET, PATCH";

const patchSchema = z.object({ status: z.enum(["active", "suspended"]) });

export const Route = createFileRoute("/api/v1/ad-zones/$id")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => preflight(METHODS, request.headers.get("origin")),

      GET: async ({ request, params }) => {
        const auth = await requireAuth(request);
        if (!auth.ok) return auth.response;
        if (!z.string().uuid().safeParse(params.id).success) {
          return jsonResponse(
            { ok: false, error: "invalid_request", message: "Invalid zone id" },
            400,
          );
        }

        const organizationId = await organizationOfRow("ad_zones", params.id);
        if (!organizationId) return notFoundError("Ad zone not found");

        const access = await assertPublisherAccess(
          auth.context.userId,
          organizationId,
          auth.context.authMethod,
        );
        if (!access.allowed) return access.response;

        const { data, error } = await supabaseAdmin
          .from("ad_zones")
          .select("*, websites(id, name, domain, status, approval_status)")
          .eq("id", params.id)
          .maybeSingle();
        if (error) return serverError("Failed to fetch ad zone");
        if (!data) return notFoundError("Ad zone not found");
        return jsonResponse(
          { ok: true, data },
          200,
          corsHeaders(METHODS, request.headers.get("origin")),
        );
      },

      PATCH: async ({ request, params }) => {
        const auth = await requireAuth(request);
        if (!auth.ok) return auth.response;
        if (!z.string().uuid().safeParse(params.id).success) {
          return jsonResponse(
            { ok: false, error: "invalid_request", message: "Invalid zone id" },
            400,
          );
        }

        const organizationId = await organizationOfRow("ad_zones", params.id);
        if (!organizationId) return notFoundError("Ad zone not found");

        const access = await assertPublisherAccess(
          auth.context.userId,
          organizationId,
          auth.context.authMethod,
        );
        if (!access.allowed) return access.response;

        const body = await parseJsonBody(request, patchSchema);
        if (!body.ok) return body.response;

        try {
          const zone = await setAdZoneStatus(adminCtx(auth.context.userId), {
            zoneId: params.id,
            status: body.data.status,
          });
          return jsonResponse(
            { ok: true, data: zone },
            200,
            corsHeaders(METHODS, request.headers.get("origin")),
          );
        } catch (error) {
          return domainError(error, "Failed to update ad zone");
        }
      },
    },
  },
});
