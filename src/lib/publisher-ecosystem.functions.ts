import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  createPolicy,
  createViolation,
  deletePolicy,
  getWebsitePolicyStatus,
  listAllViolations,
  listPolicies,
  listViolations,
  setWebsitePolicyStatus,
  updatePolicy,
  updateViolation,
} from "@/lib/publisher-policy.service.server";
import { createAdControls, getAdControls, updateAdControls } from "@/lib/ad-controls.service.server";
import { createAdReport, listAdReports, updateAdReport } from "@/lib/ad-reports.service.server";
import { createAutoAdsConfig, generateAutoAdsScript, getAutoAdsConfig, updateAutoAdsConfig as updateAutoAdsConfigDomain } from "@/lib/auto-ads.service.server";
import { createAdsTxtRecord, getAdsTxtRecord, verifyAdsTxt } from "@/lib/ads-txt.service.server";
import { getLatestHealthChecks, runHealthChecks } from "@/lib/website-health.service.server";

const uuid = z.string().uuid();
const orgInput = z.object({ organizationId: uuid });

const policyStatusEnum = z.enum(["good", "warning", "restricted", "suspended"]);
const violationSeverityEnum = z.enum(["low", "medium", "high", "critical"]);
const violationStatusEnum = z.enum(["open", "in_review", "resolved", "dismissed"]);
const adReportReasonEnum = z.enum(["inappropriate", "misleading", "malicious", "repetitive", "other"]);
const adReportStatusEnum = z.enum(["pending", "reviewed", "resolved", "dismissed"]);
const autoAdsStatusEnum = z.enum(["enabled", "disabled"]);
const adLoadLevelEnum = z.enum(["low", "balanced", "high"]);
const adRefreshModeEnum = z.enum(["none", "time_based", "scroll_based"]);

export const fetchPublisherPolicies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => orgInput.parse(data))
  .handler(({ data }) => listPolicies(data.organizationId));

export const createPublisherPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({
      organizationId: uuid,
      title: z.string().trim().min(2).max(120),
      description: z.string().trim().min(10),
      category: z.string().trim().min(2).max(60),
      severity: violationSeverityEnum,
    }).parse(data),
  )
  .handler(({ data }) => createPolicy(data.organizationId, { title: data.title, description: data.description, category: data.category, severity: data.severity }));

export const updatePublisherPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({
      policyId: uuid,
      title: z.string().trim().min(2).max(120).optional(),
      description: z.string().trim().min(10).optional(),
      category: z.string().trim().min(2).max(60).optional(),
      severity: violationSeverityEnum.optional(),
      isActive: z.boolean().optional(),
    }).parse(data),
  )
  .handler(({ data }) => {
    const { policyId, ...input } = data;
    const cleanInput = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
    return updatePolicy(policyId, cleanInput as Parameters<typeof updatePolicy>[1]);
  });

export const deletePublisherPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ policyId: uuid }).parse(data))
  .handler(({ data }) => deletePolicy(data.policyId));

export const fetchWebsitePolicyStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ websiteId: uuid }).parse(data))
  .handler(({ data }) => getWebsitePolicyStatus(data.websiteId));

export const upsertWebsitePolicyStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ websiteId: uuid, organizationId: uuid, status: policyStatusEnum }).parse(data),
  )
  .handler(({ data }) => setWebsitePolicyStatus(data.websiteId, data.organizationId, data.status));

export const fetchWebsiteViolations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ websiteId: uuid }).parse(data))
  .handler(({ data }) => listViolations(data.websiteId));

export const createPolicyViolation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({
      organizationId: uuid,
      websiteId: uuid,
      violationType: z.string().trim().min(2).max(120),
      severity: violationSeverityEnum,
      description: z.string().trim().min(10),
      evidence: z.record(z.unknown()).optional(),
      policyId: uuid.optional(),
    }).parse(data),
  )
  .handler(({ data }) => createViolation(data.organizationId, data));

export const updatePolicyViolation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({
      violationId: uuid,
      status: violationStatusEnum.optional(),
      adminNotes: z.string().optional(),
      resolvedAt: z.string().optional(),
    }).parse(data),
  )
  .handler(({ data }) => updateViolation(data.violationId, data));

export const fetchAllViolations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => orgInput.parse(data))
  .handler(({ data }) => listAllViolations(data.organizationId));

export const runWebsiteHealthChecks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ websiteId: uuid, organizationId: uuid }).parse(data))
  .handler(({ data }) => runHealthChecks(data.websiteId, data.organizationId));

export const fetchWebsiteHealthChecks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ websiteId: uuid }).parse(data))
  .handler(({ data }) => getLatestHealthChecks(data.websiteId));

export const fetchAdsTxtRecord = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ websiteId: uuid }).parse(data))
  .handler(({ data }) => getAdsTxtRecord(data.websiteId));

export const upsertAdsTxtRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({
      websiteId: uuid,
      organizationId: uuid,
      domain: z.string().min(3).max(255),
      publisherId: uuid,
    }).parse(data),
  )
  .handler(({ data }) => createAdsTxtRecord(data.websiteId, data.organizationId, data.domain, data.publisherId));

export const verifyAdsTxtRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ websiteId: uuid, domain: z.string().min(3).max(255) }).parse(data))
  .handler(({ data }) => verifyAdsTxt(data.websiteId, data.domain));

export const fetchAutoAdsConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ websiteId: uuid }).parse(data))
  .handler(({ data }) => getAutoAdsConfig(data.websiteId));

export const upsertAutoAdsConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ websiteId: uuid, organizationId: uuid }).parse(data))
  .handler(({ data }) => createAutoAdsConfig(data.websiteId, data.organizationId));

export const updateAutoAdsConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({
      websiteId: uuid,
      status: autoAdsStatusEnum.optional(),
      adLoad: adLoadLevelEnum.optional(),
      enabledFormats: z.array(z.string()).optional(),
      excludedPages: z.array(z.string()).optional(),
      excludedSelectors: z.array(z.string()).optional(),
      minSpacing: z.number().int().min(0).optional(),
      anchorAdsEnabled: z.boolean().optional(),
      overlayAdsEnabled: z.boolean().optional(),
      mobileAdsEnabled: z.boolean().optional(),
      bannerAdsEnabled: z.boolean().optional(),
      responsiveAdsEnabled: z.boolean().optional(),
    }).parse(data),
  )
  .handler(({ data }) => {
    const { websiteId, ...input } = data;
    // The domain function takes the camelCase UI shape and does the column
    // mapping itself. This handler used to pre-map to snake_case and cast, so
    // the domain function saw `ad_load`, `min_spacing`, ... instead of
    // `adLoad`, `minSpacing`, ... and silently saved nothing but `status`.
    return updateAutoAdsConfigDomain(websiteId, input);
  });

export const fetchAutoAdsScript = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ websiteId: uuid }).parse(data))
  .handler(({ data }) => ({ script: generateAutoAdsScript(data.websiteId) }));

export const fetchAdControls = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ websiteId: uuid, adZoneId: uuid.optional() }).parse(data))
  .handler(({ data }) => getAdControls(data.websiteId, data.adZoneId));

export const upsertAdControls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({
      websiteId: uuid,
      organizationId: uuid,
      adZoneId: uuid.optional(),
    }).parse(data),
  )
  .handler(({ data }) => createAdControls(data.websiteId, data.organizationId, data.adZoneId));

export const patchAdControls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({
      controlsId: uuid,
      allowedFormats: z.array(z.string()).optional(),
      blockedCategories: z.array(z.string()).optional(),
      blockedAdvertisers: z.array(z.string()).optional(),
      maxFrequency: z.number().int().positive().optional(),
      responsiveEnabled: z.boolean().optional(),
      lazyLoadingEnabled: z.boolean().optional(),
      refreshMode: adRefreshModeEnum.optional(),
      refreshIntervalSeconds: z.number().int().min(10).optional(),
    }).parse(data),
  )
  .handler(({ data }) => updateAdControls(data.controlsId, data));

export const fetchAdReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ websiteId: uuid.optional(), status: adReportStatusEnum.optional() }).parse(data),
  )
  .handler(({ data }) => listAdReports(data.websiteId, data.status));

export const submitAdReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({
      organizationId: uuid,
      adId: uuid,
      campaignId: uuid,
      websiteId: uuid,
      adZoneId: uuid,
      reason: adReportReasonEnum,
      description: z.string().optional(),
      reporterIp: z.string().ip().optional(),
      userAgent: z.string().optional(),
    }).parse(data),
  )
  .handler(({ data }) => {
    const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) as Record<string, unknown>;
    return createAdReport(clean["organizationId"] as string, clean as Parameters<typeof createAdReport>[1]);
  });

export const reviewAdReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({
      reportId: uuid,
      status: adReportStatusEnum.optional(),
      adminNotes: z.string().optional(),
      reviewedBy: uuid.optional(),
    }).parse(data),
  )
  .handler(({ data }) => {
    const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
    return updateAdReport(data.reportId, clean as never);
  });
