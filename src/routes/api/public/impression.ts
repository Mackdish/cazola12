/**
 * POST /api/public/impression  { token }
 *
 * Records a view. Every field is read from the signed token, so the browser
 * cannot attribute an impression to an ad or publisher it was not served.
 * Duplicate submissions collapse on the unique request_id index.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  checkRateLimit,
  getRateLimitConfig,
  extractGeoAndBotScore,
  RateLimitUnavailableError,
} from "@/lib/rate-limit.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  ...CORS,
} as const;

export const Route = createFileRoute("/api/public/impression")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      POST: async ({ request }) => {
        let token: unknown = null;
        try {
          const body = (await request.json()) as { token?: unknown };
          token = body?.token ?? null;
        } catch {
          token = null;
        }

        const { verifyServedToken } = await import("@/lib/ad-token.server");
        const payload = typeof token === "string" ? verifyServedToken(token) : null;
        if (!payload) {
          return new Response(JSON.stringify({ ok: false }), {
            status: 401,
            headers: JSON_HEADERS,
          });
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
        } catch (error) {
          // A broken limiter must not silently drop billable views. The token is
          // signed and request_id is unique, so failing open here is safe.
          if (!(error instanceof RateLimitUnavailableError)) {
            return new Response(JSON.stringify({ ok: false, reason: "rate_limited" }), {
              status: 429,
              headers: { ...JSON_HEADERS, "Retry-After": "60" },
            });
          }
        }

        const { recordImpression } = await import("@/lib/ad-serving.server");

        const { isIpBlocked } = await import("@/lib/blocked-ip.server");
        {
          if (await isIpBlocked(geo.ipAddress)) {
            console.warn("[ad] blocklist_event_hit", { ip: geo.ipAddress, event: "impression" });
            const { recordBlockedIpHit } = await import("@/lib/fraud-center.server");
            const zoneId = (payload as any).zoneId;
            void recordBlockedIpHit(geo.ipAddress, zoneId, "impression");
            return new Response(JSON.stringify({ ok: false, error: "blocked_ip" }), {
              status: 403,
              headers: JSON_HEADERS,
            });
          }
        }

        const outcome = await recordImpression(
          payload,
          geo.ipAddress,
          request.headers.get("user-agent") ?? undefined,
          geo.botScore,
          geo.isLikelyBot,
          geo.country,
          geo.region,
        );

        return new Response(JSON.stringify({ ok: outcome !== "failed", outcome }), {
          status: outcome === "failed" ? 500 : 200,
          headers: JSON_HEADERS,
        });
      },
    },
  },
});
