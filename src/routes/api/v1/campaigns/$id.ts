/**
 * GET /api/v1/campaigns/:id
 * PATCH /api/v1/campaigns/:id
 *
 * Campaign detail and update endpoints.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getCampaignDetail, updateCampaign } from "@/lib/advertiser-service.server";
import { authenticateRequest } from "@/lib/api-auth.server";
import { assertAdvertiserAccess } from "@/lib/api-authorization.server";
import { jsonResponse, validationError, notFoundError, serverError } from "@/lib/api-response";
import { corsHeaders, preflight } from "@/lib/api-v1.server";

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
} as const;

const objectiveEnum = z.enum(["awareness", "traffic", "engagement", "conversions", "app_installs"]);
const bidEnum = z.enum(["cpm", "cpc"]);
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const updateCampaignSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  objective: objectiveEnum.optional(),
  bid_type: bidEnum.optional(),
  bid_amount: z.number().min(0).max(10_000).optional(),
  total_budget: z.number().min(0).max(100_000_000).optional(),
  daily_budget: z.number().min(0).max(100_000_000).optional().nullable(),
  start_date: dateString.optional().nullable(),
  end_date: dateString.optional().nullable(),
  landing_page_url: z.string().trim().min(4).max(2048).optional(),
});

export const Route = createFileRoute("/api/v1/campaigns/$id")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) =>
        preflight("GET, PATCH, OPTIONS", request.headers.get("origin")),

      GET: async ({ request, params }) => {
        const authResult = await authenticateRequest(request);
        if (!authResult.authenticated) return authResult.response!;

        const campaignId = params.id;
        if (!z.string().uuid().safeParse(campaignId).success) {
          return jsonResponse(
            { ok: false, error: "invalid_request", message: "Invalid campaign id" },
            400,
          );
        }

        // Look up campaign owner
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
          "analyst",
        );
        if (!access.allowed) return access.response!;

        try {
          const detail = await getCampaignDetail(
            { supabase: supabaseAdmin as never, userId: authResult.context.userId } as never,
            campaignId,
          );
          if (!detail) return notFoundError("Campaign not found");
          return jsonResponse({ ok: true, data: detail }, 200);
        } catch {
          return serverError("Failed to fetch campaign");
        }
      },

      PATCH: async ({ request, params }) => {
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

        const parsed = updateCampaignSchema.safeParse(body);
        if (!parsed.success) {
          return jsonResponse(
            { ok: false, error: "validation_error", details: parsed.error.flatten().fieldErrors },
            400,
          );
        }

        try {
          const updated = await updateCampaign(
            { supabase: supabaseAdmin as never, userId: authResult.context.userId } as never,
            {
              campaignId,
              name: parsed.data.name,
              objective: parsed.data.objective,
              bidType: parsed.data.bid_type,
              bidAmount: parsed.data.bid_amount,
              totalBudget: parsed.data.total_budget,
              dailyBudget: parsed.data.daily_budget,
              startDate: parsed.data.start_date,
              endDate: parsed.data.end_date,
              landingPageUrl: parsed.data.landing_page_url,
            },
          );
          return jsonResponse({ ok: true, data: updated }, 200);
        } catch {
          return serverError("Failed to update campaign");
        }
      },
    },
  },
});
