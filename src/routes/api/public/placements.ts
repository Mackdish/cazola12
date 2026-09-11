/**
 * GET /api/public/placements
 * Returns only enabled, active placement zone keys for the caller's registered website.
 * The browser origin must match the verified/approved website domain.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeDomain } from "@/lib/publisher-domain";

const baseHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
  "Vary": "Origin",
} as const;

function originHeaders(origin: string) {
  return { ...baseHeaders, "Access-Control-Allow-Origin": origin };
}

export const Route = createFileRoute("/api/public/placements")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => {
        const origin = request.headers.get("origin") ?? "null";
        return new Response(null, {
          status: 204,
          headers: { ...originHeaders(origin), "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400" },
        });
      },
      GET: async ({ request }) => {
        const origin = request.headers.get("origin");
        if (!origin) return Response.json({ ok: false, reason: "origin_required" }, { status: 403, headers: baseHeaders });
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
        if (websiteError || !website) return Response.json({ ok: false, reason: "website_not_registered" }, { status: 403, headers: baseHeaders });

        const { data, error } = await supabaseAdmin
          .from("website_placements")
          .select("placement_key, enabled, ad_zones!inner(zone_key, status)")
          .eq("website_id", website.id)
          .eq("enabled", true);
        if (error) return Response.json({ ok: false, reason: "lookup_failed" }, { status: 500, headers: originHeaders(origin) });

        const placements = (data ?? [])
          .filter((row: any) => row.ad_zones?.status === "active" && typeof row.ad_zones?.zone_key === "string")
          .map((row: any) => ({ key: row.placement_key, zone: row.ad_zones.zone_key }));
        return Response.json({ ok: true, placements }, { status: 200, headers: originHeaders(origin) });
      },
    },
  },
});
