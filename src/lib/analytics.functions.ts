import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildAdvertiserCsv,
  buildAdminCsv,
  buildPublisherCsv,
  getAdvertiserAnalytics,
  getAdminAnalytics,
  getPublisherAnalytics,
  type AdvertiserAnalyticsFilters,
  type AdminAnalyticsFilters,
  type PublisherAnalyticsFilters,
} from "@/lib/analytics-service.server";

const uuid = z.string().uuid();
const dateRangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// ----------------------------------------------------------------- advertiser

export const fetchAdvertiserAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        organizationId: uuid,
        dateRange: dateRangeSchema,
        campaignId: uuid.optional().nullable(),
        websiteId: uuid.optional().nullable(),
        adZoneId: uuid.optional().nullable(),
        deviceType: z.string().optional().nullable(),
        country: z.string().optional().nullable(),
      })
      .parse(data),
  )
  .handler(({ data, context }) =>
    getAdvertiserAnalytics(context, data as AdvertiserAnalyticsFilters),
  );

export const exportAdvertiserAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        organizationId: uuid,
        dateRange: dateRangeSchema,
        campaignId: uuid.optional().nullable(),
        websiteId: uuid.optional().nullable(),
        adZoneId: uuid.optional().nullable(),
        deviceType: z.string().optional().nullable(),
        country: z.string().optional().nullable(),
      })
      .parse(data),
  )
  .handler(({ data, context }) => {
    const filters = data as AdvertiserAnalyticsFilters;
    return getAdvertiserAnalytics(context, filters).then((result) => ({
      csv: buildAdvertiserCsv(result, filters),
      filename: `advertiser-analytics-${filters.dateRange.from}-to-${filters.dateRange.to}.csv`,
    }));
  });

// ----------------------------------------------------------------- publisher

export const fetchPublisherAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        organizationId: uuid,
        dateRange: dateRangeSchema,
        websiteId: uuid.optional().nullable(),
        adZoneId: uuid.optional().nullable(),
        deviceType: z.string().optional().nullable(),
        country: z.string().optional().nullable(),
      })
      .parse(data),
  )
  .handler(({ data, context }) =>
    getPublisherAnalytics(context, data as PublisherAnalyticsFilters),
  );

export const exportPublisherAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        organizationId: uuid,
        dateRange: dateRangeSchema,
        websiteId: uuid.optional().nullable(),
        adZoneId: uuid.optional().nullable(),
        deviceType: z.string().optional().nullable(),
        country: z.string().optional().nullable(),
      })
      .parse(data),
  )
  .handler(({ data, context }) => {
    const filters = data as PublisherAnalyticsFilters;
    return getPublisherAnalytics(context, filters).then((result) => ({
      csv: buildPublisherCsv(result, filters),
      filename: `publisher-analytics-${filters.dateRange.from}-to-${filters.dateRange.to}.csv`,
    }));
  });

// ----------------------------------------------------------------- admin

export const fetchAdminAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        dateRange: dateRangeSchema,
      })
      .parse(data),
  )
  .handler(({ data, context }) => getAdminAnalytics(context, data as AdminAnalyticsFilters));

export const exportAdminAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        dateRange: dateRangeSchema,
      })
      .parse(data),
  )
  .handler(({ data, context }) => {
    const filters = data as AdminAnalyticsFilters;
    return getAdminAnalytics(context, filters).then((result) => ({
      csv: buildAdminCsv(result, filters),
      filename: `admin-analytics-${filters.dateRange.from}-to-${filters.dateRange.to}.csv`,
    }));
  });
