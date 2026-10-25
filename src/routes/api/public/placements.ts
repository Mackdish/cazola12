/**
 * GET /api/public/placements
 * Returns only enabled, active placement zone keys for the caller's registered website.
 * The browser origin must match the verified/approved website domain.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeDomain } from "@/lib/publisher-domain";
import { resolvePlacementOrigin, sanitizeExcludedPages } from "@/lib/auto-ads-domain";

const baseHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
  "Vary": "Origin, Sec-Fetch-Site",
} as const;

/** Same-origin responses need no CORS header; cross-origin ones echo the caller. */
function responseHeaders(origin: string, sameOrigin: boolean) {
  return sameOrigin ? { ...baseHeaders } : { ...baseHeaders, "Access-Control-Allow-Origin": origin };
}

export const Route = createFileRoute("/api/public/placements")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => {
        const origin = request.headers.get("origin") ?? "null";
        return new Response(null, {
          status: 204,
          headers: { ...baseHeaders, "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400" },
        });
      },
      GET: async ({ request }) => {
        const resolved = resolvePlacementOrigin({
          origin: request.headers.get("origin"),
          secFetchSite: request.headers.get("sec-fetch-site"),
          referer: request.headers.get("referer"),
          requestUrl: request.url,
        });
        if (!resolved) return Response.json({ ok: false, reason: "origin_required" }, { status: 403, headers: baseHeaders });
        const { origin, sameOrigin } = resolved;
        let host: string;
        try { host = new URL(origin).hostname; } catch { return Response.json({ ok: false, reason: "invalid_origin" }, { status: 403, headers: baseHeaders }); }
        const domain = normalizeDomain(host);
        if (!domain) return Response.json({ ok: false, reason: "invalid_origin" }, { status: 403, headers: baseHeaders });

        const { data: website, error: websiteError } = await supabaseAdmin
          .from("websites")
          .select("id, domain")
          .eq("domain", domain)
          .eq("verification_status", "verified")
          .eq("approval_status", "approved")
          .maybeSingle();
        if (websiteError || !website) {
          console.warn("[placements] website_not_registered", { domain, error: websiteError?.message });
          return Response.json({ ok: false, reason: "website_not_registered" }, { status: 403, headers: baseHeaders });
        }

        const { data, error } = await supabaseAdmin
          .from("website_placements")
          .select("placement_key, enabled, ad_zones!inner(zone_key, status)")
          .eq("website_id", website.id)
          .eq("enabled", true);
        if (error) {
          console.error("[placements] lookup_failed", error.message);
          return Response.json({ ok: false, reason: "lookup_failed" }, { status: 500, headers: responseHeaders(origin, sameOrigin) });
        }

        const placements = (data ?? [])
          .filter((row: any) => row.ad_zones?.status === "active" && typeof row.ad_zones?.zone_key === "string")
          .map((row: any) => ({ key: row.placement_key, zone: row.ad_zones.zone_key }));

        // Honour the publisher's "Excluded Pages" Auto Ads setting. A failed
        // lookup must not block ads, so it degrades to "no exclusions".
        const { data: config } = await supabaseAdmin
          .from("auto_ads_config")
          .select("excluded_pages")
          .eq("website_id", website.id)
          .maybeSingle();
        const excluded = sanitizeExcludedPages(config?.excluded_pages);

        if (placements.length === 0) {
          console.warn("[placements] no_active_placements", { domain, websiteId: website.id });
        }
        return Response.json({ ok: true, placements, excluded }, { status: 200, headers: responseHeaders(origin, sameOrigin) });
      },
    },
  },
});
