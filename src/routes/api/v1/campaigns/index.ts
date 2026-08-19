/**
 * GET /api/v1/campaigns
 * POST /api/v1/campaigns
 *
 * Campaign endpoints for advertisers. Advertisers can only access their own campaigns.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { listCampaigns, createCampaign } from "@/lib/advertiser-service.server";
import { authenticateRequest } from "@/lib/api-auth.server";
import { assertAdvertiserAccess } from "@/lib/api-authorization.server";
import { jsonResponse, validationError, serverError } from "@/lib/api-response";
import { corsHeaders, preflight } from "@/lib/api-v1.server";

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
} as const;

const uuid = z.string().uuid();
const objectiveEnum = z.enum(["awareness", "traffic", "engagement", "conversions", "app_installs"]);
const bidEnum = z.enum(["cpm", "cpc"]);
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const createCampaignSchema = z.object({
  name: z.string().trim().min(2).max(120),
  objective: objectiveEnum,
  bid_type: bidEnum,
  bid_amount: z.number().min(0).max(10_000),
  total_budget: z.number().min(0).max(100_000_000),
  daily_budget: z.number().min(0).max(100_000_000).optional().nullable(),
  start_date: dateString.optional().nullable(),
  end_date: dateString.optional().nullable(),
  landing_page_url: z.string().trim().min(4).max(2048),
});

export const Route = createFileRoute("/api/v1/campaigns/")({
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

        // API key auth is scoped to a single organization
        if (authResult.context.authMethod === "api_key") {
          organizationId = authResult.context.organizationId;
        }

        if (!uuid.safeParse(organizationId).success) {
          return jsonResponse(
            { ok: false, error: "invalid_request", message: "Invalid organization_id" },
            400,
          );
        }

        const access = await assertAdvertiserAccess(
          authResult.context.userId,
          organizationId,
          authResult.context.authMethod,
        );
        if (!access.allowed) return access.response!;

        try {
          const campaigns = await listCampaigns(
            { supabase: supabaseAdmin as never, userId: authResult.context.userId } as never,
            organizationId,
          );
          return jsonResponse({ ok: true, data: campaigns }, 200);
        } catch {
          return serverError("Failed to fetch campaigns");
        }
      },

      POST: async ({ request }) => {
        const authResult = await authenticateRequest(request);
        if (!authResult.authenticated) return authResult.response!;

        const organizationId = authResult.context.organizationId;
        const access = await assertAdvertiserAccess(
          authResult.context.userId,
          organizationId,
          authResult.context.authMethod,
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

        const parsed = createCampaignSchema.safeParse(body);
        if (!parsed.success) {
          return jsonResponse(
            { ok: false, error: "validation_error", details: parsed.error.flatten().fieldErrors },
            400,
          );
        }

        try {
          const campaign = await createCampaign(
            { supabase: supabaseAdmin as never, userId: authResult.context.userId } as never,
            {
              organizationId,
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
          return jsonResponse({ ok: true, data: campaign }, 201);
        } catch {
          return serverError("Failed to create campaign");
        }
      },
    },
  },
});
