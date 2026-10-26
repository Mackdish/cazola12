/**
 * POST /api/v1/events/click?request_id=<uuid>   body: { token }
 *
 * Records a click for an ad this server actually served and returns the
 * destination. Like the impression endpoint, every field comes from the signed
 * token returned by GET /api/v1/ads/serve, never from the request body.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { recordClick } from "@/lib/ad-serving.server";
import { verifyServedToken } from "@/lib/ad-token.server";
import { isIpBlocked } from "@/lib/blocked-ip.server";
import {
  checkRateLimit,
  getRateLimitConfig,
  extractGeoAndBotScore,
  RateLimitUnavailableError,
} from "@/lib/rate-limit.server";
import { jsonResponse, rateLimitedError } from "@/lib/api-response";
import { publicPreflight } from "@/lib/api-v1.server";

const bodySchema = z.object({ token: z.string().min(20).max(4096) });

export const Route = createFileRoute("/api/v1/events/click")({
  server: {
    handlers: {
      OPTIONS: async () => publicPreflight("POST, OPTIONS"),

      POST: async ({ request }) => {
        const requestId = new URL(request.url).searchParams.get("request_id");
        if (!requestId || !z.string().uuid().safeParse(requestId).success) {
          return jsonResponse(
            { ok: false, error: "invalid_request", message: "A valid request_id is required" },
            400,
          );
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return jsonResponse(
            { ok: false, error: "invalid_request", message: "Invalid JSON body" },
            400,
          );
        }
        const parsed = bodySchema.safeParse(body);
        if (!parsed.success) {
          return jsonResponse(
            { ok: false, error: "invalid_request", message: "A signed token is required" },
            400,
          );
        }

        const payload = verifyServedToken(parsed.data.token);
        if (!payload || payload.rid !== requestId) {
          return jsonResponse(
            { ok: false, error: "invalid_token", message: "Token is invalid or expired" },
            401,
          );
        }

        const geo = extractGeoAndBotScore(request);
        try {
          await checkRateLimit(
            supabaseAdmin as unknown as Parameters<typeof checkRateLimit>[0],
            getRateLimitConfig("click"),
            geo.ipAddress,
          );
        } catch (error) {
          if (!(error instanceof RateLimitUnavailableError)) return rateLimitedError(60);
        }

        if (await isIpBlocked(geo.ipAddress)) {
          console.warn("[ad] blocklist_event_hit", { ip: geo.ipAddress, event: "click" });
          const { recordBlockedIpHit } = await import("@/lib/fraud-center.server");
          void recordBlockedIpHit(geo.ipAddress, payload.zoneId, "click");
          return jsonResponse({ ok: false, error: "blocked_ip", message: "This IP is blocked" }, 403);
        }

        const result = await recordClick(
          payload,
          geo.ipAddress,
          request.headers.get("user-agent") ?? undefined,
          geo.botScore,
          geo.isLikelyBot,
          geo.country,
          geo.region,
        );
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
