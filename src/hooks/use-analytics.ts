import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  exportAdvertiserAnalytics,
  exportAdminAnalytics,
  exportPublisherAnalytics,
  fetchAdvertiserAnalytics,
  fetchAdminAnalytics,
  fetchPublisherAnalytics,
} from "@/lib/analytics.functions";

// ----------------------------------------------------------------- types

export type DateRange = {
  from: string;
  to: string;
};

export type AdvertiserAnalyticsFilters = {
  organizationId: string;
  dateRange: DateRange;
  campaignId?: string | null;
  websiteId?: string | null;
  adZoneId?: string | null;
  deviceType?: string | null;
  country?: string | null;
};

export type PublisherAnalyticsFilters = {
  organizationId: string;
  dateRange: DateRange;
  websiteId?: string | null;
  adZoneId?: string | null;
  deviceType?: string | null;
  country?: string | null;
};

export type AdminAnalyticsFilters = {
  dateRange: DateRange;
};

// ----------------------------------------------------------------- advertiser

export function useAdvertiserAnalytics(filters: AdvertiserAnalyticsFilters | null) {
  const fn = useServerFn(fetchAdvertiserAnalytics);
  return useQuery({
    queryKey: ["advertiser", "analytics", filters],
    enabled: Boolean(filters?.organizationId && filters?.dateRange),
    queryFn: () => fn({ data: filters! }),
  });
}

export function useExportAdvertiserAnalytics() {
  const fn = useServerFn(exportAdvertiserAnalytics);
  return useMutation({
    mutationFn: (filters: AdvertiserAnalyticsFilters) => fn({ data: filters }),
  });
}

// ----------------------------------------------------------------- publisher

export function usePublisherAnalytics(filters: PublisherAnalyticsFilters | null) {
  const fn = useServerFn(fetchPublisherAnalytics);
  return useQuery({
    queryKey: ["publisher", "analytics", filters],
    enabled: Boolean(filters?.organizationId && filters?.dateRange),
    queryFn: () => fn({ data: filters! }),
  });
}

export function useExportPublisherAnalytics() {
  const fn = useServerFn(exportPublisherAnalytics);
  return useMutation({
    mutationFn: (filters: PublisherAnalyticsFilters) => fn({ data: filters }),
  });
}

// ----------------------------------------------------------------- admin

export function useAdminAnalytics(filters: AdminAnalyticsFilters | null) {
  const fn = useServerFn(fetchAdminAnalytics);
  return useQuery({
    queryKey: ["admin", "analytics", filters],
    enabled: Boolean(filters?.dateRange),
    queryFn: () => fn({ data: filters! }),
  });
}

export function useExportAdminAnalytics() {
  const fn = useServerFn(exportAdminAnalytics);
  return useMutation({
    mutationFn: (filters: AdminAnalyticsFilters) => fn({ data: filters }),
  });
}
