import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  analyzeCreative,
  auditWebsite,
  buildCampaignPlan,
  optimizeCampaign,
} from "@/lib/ai-service.server";
import {
  adminArchiveAd,
  adminGetAdDetail,
  adminGetAdvertiserDetail,
  adminGetCampaignDetail,
  adminListAds,
  adminListAdvertisers,
  adminListCampaigns,
  adminListCreatives,
  adminReviewAd,
  adminReviewAdvertiser,
  adminReviewCampaign,
  adminDeleteCreative,
  attachCreativeToAd,
  createAd,
  createAdGroup,
  createCampaign,
  deleteMediaAsset,
  getAdvertiserProfile,
  getCampaignDetail,
  listAds,
  listCampaigns,
  saveAdvertiserProfile,
  saveTargeting,
  setAdGroupStatus,
  setAdStatus,
  setCampaignStatus,
  updateCampaign,
} from "@/lib/advertiser-service.server";
import {
  archiveMediaAsset,
  listMediaAssets,
  signedUploadTarget,
  registerUploadedCreative,
  signedCreativeUrl,
  uploadCreativeToR2,
} from "@/lib/media-service.server";

const uuid = z.string().uuid();
const orgInput = z.object({ organizationId: uuid });
const objectiveEnum = z.enum(["awareness", "traffic", "engagement", "conversions", "app_installs"]);
const bidEnum = z.enum(["cpm", "cpc"]);
const statusEnum = z.enum([
  "draft",
  "pending_review",
  "approved",
  "active",
  "paused",
  "completed",
  "rejected",
]);
const formatEnum = z.enum([
  "300x250",
  "336x280",
  "728x90",
  "970x250",
  "320x50",
  "320x100",
  "responsive",
]);
const deviceEnum = z.enum(["desktop", "mobile", "tablet"]);
const osEnum = z.enum(["windows", "macos", "linux", "android", "ios", "other"]);
const browserEnum = z.enum(["chrome", "firefox", "safari", "edge", "opera", "other"]);
const categoryEnum = z.enum([
  "news",
  "technology",
  "business",
  "finance",
  "entertainment",
  "sports",
  "lifestyle",
  "health",
  "education",
  "travel",
  "gaming",
  "automotive",
  "food",
  "science",
  "other",
]);
const mimeEnum = z.enum(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const fetchAdvertiserProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => orgInput.parse(data))
  .handler(({ data, context }) => getAdvertiserProfile(context, data.organizationId));

export const upsertAdvertiserProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        organizationId: uuid,
        businessName: z.string().trim().min(2).max(120),
        contactEmail: z.string().trim().email(),
        industry: z.string().trim().max(80).optional().nullable(),
        contactPhone: z.string().trim().max(40).optional().nullable(),
      })
      .parse(data),
  )
  .handler(({ data, context }) => saveAdvertiserProfile(context, data));

export const fetchCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => orgInput.parse(data))
  .handler(({ data, context }) => listCampaigns(context, data.organizationId));

export const fetchCampaignDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ campaignId: uuid }).parse(data))
  .handler(({ data, context }) => getCampaignDetail(context, data.campaignId));

export const addCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        organizationId: uuid,
        name: z.string().trim().min(2).max(120),
        objective: objectiveEnum,
        bidType: bidEnum,
        bidAmount: z.number().min(0).max(10_000),
        totalBudget: z.number().min(0).max(100_000_000),
        dailyBudget: z.number().min(0).max(100_000_000).optional().nullable(),
        startDate: dateString.optional().nullable(),
        endDate: dateString.optional().nullable(),
        landingPageUrl: z.string().trim().min(4).max(2048),
        frequencyCap: z
          .object({
            impressions: z.number().int().min(1),
            periodHours: z.number().int().min(1),
          })
          .optional()
          .nullable(),
      })
      .parse(data),
  )
  .handler(({ data, context }) => createCampaign(context, data));

export const saveCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        campaignId: uuid,
        name: z.string().trim().min(2).max(120).optional(),
        objective: objectiveEnum.optional(),
        bidType: bidEnum.optional(),
        bidAmount: z.number().min(0).max(10_000).optional(),
        totalBudget: z.number().min(0).max(100_000_000).optional(),
        dailyBudget: z.number().min(0).max(100_000_000).optional().nullable(),
        startDate: dateString.optional().nullable(),
        endDate: dateString.optional().nullable(),
        landingPageUrl: z.string().trim().min(4).max(2048).optional(),
      })
      .parse(data),
  )
  .handler(({ data, context }) => updateCampaign(context, data));

export const changeCampaignStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ campaignId: uuid, status: statusEnum }).parse(data))
  .handler(({ data, context }) => setCampaignStatus(context, data));

export const addAdGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ campaignId: uuid, name: z.string().trim().min(2).max(80) }).parse(data),
  )
  .handler(({ data, context }) => createAdGroup(context, data));

export const changeAdGroupStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ adGroupId: uuid, status: z.enum(["active", "suspended"]) }).parse(data),
  )
  .handler(({ data, context }) => setAdGroupStatus(context, data));

export const fetchAds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => orgInput.parse(data))
  .handler(({ data, context }) => listAds(context, data.organizationId));

export const addAd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        campaignId: uuid,
        adGroupId: uuid,
        name: z.string().trim().min(2).max(120),
        format: formatEnum,
        destinationUrl: z.string().trim().min(4).max(2048),
        mediaAssetId: uuid.optional().nullable(),
        adType: z
          .enum(["static_image", "responsive_display", "native", "html5"])
          .default("static_image")
          .optional(),
        brandName: z.string().trim().max(120).optional().nullable(),
        logoMediaAssetId: uuid.optional().nullable(),
        headlines: z.array(z.string().trim().max(90)).max(5).default([]).optional(),
        longHeadline: z.string().trim().max(120).optional().nullable(),
        descriptions: z.array(z.string().trim().max(150)).max(5).default([]).optional(),
        cta: z.string().trim().max(40).optional().nullable(),
        trackingUrl: z.string().trim().max(2048).optional().nullable(),
        optimization: z.string().trim().max(40).default("auto_optimize").optional(),
      })
      .parse(data),
  )
  .handler(({ data, context }) => createAd(context, data));

export const linkCreativeToAd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ adId: uuid, mediaAssetId: uuid }).parse(data))
  .handler(({ data, context }) => attachCreativeToAd(context, data));

export const changeAdStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ adId: uuid, status: z.enum(["active", "suspended", "pending"]) }).parse(data),
  )
  .handler(({ data, context }) => setAdStatus(context, data));

export const saveCampaignTargeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        campaignId: uuid,
        countries: z.array(z.string().trim().min(2).max(60)).max(100).default([]),
        counties: z.array(z.string().trim().min(2).max(60)).max(100).default([]),
        cities: z.array(z.string().trim().min(2).max(60)).max(100).default([]),
        devices: z.array(deviceEnum).max(3).default([]),
        operatingSystems: z.array(osEnum).max(6).default([]),
        browsers: z.array(browserEnum).max(6).default([]),
        websiteCategories: z.array(categoryEnum).max(15).default([]),
        schedule: z
          .record(
            z.string(),
            z.array(
              z.object({
                start: z.number().int().min(0).max(23),
                end: z.number().int().min(1).max(24),
              }),
            ),
          )
          .default({}),
        frequencyCap: z
          .object({
            impressions: z.number().int().min(1),
            periodHours: z.number().int().min(1),
          })
          .optional()
          .nullable(),
      })
      .parse(data),
  )
  .handler(({ data, context }) => saveTargeting(context, data));

// ------------------------------------------------------------------- media

export const prepareCreativeUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ organizationId: uuid, advertiserId: uuid, mimeType: mimeEnum }).parse(data),
  )
  .handler(async ({ data }) => {
    const assetId = crypto.randomUUID();
    return { assetId, ...(await signedUploadTarget({ ...data, assetId })) };
  });

export const registerCreative = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        organizationId: uuid,
        advertiserId: uuid,
        campaignId: uuid.optional().nullable(),
        adId: uuid.optional().nullable(),
        fileName: z.string().trim().min(1).max(160),
        storagePath: z.string().trim().min(3).max(400),
      })
      .parse(data),
  )
  .handler(({ data, context }) => registerUploadedCreative(context, data));

export const uploadCreative = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error("Expected form data.");
    const organizationId = uuid.parse(data.get("organizationId"));
    const advertiserId = uuid.parse(data.get("advertiserId"));
    const campaignIdRaw = data.get("campaignId");
    const file = data.get("file");
    if (!(file instanceof File)) throw new Error("A file is required.");
    return {
      organizationId,
      advertiserId,
      campaignId:
        typeof campaignIdRaw === "string" && campaignIdRaw ? uuid.parse(campaignIdRaw) : null,
      file,
    };
  })
  .handler(({ data, context }) => uploadCreativeToR2(context, data));

export const fetchCreatives = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => orgInput.parse(data))
  .handler(({ data, context }) => listMediaAssets(context, data.organizationId));

export const fetchCreativeUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ assetId: uuid }).parse(data))
  .handler(({ data, context }) => signedCreativeUrl(context, data.assetId));

export const archiveCreative = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ assetId: uuid }).parse(data))
  .handler(({ data, context }) => archiveMediaAsset(context, data.assetId));

export const deleteCreative = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ assetId: uuid }).parse(data))
  .handler(({ data, context }) => deleteMediaAsset(context, data.assetId));

// ------------------------------------------------------------------- admin

export const fetchAdminAdvertisers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) => adminListAdvertisers(context));

export const fetchAdminCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) => adminListCampaigns(context));

export const fetchAdminCampaignDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ campaignId: uuid }).parse(data))
  .handler(({ data, context }) => adminGetCampaignDetail(context, data.campaignId));

export const reviewCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        campaignId: uuid,
        action: z.enum(["approve", "reject", "pause", "reactivate", "complete"]),
        reason: z.string().trim().max(500).optional().nullable(),
      })
      .parse(data),
  )
  .handler(({ data, context }) => adminReviewCampaign(context, data));

export const reviewAdvertiser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        advertiserId: uuid,
        approvalStatus: z.enum(["pending", "approved", "rejected"]).optional(),
        status: z.enum(["active", "pending", "suspended"]).optional(),
        reason: z.string().trim().max(500).optional().nullable(),
      })
      .parse(data),
  )
  .handler(({ data, context }) => adminReviewAdvertiser(context, data));

export const reviewAd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        adId: uuid,
        action: z.enum(["approve", "reject"]),
        reason: z.string().trim().max(500).optional().nullable(),
      })
      .parse(data),
  )
  .handler(({ data, context }) => adminReviewAd(context, data));

export const fetchAdminAdvertiserDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ advertiserId: uuid }).parse(data))
  .handler(({ data, context }) => adminGetAdvertiserDetail(context, data.advertiserId));

export const fetchAdminAds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        campaignId: uuid.optional().nullable(),
        status: z.string().optional().nullable(),
        search: z.string().optional().nullable(),
        page: z.number().int().positive().optional().nullable(),
        pageSize: z.number().int().positive().optional().nullable(),
      })
      .parse(data),
  )
  .handler(({ data, context }) => {
    const filters: Record<string, unknown> = {};
    const d = data as any;
    if (d.campaignId) filters["campaignId"] = d.campaignId;
    if (d.status) filters["status"] = d.status;
    if (d.search) filters["search"] = d.search;
    if (d.page) filters["page"] = d.page;
    if (d.pageSize) filters["pageSize"] = d.pageSize;
    return adminListAds(context, filters as never);
  });

export const fetchAdminAdDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ adId: uuid }).parse(data))
  .handler(({ data, context }) => adminGetAdDetail(context, data.adId));

export const archiveAdminAd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ adId: uuid }).parse(data))
  .handler(({ data, context }) => adminArchiveAd(context, data.adId));

export const fetchAdminCreatives = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        organizationId: uuid.optional().nullable(),
        status: z.string().optional().nullable(),
        search: z.string().optional().nullable(),
        page: z.number().int().positive().optional().nullable(),
        pageSize: z.number().int().positive().optional().nullable(),
      })
      .parse(data),
  )
  .handler(({ data, context }) => {
    const filters: Record<string, unknown> = {};
    const d = data as any;
    if (d.organizationId) filters["organizationId"] = d.organizationId;
    if (d.status) filters["status"] = d.status;
    if (d.search) filters["search"] = d.search;
    if (d.page) filters["page"] = d.page;
    if (d.pageSize) filters["pageSize"] = d.pageSize;
    return adminListCreatives(context, filters as never);
  });

export const deleteAdminCreative = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ assetId: uuid }).parse(data))
  .handler(({ data, context }) => adminDeleteCreative(context, data.assetId));

// ------------------------------------------------------------------- AI Copilot

export const aiBuildCampaignPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        organizationId: uuid,
        websiteUrl: z.string().trim().min(4).max(2048),
        goal: z.string().trim().min(3).max(500),
        budget: z.number().positive().max(100_000_000),
        durationDays: z.number().int().min(1).max(365),
      })
      .parse(data),
  )
  .handler(({ data, context }) => buildCampaignPlan(context, data));

export const aiAuditWebsite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ organizationId: uuid, websiteUrl: z.string().trim().min(4).max(2048) }).parse(data),
  )
  .handler(({ data, context }) => auditWebsite(context, data));

export const aiAnalyzeCreative = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ organizationId: uuid, assetId: uuid }).parse(data))
  .handler(({ data, context }) => analyzeCreative(context, data));

export const aiOptimizeCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        organizationId: uuid,
        campaignId: uuid.optional().nullable(),
        days: z.number().int().min(1).max(90).default(30),
      })
      .parse(data),
  )
  .handler(({ data, context }) => optimizeCampaign(context, data));
