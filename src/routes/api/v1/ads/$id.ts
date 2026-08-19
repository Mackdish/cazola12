/**
 * GET   /api/v1/ads/:id — ad detail
 * PATCH /api/v1/ads/:id — update status or attach a creative
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { attachCreativeToAd, setAdStatus } from "@/lib/advertiser-service.server";
import { assertAdvertiserAccess } from "@/lib/api-authorization.server";
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

const patchSchema = z
  .object({
    status: z.enum(["active", "suspended", "pending"]).optional(),
    media_asset_id: z.string().uuid().optional(),
  })
  .refine((value) => value.status !== undefined || value.media_asset_id !== undefined, {
    message: "Provide status or media_asset_id",
  });

export const Route = createFileRoute("/api/v1/ads/$id")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => preflight(METHODS, request.headers.get("origin")),

      GET: async ({ request, params }) => {
        const auth = await requireAuth(request);
        if (!auth.ok) return auth.response;
        if (!z.string().uuid().safeParse(params.id).success) {
          return jsonResponse(
            { ok: false, error: "invalid_request", message: "Invalid ad id" },
            400,
          );
        }

        const organizationId = await organizationOfRow("ads", params.id);
        if (!organizationId) return notFoundError("Ad not found");

        const access = await assertAdvertiserAccess(
          auth.context.userId,
          organizationId,
          auth.context.authMethod,
        );
        if (!access.allowed) return access.response;

        const { data, error } = await supabaseAdmin
          .from("ads")
          .select(
            "*, campaigns(id, name, status), ad_groups(id, name), media_assets(id, file_name, width, height, mime_type)",
          )
          .eq("id", params.id)
          .maybeSingle();
        if (error) return serverError("Failed to fetch ad");
        if (!data) return notFoundError("Ad not found");
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
            { ok: false, error: "invalid_request", message: "Invalid ad id" },
            400,
          );
        }

        const organizationId = await organizationOfRow("ads", params.id);
        if (!organizationId) return notFoundError("Ad not found");

        const access = await assertAdvertiserAccess(
          auth.context.userId,
          organizationId,
          auth.context.authMethod,
        );
        if (!access.allowed) return access.response;

        const body = await parseJsonBody(request, patchSchema);
        if (!body.ok) return body.response;

        try {
          let result: unknown = null;
          if (body.data.media_asset_id) {
            result = await attachCreativeToAd(adminCtx(auth.context.userId), {
              adId: params.id,
              mediaAssetId: body.data.media_asset_id,
            });
          }
          if (body.data.status) {
            result = await setAdStatus(adminCtx(auth.context.userId), {
              adId: params.id,
              status: body.data.status,
            });
          }
          return jsonResponse(
            { ok: true, data: result },
            200,
            corsHeaders(METHODS, request.headers.get("origin")),
          );
        } catch (error) {
          return domainError(error, "Failed to update ad");
        }
      },
    },
  },
});
