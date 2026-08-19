/**
 * GET /api/v1/analytics
 *
 * Analytics endpoint supporting filters for:
 * - campaign
 * - website
 * - ad zone
 * - date range
 * - country
 * - device
 *
 * Returns:
 * - impressions
 * - clicks
 * - CTR
 * - spend
 * - earnings
 * - CPC
 * - CPM
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  getAdvertiserAnalytics,
  getPublisherAnalytics,
  getAdminAnalytics,
  type AdvertiserAnalyticsFilters,
  type PublisherAnalyticsFilters,
  type AdminAnalyticsFilters,
} from "@/lib/analytics-service.server";
import { authenticateRequest } from "@/lib/api-auth.server";
import { assertOrganizationAccess } from "@/lib/api-authorization.server";
import { jsonResponse, validationError, serverError } from "@/lib/api-response";
import { corsHeaders, preflight } from "@/lib/api-v1.server";

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
} as const;

const dateRangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const filtersSchema = z.object({
  date_range: dateRangeSchema,
  campaign_id: z.string().uuid().optional().nullable(),
  website_id: z.string().uuid().optional().nullable(),
  ad_zone_id: z.string().uuid().optional().nullable(),
  country: z.string().max(2).optional().nullable(),
  device: z.enum(["desktop", "mobile", "tablet"]).optional().nullable(),
});

export const Route = createFileRoute("/api/v1/analytics")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => preflight("GET, OPTIONS", request.headers.get("origin")),

      GET: async ({ request }) => {
        const authResult = await authenticateRequest(request);
        if (!authResult.authenticated) return authResult.response!;

        const url = new URL(request.url);
        const organizationId =
          url.searchParams.get("organization_id") ?? authResult.context.organizationId;

        const access = await assertOrganizationAccess(
          authResult.context.userId,
          organizationId,
          authResult.context.authMethod,
        );
        if (!access.allowed) return access.response!;

        const parsed = filtersSchema.safeParse({
          date_range: {
            from: url.searchParams.get("from") ?? "",
            to: url.searchParams.get("to") ?? "",
          },
          campaign_id: url.searchParams.get("campaign_id") ?? null,
          website_id: url.searchParams.get("website_id") ?? null,
          ad_zone_id: url.searchParams.get("ad_zone_id") ?? null,
          country: url.searchParams.get("country") ?? null,
          device: url.searchParams.get("device") ?? null,
        });

        if (!parsed.success) {
          return jsonResponse(
            { ok: false, error: "validation_error", details: parsed.error.flatten().fieldErrors },
            400,
          );
        }

        const filters = parsed.data;

        try {
          const result = await getAdvertiserAnalytics(
            { supabase: supabaseAdmin as never, userId: authResult.context.userId } as never,
            {
              organizationId,
              dateRange: filters.date_range,
              campaignId: filters.campaign_id,
              websiteId: filters.website_id,
              adZoneId: filters.ad_zone_id,
              deviceType: filters.device,
              country: filters.country,
            } as AdvertiserAnalyticsFilters,
          );

          return jsonResponse({ ok: true, data: result }, 200);
        } catch {
          return serverError("Failed to fetch analytics");
        }
      },
    },
  },
});
