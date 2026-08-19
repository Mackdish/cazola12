/**
 * POST /api/v1/events/click
 *
 * Records an ad click. Validates server-side, prevents duplicates,
 * runs fraud detection, and triggers billing. Returns the destination URL
 * so the client can redirect.
 *
 * Query parameters:
 *   request_id  - UUID of the ad request (optional)
 *
 * Body:
 *   ad_id       - Ad ID (required)
 *   zone_id     - Ad zone key (required)
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadZoneContext } from "@/lib/ad-serving.server";
import { classifyUserAgent } from "@/lib/ad-serving-domain";
import { recordClick } from "@/lib/ad-serving.server";
import { checkRateLimit, getRateLimitConfig, extractIpAddress } from "@/lib/rate-limit.server";
import { jsonResponse, validationError, rateLimitedError, serverError } from "@/lib/api-response";
import { publicCorsHeaders, publicPreflight } from "@/lib/api-v1.server";

const CORS = publicCorsHeaders("POST, OPTIONS");

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  ...CORS,
} as const;

const clickBodySchema = z.object({
  ad_id: z.string().uuid(),
  zone_id: z
    .string()
    .min(4)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/),
});

export const Route = createFileRoute("/api/v1/events/click")({
  server: {
    handlers: {
      OPTIONS: async () => publicPreflight("POST, OPTIONS"),

      POST: async ({ request }) => {
        const url = new URL(request.url);
        const requestId = url.searchParams.get("request_id");

        if (!requestId || !z.string().uuid().safeParse(requestId).success) {
          return jsonResponse(
            { ok: false, error: "invalid_request", message: "A valid request_id is required" },
            400,
          );
        }

        let body: unknown = null;
        try {
          body = await request.json();
        } catch {
          return jsonResponse(
            { ok: false, error: "invalid_request", message: "Invalid JSON body" },
            400,
          );
        }

        const parsed = clickBodySchema.safeParse(body);
        if (!parsed.success) {
          return validationError(parsed.error.flatten().fieldErrors);
        }

        const data = parsed.data;
        const ipAddress = extractIpAddress(request);
        const userAgent = request.headers.get("user-agent") ?? undefined;

        const rateLimitConfig = getRateLimitConfig("click");
        try {
          await checkRateLimit(
            supabaseAdmin as unknown as Parameters<typeof checkRateLimit>[0],
            rateLimitConfig,
            ipAddress,
          );
        } catch {
          return rateLimitedError(60);
        }

        // Validate zone context
        const zone = await loadZoneContext(data.zone_id);
        if (!zone) {
          return jsonResponse({ ok: false, error: "invalid_zone", message: "Zone not found" }, 404);
        }
        if (
          !zone.zoneStatus ||
          zone.websiteStatus !== "active" ||
          zone.websiteApproval !== "approved"
        ) {
          return jsonResponse(
            { ok: false, error: "zone_unavailable", message: "Zone is not available" },
            403,
          );
        }

        // Validate ad exists and get campaign_id
        const { data: ad } = await supabaseAdmin
          .from("ads")
          .select("campaign_id, status, approval_status, destination_url")
          .eq("id", data.ad_id)
          .maybeSingle();

        if (!ad || ad.status !== "active" || ad.approval_status !== "approved") {
          return jsonResponse(
            { ok: false, error: "ad_unavailable", message: "Ad is not available" },
            404,
          );
        }

        const agent = classifyUserAgent(userAgent);
        const payload = {
          rid: requestId,
          adId: data.ad_id,
          campaignId: ad.campaign_id,
          publisherId: zone.publisherId,
          websiteId: zone.websiteId,
          zoneId: zone.zoneId,
          device: agent.device,
          browser: agent.browser,
          os: agent.os,
          country: null,
          exp: Math.floor(Date.now() / 1000) + 3600,
        };

        const result = await recordClick(payload, ipAddress, userAgent);

        if (!result) {
          return jsonResponse(
            {
              ok: false,
              error: "ad_unavailable",
              message: "This advertisement is no longer available.",
            },
            410,
          );
        }

        return jsonResponse({ ok: true, destination: result.destination }, 200);
      },
    },
  },
});
