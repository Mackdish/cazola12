import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  adminGetAdZoneDetail,
  adminGetPublisherDetail,
  adminGetWebsiteDetail,
  adminListAdZones,
  adminListPublishers,
  adminListWebsites,
  adminSetAdZoneStatus,
  adminSetPublisherReview,
  adminSetWebsiteReview,
  createAdZone,
  createWebsite,
  getPublisherProfile,
  getWebsiteDetail,
  listAdZones,
  listWebsites,
  resolveAdServerOrigin,
  runVerification,
  savePublisherProfile,
  setAdZoneStatus,
  startVerification,
  updateWebsite,
} from "@/lib/publisher-service.server";

const uuid = z.string().uuid();
const orgInput = z.object({ organizationId: uuid });
const methodEnum = z.enum(["dns_txt", "meta_tag", "html_file"]);
const approvalEnum = z.enum(["pending", "approved", "rejected"]);
const entityEnum = z.enum(["active", "pending", "suspended"]);
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
const formatEnum = z.enum([
  "300x250",
  "336x280",
  "728x90",
  "970x250",
  "320x50",
  "320x100",
  "responsive",
]);

export const fetchPublisherProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => orgInput.parse(data))
  .handler(({ data, context }) => getPublisherProfile(context, data.organizationId));

export const upsertPublisherProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        organizationId: uuid,
        businessName: z.string().trim().min(2).max(120),
        contactEmail: z.string().trim().email(),
        contactPhone: z.string().trim().max(40).optional().nullable(),
        websiteUrl: z.string().trim().max(255).optional().nullable(),
      })
      .parse(data),
  )
  .handler(({ data, context }) => savePublisherProfile(context, data));

export const fetchWebsites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => orgInput.parse(data))
  .handler(({ data, context }) => listWebsites(context, data.organizationId));

export const fetchWebsiteDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ websiteId: uuid }).parse(data))
  .handler(({ data, context }) => getWebsiteDetail(context, data.websiteId));

export const addWebsite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        organizationId: uuid,
        domain: z.string().trim().min(3).max(255),
        name: z.string().trim().min(2).max(120),
        description: z.string().trim().max(600).optional().nullable(),
        category: categoryEnum,
        monthlyPageviews: z.number().int().min(0).max(100_000_000).optional(),
      })
      .parse(data),
  )
  .handler(({ data, context }) => createWebsite(context, data));

export const saveWebsite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        websiteId: uuid,
        name: z.string().trim().min(2).max(120).optional(),
        description: z.string().trim().max(600).optional().nullable(),
        category: categoryEnum.optional(),
        monthlyPageviews: z.number().int().min(0).max(100_000_000).optional(),
      })
      .parse(data),
  )
  .handler(({ data, context }) => updateWebsite(context, data));

export const beginDomainVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({ websiteId: uuid, method: methodEnum, regenerate: z.boolean().optional() })
      .parse(data),
  )
  .handler(({ data, context }) => startVerification(context, data));

export const checkDomainVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ websiteId: uuid, method: methodEnum }).parse(data))
  .handler(({ data, context }) => runVerification(context, data));

export const fetchAdZones = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => orgInput.parse(data))
  .handler(({ data, context }) => listAdZones(context, data.organizationId));

export const addAdZone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({ websiteId: uuid, name: z.string().trim().min(2).max(80), format: formatEnum })
      .parse(data),
  )
  .handler(({ data, context }) => createAdZone(context, data));

export const updateAdZoneStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ zoneId: uuid, status: z.enum(["active", "suspended"]) }).parse(data),
  )
  .handler(({ data, context }) => setAdZoneStatus(context, data));

export const fetchAdServerOrigin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(() => ({ origin: resolveAdServerOrigin(getRequest().url) }));

export const fetchAdminPublishers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) => adminListPublishers(context));

export const fetchAdminWebsites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) => adminListWebsites(context));

export const fetchAdminPublisherDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ publisherId: uuid }).parse(data))
  .handler(({ data, context }) => adminGetPublisherDetail(context, data.publisherId));

export const reviewPublisher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        publisherId: uuid,
        approvalStatus: approvalEnum.optional(),
        status: entityEnum.optional(),
        reason: z.string().trim().max(500).optional().nullable(),
      })
      .parse(data),
  )
  .handler(({ data, context }) => adminSetPublisherReview(context, data));

export const reviewWebsite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        websiteId: uuid,
        approvalStatus: approvalEnum.optional(),
        status: entityEnum.optional(),
        reason: z.string().trim().max(500).optional().nullable(),
      })
      .parse(data),
  )
  .handler(({ data, context }) => adminSetWebsiteReview(context, data));

export const fetchAdminAdZones = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        websiteId: uuid.optional().nullable(),
        publisherId: uuid.optional().nullable(),
        status: z.string().optional().nullable(),
        page: z.number().int().positive().optional().nullable(),
        pageSize: z.number().int().positive().optional().nullable(),
      })
      .parse(data),
  )
  .handler(({ data, context }) => {
    const filters: Record<string, unknown> = {};
    const d = data as any;
    if (d.websiteId) filters["websiteId"] = d.websiteId;
    if (d.publisherId) filters["publisherId"] = d.publisherId;
    if (d.status) filters["status"] = d.status;
    if (d.page) filters["page"] = d.page;
    if (d.pageSize) filters["pageSize"] = d.pageSize;
    return adminListAdZones(context, filters as never);
  });

export const fetchAdminAdZoneDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ zoneId: uuid }).parse(data))
  .handler(({ data, context }) => adminGetAdZoneDetail(context, data.zoneId));

export const setAdminAdZoneStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        zoneId: uuid,
        status: z.enum(["active", "suspended", "pending"]),
      })
      .parse(data),
  )
  .handler(({ data, context }) => adminSetAdZoneStatus(context, data));

export const fetchAdminWebsiteDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ websiteId: uuid }).parse(data))
  .handler(({ data, context }) => adminGetWebsiteDetail(context, data.websiteId));
