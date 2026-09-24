/**
 * GET /api/public/ad?zone=<zone_key>
 *
 * The whole ad request path. Public by design (any publisher page calls it),
 * so it returns only render-critical fields and never touches campaign,
 * bid, budget or advertiser data.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { normalizeCountry } from "@/lib/ad-serving-domain";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  ...CORS,
} as const;

const zoneKeySchema = z
  .string()
  .trim()
  .min(4)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);
const geoSchema = z.string().trim().min(1).max(80).optional();

export const Route = createFileRoute("/api/public/ad")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      GET: async ({ request }) => {
        const url = new URL(request.url);
        const parsedZone = zoneKeySchema.safeParse(url.searchParams.get("zone") ?? "");
        if (!parsedZone.success) {
          return new Response(JSON.stringify({ ok: false, reason: "invalid_zone" }), {
            status: 400,
            headers: JSON_HEADERS,
          });
        }

        const { checkRateLimit, getRateLimitConfig, extractIpAddress } =
          await import("@/lib/rate-limit.server");
        const ipAddress = extractIpAddress(request);
        const rateLimitConfig = getRateLimitConfig("ad_request");

        try {
          await checkRateLimit(
            supabaseAdmin as unknown as Parameters<typeof checkRateLimit>[0],
            rateLimitConfig,
            ipAddress,
          );
        } catch (error) {
          return new Response(JSON.stringify({ ok: false, reason: "rate_limited" }), {
            status: 429,
            headers: { ...JSON_HEADERS, "Retry-After": "60" },
          });
        }

        const { serveAd } = await import("@/lib/ad-serving.server");

        const requestId = crypto.randomUUID();
        const result = await serveAd({
          zoneKey: parsedZone.data,
          userAgent: request.headers.get("user-agent"),
          country: normalizeCountry(request.headers.get("cf-ipcountry")),
          // Cloudflare supplies these at the edge. Do not trust publisher-supplied
          // query parameters for geo targeting; otherwise a visitor could spoof
          // their location and receive campaigns targeted to another area.
          county:
            geoSchema.safeParse(
              request.headers.get("cf-region") ??
                request.headers.get("cf-region-code") ??
                undefined,
            ).data ?? null,
          city:
            geoSchema.safeParse(request.headers.get("cf-ipcity") ?? undefined).data ?? null,
          requestId,
          ipAddress,
          origin: request.headers.get("origin"),
        });

        if (!result.ok) {
          return new Response(JSON.stringify({ ok: false, reason: result.reason }), {
            status: 200,
            headers: JSON_HEADERS,
          });
        }

        const origin = url.origin;
        const isHouseAd = result.fillType === "house_ad";
        const body = {
          ok: true as const,
          requestId: result.requestId,
          ...(result.fillType ? { fillType: result.fillType } : {}),
          ad: {
            ...result.ad,
            clickUrl: isHouseAd
              ? result.ad.clickUrl
              : `${origin}/api/public/click?t=${encodeURIComponent(result.token ?? "")}`,
          },
          ...(isHouseAd
            ? {}
            : {
                impressionUrl: `${origin}/api/public/impression`,
                token: result.token,
              }),
        };

        return new Response(JSON.stringify(body), { status: 200, headers: JSON_HEADERS });
      },
    },
  },
});
