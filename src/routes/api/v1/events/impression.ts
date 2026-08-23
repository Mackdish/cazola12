/**
 * POST /api/v1/events/impression
 *
 * Records an ad impression. Validates server-side, prevents duplicates,
 * runs fraud detection, and triggers billing.
 *
 * Query parameters:
 *   request_id  - UUID of the ad request (optional, generated if missing)
 *
 * Body:
 *   ad_id       - Ad ID (required)
 *   zone_id     - Ad zone key (required)
 *   device      - Optional device type (desktop, mobile, tablet)
 *   country     - Optional 2-letter country code
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadZoneContext } from "@/lib/ad-serving.server";
import { classifyUserAgent } from "@/lib/ad-serving-domain";
import { recordImpression } from "@/lib/ad-serving.server";
import { checkRateLimit, getRateLimitConfig, extractGeoAndBotScore } from "@/lib/rate-limit.server";
import { jsonResponse, validationError, rateLimitedError, serverError } from "@/lib/api-response";
import { publicCorsHeaders, publicPreflight } from "@/lib/api-v1.server";

const CORS = publicCorsHeaders("POST, OPTIONS");

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  ...CORS,
} as const;

const impressionBodySchema = z.object({
  ad_id: z.string().uuid(),
  zone_id: z
    .string()
    .min(4)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/),
  device: z.enum(["desktop", "mobile", "tablet"]).optional().nullable(),
  country: z.string().max(2).optional().nullable(),
});

export const Route = createFileRoute("/api/v1/events/impression")({
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

        const parsed = impressionBodySchema.safeParse(body);
        if (!parsed.success) {
          return validationError(parsed.error.flatten().fieldErrors);
        }

        const geo = extractGeoAndBotScore(request);
        const ipAddress = geo.ipAddress;

        const rateLimitConfig = getRateLimitConfig("impression");
        try {
          await checkRateLimit(
            supabaseAdmin as unknown as Parameters<typeof checkRateLimit>[0],
            rateLimitConfig,
            ipAddress,
          );
        } catch {
          return rateLimitedError(60);
        }

        // Defense-in-depth: reject events from blocked IPs
        const { redis } = await import("@/lib/redis.server");
        if (redis && ipAddress) {
          const blocked = await redis.sismember("blocked_ips", ipAddress);
          if (blocked) {
            console.warn("[ad] blocklist_event_hit", { ip: ipAddress, event: "impression" });
            const { recordBlockedIpHit } = await import("@/lib/fraud-center.server");
            void recordBlockedIpHit(ipAddress, data.zone_id, "impression");
            return jsonResponse(
              { ok: false, error: "blocked_ip", message: "This IP is blocked" },
              403,
            );
          }
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
          .select("campaign_id, status, approval_status")
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
          device: (data.device ?? agent.device) as never,
          browser: agent.browser as never,
          os: agent.os as never,
          country: geo.country,
          exp: Math.floor(Date.now() / 1000) + 3600,
        };

        const outcome = await recordImpression(
          payload,
          geo.ipAddress,
          userAgent,
          geo.botScore,
          geo.isLikelyBot,
          geo.country,
          geo.region,
        );

        if (outcome === "failed") {
          return serverError("Failed to record impression");
        }

        return jsonResponse({ ok: true, outcome }, 200);
      },
    },
  },
});
