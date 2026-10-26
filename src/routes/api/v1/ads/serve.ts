/**
 * GET /api/v1/ads/serve
 *
 * Public ad serving endpoint. Validates zone, verifies website approval,
 * selects an eligible ad, and returns only the data required to display it.
 *
 * Query parameters:
 *   zone_id     - The ad zone key (required)
 *   website_id  - The website ID (required)
 *   device      - Optional device type (desktop, mobile, tablet)
 *   page_url    - Optional page URL for targeting
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeCountry } from "@/lib/ad-serving-domain";
import { serveAd } from "@/lib/ad-serving.server";
import { publicCorsHeaders, publicPreflight } from "@/lib/api-v1.server";
import { checkRateLimit, getRateLimitConfig, extractIpAddress } from "@/lib/rate-limit.server";

const CORS = publicCorsHeaders("GET, OPTIONS");

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  ...CORS,
} as const;

const zoneIdSchema = z
  .string()
  .trim()
  .min(4)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);
const websiteIdSchema = z.string().uuid();
const deviceSchema = z.enum(["desktop", "mobile", "tablet"]).optional();
const pageUrlSchema = z.string().url().optional();

export const Route = createFileRoute("/api/v1/ads/serve")({
  server: {
    handlers: {
      OPTIONS: async () => publicPreflight("GET, OPTIONS"),

      GET: async ({ request }) => {
        const url = new URL(request.url);

        const zoneId = zoneIdSchema.safeParse(url.searchParams.get("zone_id") ?? "");
        if (!zoneId.success) {
          return new Response(
            JSON.stringify({ ok: false, error: "invalid_request", message: "Invalid zone_id" }),
            {
              status: 400,
              headers: JSON_HEADERS,
            },
          );
        }

        const websiteId = websiteIdSchema.safeParse(url.searchParams.get("website_id") ?? "");
        if (!websiteId.success) {
          return new Response(
            JSON.stringify({ ok: false, error: "invalid_request", message: "Invalid website_id" }),
            {
              status: 400,
              headers: JSON_HEADERS,
            },
          );
        }

        const device =
          deviceSchema.safeParse(url.searchParams.get("device") ?? undefined).data ?? null;
        const pageUrl =
          pageUrlSchema.safeParse(url.searchParams.get("page_url") ?? undefined).data ?? null;

        const ipAddress = extractIpAddress(request);
        const rateLimitConfig = getRateLimitConfig("ad_request");

        try {
          await checkRateLimit(
            supabaseAdmin as unknown as Parameters<typeof checkRateLimit>[0],
            rateLimitConfig,
            ipAddress,
          );
        } catch {
          return new Response(
            JSON.stringify({ ok: false, error: "rate_limited", message: "Too many requests" }),
            {
              status: 429,
              headers: { ...JSON_HEADERS, "Retry-After": "60" },
            },
          );
        }

        const requestId = crypto.randomUUID();

        const result = await serveAd({
          zoneKey: zoneId.data,
          userAgent: request.headers.get("user-agent"),
          country: normalizeCountry(request.headers.get("cf-ipcountry")),
          county: null,
          city: null,
          requestId,
          ipAddress,
          expectedWebsiteId: websiteId.data,
          origin: request.headers.get("origin"),
        });

        if (!result.ok) {
          const statusMap: Record<string, number> = {
            unknown_zone: 404,
            zone_unavailable: 403,
            blocked_ip: 403,
            no_ad: 204,
          };
          return new Response(
            JSON.stringify({ ok: false, error: "no_ad", message: result.reason }),
            { status: statusMap[result.reason] ?? 204, headers: JSON_HEADERS },
          );
        }

        const origin = url.origin;
        const response: {
          ok: true;
          request_id: string;
          ad: {
            ad_id: string;
            campaign_id: string;
            creative_url: string;
            format: string;
            width: number | null;
            height: number | null;
            click_url: string;
            impression_tracking_url: string;
            /** Signed value to send as `{ token }` to the click and impression URLs. */
            token: string;
          };
        } = {
          ok: true as const,
          request_id: result.requestId,
          ad: {
            ad_id: "",
            campaign_id: "",
            creative_url: result.ad.imageUrl,
            format: result.ad.format,
            width: result.ad.width,
            height: result.ad.height,
            click_url: `${origin}/api/v1/events/click?request_id=${encodeURIComponent(result.requestId)}`,
            impression_tracking_url: `${origin}/api/v1/events/impression?request_id=${encodeURIComponent(result.requestId)}`,
            token: result.token ?? "",
          },
        };

        try {
          const { verifyServedToken } = await import("@/lib/ad-token.server");
          const payload = verifyServedToken(result.token);
          if (payload) {
            response.ad.ad_id = payload.adId;
            response.ad.campaign_id = payload.campaignId;
          }
        } catch {
          // Token verification is best-effort for v1 response enrichment
        }

        return new Response(JSON.stringify(response), { status: 200, headers: JSON_HEADERS });
      },
    },
  },
});
