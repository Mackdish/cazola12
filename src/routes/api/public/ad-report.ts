/**
 * POST /api/public/ad-report
 *
 * Public endpoint for submitting ad reports from publisher websites.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

const JSON_HEADERS = {
  "Content-Type": "application/json",
  ...CORS,
} as const;

const reportSchema = z.object({
  organizationId: z.string().uuid().optional(),
  adId: z.string().uuid().optional(),
  campaignId: z.string().uuid().optional(),
  websiteId: z.string().uuid().optional(),
  adZoneId: z.string().uuid().optional(),
  reason: z.enum(["inappropriate", "misleading", "malicious", "repetitive", "other"]),
  description: z.string().optional(),
  reporterIp: z.string().ip().optional(),
  userAgent: z.string().optional(),
});

export const Route = createFileRoute("/api/public/ad-report")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const input = reportSchema.parse(body);
          const { createAdReport } = await import("@/lib/ad-reports.service.server");
          const report = await createAdReport(input.organizationId || "", {
            adId: input.adId || "",
            campaignId: input.campaignId || "",
            websiteId: input.websiteId || "",
            adZoneId: input.adZoneId || "",
            reason: input.reason,
            description: input.description ?? "",
            reporterIp: input.reporterIp ?? "",
            userAgent: input.userAgent ?? "",
          });
          return Response.json({ success: true, reportId: report.id }, { headers: JSON_HEADERS });
        } catch (error) {
          console.error("Ad report error:", error);
          return Response.json({ success: false, error: "Invalid request" }, { status: 400, headers: JSON_HEADERS });
        }
      },
    },
  },
});
