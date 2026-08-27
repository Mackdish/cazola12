/**
 * GET  /api/v1/ads   — list ads for the caller's organization
 * POST /api/v1/ads   — create an ad
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { listAds, createAd } from "@/lib/advertiser-service.server";
import { assertAdvertiserAccess } from "@/lib/api-authorization.server";
import { jsonResponse, serverError } from "@/lib/api-response";
import {
  adminCtx,
  corsHeaders,
  domainError,
  organizationOfRow,
  parseJsonBody,
  preflight,
  requireAuth,
  resolveOrganizationId,
} from "@/lib/api-v1.server";

const METHODS = "GET, POST";

const formatEnum = z.enum([
  "300x250",
  "336x280",
  "728x90",
  "970x250",
  "320x50",
  "320x100",
  "responsive",
]);

const createAdSchema = z.object({
  campaign_id: z.string().uuid(),
  ad_group_id: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  format: formatEnum,
  ad_type: z
    .enum(["static_image", "responsive_display", "native", "html5"])
    .default("static_image"),
  destination_url: z.string().trim().url().max(2048),
  media_asset_id: z.string().uuid().nullable().optional(),
  brand_name: z.string().trim().max(120).nullable().optional(),
  logo_media_asset_id: z.string().uuid().nullable().optional(),
  headlines: z.array(z.string().trim().max(90)).max(5).default([]),
  long_headline: z.string().trim().max(120).nullable().optional(),
  descriptions: z.array(z.string().trim().max(150)).max(5).default([]),
  cta: z.string().trim().max(40).nullable().optional(),
  tracking_url: z.string().trim().max(2048).nullable().optional(),
  optimization: z.string().trim().max(40).default("auto_optimize"),
});

export const Route = createFileRoute("/api/v1/ads/")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => preflight(METHODS, request.headers.get("origin")),

      GET: async ({ request }) => {
        const auth = await requireAuth(request);
        if (!auth.ok) return auth.response;

        const org = resolveOrganizationId(request, auth.context);
        if (!org.ok) return org.response;

        const access = await assertAdvertiserAccess(
          auth.context.userId,
          org.organizationId,
          auth.context.authMethod,
          "analyst",
        );
        if (!access.allowed) return access.response;

        try {
          const ads = await listAds(adminCtx(auth.context.userId), org.organizationId);
          return jsonResponse(
            { ok: true, data: ads },
            200,
            corsHeaders(METHODS, request.headers.get("origin")),
          );
        } catch {
          return serverError("Failed to fetch ads");
        }
      },

      POST: async ({ request }) => {
        const auth = await requireAuth(request);
        if (!auth.ok) return auth.response;

        const org = resolveOrganizationId(request, auth.context);
        if (!org.ok) return org.response;

        const access = await assertAdvertiserAccess(
          auth.context.userId,
          org.organizationId,
          auth.context.authMethod,
          "admin",
        );
        if (!access.allowed) return access.response;

        const body = await parseJsonBody(request, createAdSchema);
        if (!body.ok) return body.response;

        const campaignOrg = await organizationOfRow("campaigns", body.data.campaign_id);
        if (campaignOrg !== org.organizationId) {
          return jsonResponse(
            { ok: false, error: "forbidden", message: "Campaign not found in this organization" },
            403,
            corsHeaders(METHODS, request.headers.get("origin")),
          );
        }

        try {
          const ad = await createAd(adminCtx(auth.context.userId), {
            campaignId: body.data.campaign_id,
            adGroupId: body.data.ad_group_id,
            name: body.data.name,
            format: body.data.format,
            destinationUrl: body.data.destination_url,
            mediaAssetId: body.data.media_asset_id ?? null,
            adType: body.data.ad_type,
            brandName: body.data.brand_name ?? null,
            logoMediaAssetId: body.data.logo_media_asset_id ?? null,
            headlines: body.data.headlines,
            longHeadline: body.data.long_headline ?? null,
            descriptions: body.data.descriptions,
            cta: body.data.cta ?? null,
            trackingUrl: body.data.tracking_url ?? null,
            optimization: body.data.optimization,
          });
          return jsonResponse(
            { ok: true, data: ad },
            201,
            corsHeaders(METHODS, request.headers.get("origin")),
          );
        } catch (error) {
          return domainError(error, "Failed to create ad");
        }
      },
    },
  },
});
