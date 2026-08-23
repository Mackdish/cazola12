/**
 * GET /api/public/click?t=<token>
 *
 * Controlled redirect. The destination is looked up from the ad row named by
 * the signed token and must still be approved, active and http(s) — there is
 * no way to pass an arbitrary URL through this endpoint.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkRateLimit, getRateLimitConfig, extractGeoAndBotScore } from "@/lib/rate-limit.server";

const HEADERS = {
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
} as const;

export const Route = createFileRoute("/api/public/click")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const { verifyServedToken } = await import("@/lib/ad-token.server");
        const payload = verifyServedToken(url.searchParams.get("t"));
        if (!payload) {
          return new Response("Invalid click", { status: 400, headers: HEADERS });
        }

        const geo = extractGeoAndBotScore(request);
        const ipAddress = geo.ipAddress;
        const rateLimitConfig = getRateLimitConfig("click");

        try {
          await checkRateLimit(
            supabaseAdmin as unknown as Parameters<typeof checkRateLimit>[0],
            rateLimitConfig,
            ipAddress,
          );
        } catch {
          return new Response("Too many clicks. Please wait.", { status: 429, headers: HEADERS });
        }

        const { recordClick } = await import("@/lib/ad-serving.server");

        const { redis } = await import("@/lib/redis.server");
        if (redis && geo.ipAddress) {
          const blocked = await redis.sismember("blocked_ips", geo.ipAddress);
          if (blocked) {
            console.warn("[ad] blocklist_event_hit", { ip: geo.ipAddress, event: "click" });
            const { recordBlockedIpHit } = await import("@/lib/fraud-center.server");
            const zoneId = (payload as any).zoneId;
            void recordBlockedIpHit(geo.ipAddress, zoneId, "click");
            return new Response("This IP is blocked.", { status: 403, headers: HEADERS });
          }
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
          return new Response("This advertisement is no longer available.", {
            status: 410,
            headers: HEADERS,
          });
        }

        return new Response(null, {
          status: 302,
          headers: { ...HEADERS, Location: result.destination, "Referrer-Policy": "no-referrer" },
        });
      },
    },
  },
});
