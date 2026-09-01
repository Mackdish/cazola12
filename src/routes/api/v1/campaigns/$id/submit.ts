/**
 * POST /api/v1/campaigns/:id/submit
 *
 * Submits a campaign for review.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { setCampaignStatus } from "@/lib/advertiser-service.server";
import { authenticateRequest } from "@/lib/api-auth.server";
import { assertAdvertiserAccess } from "@/lib/api-authorization.server";
import { jsonResponse, validationError, notFoundError, serverError } from "@/lib/api-response";
import { corsHeaders, preflight } from "@/lib/api-v1.server";

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
} as const;

const submitSchema = z.object({
  status: z.enum(["pending_review"]),
});

export const Route = createFileRoute("/api/v1/campaigns/$id/submit")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => preflight("POST, OPTIONS", request.headers.get("origin")),

      POST: async ({ request, params }) => {
        const authResult = await authenticateRequest(request);
        if (!authResult.authenticated) return authResult.response!;

        const campaignId = params.id;
        if (!z.string().uuid().safeParse(campaignId).success) {
          return jsonResponse(
            { ok: false, error: "invalid_request", message: "Invalid campaign id" },
            400,
          );
        }

        const { data: campaign } = await supabaseAdmin
          .from("campaigns")
          .select("organization_id")
          .eq("id", campaignId)
          .maybeSingle();

        if (!campaign) return notFoundError("Campaign not found");

        const access = await assertAdvertiserAccess(
          authResult.context.userId,
          campaign.organization_id,
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

        const parsed = submitSchema.safeParse(body);
        if (!parsed.success) {
          return jsonResponse(
            { ok: false, error: "validation_error", details: parsed.error.flatten().fieldErrors },
            400,
          );
        }

        try {
          const updated = await setCampaignStatus(
            { supabase: supabaseAdmin as never, userId: authResult.context.userId } as never,
            { campaignId, status: parsed.data.status },
          );
          return jsonResponse({ ok: true, data: updated }, 200);
        } catch {
          return serverError("Failed to submit campaign");
        }
      },
    },
  },
});
