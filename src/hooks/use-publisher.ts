import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { useAuth } from "@/lib/auth-context";
import { membershipsOfType } from "@/lib/authorization";
import type { AdFormat, VerificationMethod, WebsiteCategory } from "@/lib/publisher-domain";
import {
  addAdZone,
  addWebsite,
  fetchAdServerOrigin,
  fetchPublisherProfile,
  fetchWebsites,
  fetchWebsiteDetail,
  saveWebsite,
  beginDomainVerification,
  checkDomainVerification,
  fetchAdZones,
  updateAdZoneStatus,
  fetchAdminPublishers,
  fetchAdminWebsites,
  fetchAdminPublisherDetail,
  fetchAdminWebsiteDetail,
  fetchAdminAdZones,
  fetchAdminAdZoneDetail,
  setAdminAdZoneStatus,
  reviewPublisher,
  reviewWebsite,
  upsertPublisherProfile,
} from "@/lib/publisher.functions";
import {
  createPublisherPolicy,
  createPolicyViolation,
  deletePublisherPolicy,
  fetchWebsitePolicyStatus,
  fetchWebsiteViolations,
  fetchAllViolations,
  updatePolicyViolation,
  updatePublisherPolicy,
  fetchPublisherPolicies,
  upsertWebsitePolicyStatus,
  runWebsiteHealthChecks,
  fetchWebsiteHealthChecks,
  fetchAdsTxtRecord,
  upsertAdsTxtRecord,
  verifyAdsTxtRecord,
  fetchAutoAdsConfig,
  upsertAutoAdsConfig,
  updateAutoAdsConfig,
  fetchAutoAdsScript,
  fetchAdControls,
  upsertAdControls,
  patchAdControls,
  fetchAdReports,
  submitAdReport,
  reviewAdReport,
} from "@/lib/publisher-ecosystem.functions";

type AdminReviewInput = {
  publisherId?: string | undefined;
  websiteId?: string | undefined;
  approvalStatus?: "pending" | "approved" | "rejected" | undefined;
  status?: "active" | "pending" | "suspended" | undefined;
  reason?: string | null | undefined;
};

type PublisherProfileInput = {
  organizationId: string;
  businessName: string;
  contactEmail: string;
  contactPhone?: string | null | undefined;
  websiteUrl?: string | null | undefined;
};

type AddWebsiteInput = {
  organizationId: string;
  domain: string;
  name: string;
  description?: string | null | undefined;
  category: WebsiteCategory;
  monthlyPageviews?: number | undefined;
};

type SaveWebsiteInput = {
  websiteId: string;
  name?: string | undefined;
  description?: string | null | undefined;
  category?: WebsiteCategory | undefined;
  monthlyPageviews?: number | undefined;
};

type VerificationInput = {
  websiteId: string;
  method: VerificationMethod;
  regenerate?: boolean | undefined;
};

type CheckInput = { websiteId: string; method: VerificationMethod };
type AddZoneInput = { websiteId: string; name: string; format: AdFormat };
type ZoneStatusInput = { zoneId: string; status: "active" | "suspended" };

const MANAGER_ROLES = ["owner", "admin", "manager"];

export function usePublisherOrg() {
  const { memberships, loadingIdentity } = useAuth();
  const publisherMemberships = membershipsOfType(memberships, "publisher");
  const primary = publisherMemberships[0] ?? null;
  return {
    loading: loadingIdentity,
    organizationId: primary?.organization.id ?? null,
    organization: primary?.organization ?? null,
    role: primary?.role ?? null,
    canManage: primary ? MANAGER_ROLES.includes(primary.role) : false,
  };
}

export function usePublisherProfile(organizationId: string | null) {
  const fn = useServerFn(fetchPublisherProfile);
  return useQuery({
    queryKey: ["publisher", "profile", organizationId],
    enabled: Boolean(organizationId),
    queryFn: () => fn({ data: { organizationId: organizationId! } }),
  });
}

export function useWebsites(organizationId: string | null) {
  const fn = useServerFn(fetchWebsites);
  return useQuery({
    queryKey: ["publisher", "websites", organizationId],
    enabled: Boolean(organizationId),
    queryFn: () => fn({ data: { organizationId: organizationId! } }),
  });
}

export function useAdZones(organizationId: string | null) {
  const fn = useServerFn(fetchAdZones);
  return useQuery({
    queryKey: ["publisher", "ad-zones", organizationId],
    enabled: Boolean(organizationId),
    queryFn: () => fn({ data: { organizationId: organizationId! } }),
  });
}

export function useWebsiteDetail(websiteId: string) {
  const fn = useServerFn(fetchWebsiteDetail);
  return useQuery({
    queryKey: ["publisher", "website", websiteId],
    queryFn: () => fn({ data: { websiteId } }),
  });
}

export function useAdServerOrigin() {
  const fn = useServerFn(fetchAdServerOrigin);
  return useQuery({
    queryKey: ["publisher", "ad-origin"],
    staleTime: 10 * 60 * 1000,
    queryFn: () => fn(),
  });
}

export function usePublisherInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["publisher"] });
  };
}

function useAdminInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["admin"] });
  };
}

export function useSavePublisherProfile() {
  const fn = useServerFn(upsertPublisherProfile);
  const invalidate = usePublisherInvalidate();
  return useMutation({
    mutationFn: (input: PublisherProfileInput) => fn({ data: input }),
    onSuccess: invalidate,
  });
}

export function useAddWebsite() {
  const fn = useServerFn(addWebsite);
  const invalidate = usePublisherInvalidate();
  return useMutation({
    mutationFn: (input: AddWebsiteInput) => fn({ data: input }),
    onSuccess: invalidate,
  });
}

export function useSaveWebsite() {
  const fn = useServerFn(saveWebsite);
  const invalidate = usePublisherInvalidate();
  return useMutation({
    mutationFn: (input: SaveWebsiteInput) => fn({ data: input }),
    onSuccess: invalidate,
  });
}

export function useBeginVerification() {
  const fn = useServerFn(beginDomainVerification);
  const invalidate = usePublisherInvalidate();
  return useMutation({
    mutationFn: (input: VerificationInput) => fn({ data: input }),
    onSuccess: invalidate,
  });
}

export function useCheckVerification() {
  const fn = useServerFn(checkDomainVerification);
  const invalidate = usePublisherInvalidate();
  return useMutation({
    mutationFn: (input: CheckInput) => fn({ data: input }),
    onSuccess: invalidate,
  });
}

export function useAddAdZone() {
  const fn = useServerFn(addAdZone);
  const invalidate = usePublisherInvalidate();
  return useMutation({
    mutationFn: (input: AddZoneInput) => fn({ data: input }),
    onSuccess: invalidate,
  });
}

export function useSetAdZoneStatus() {
  const fn = useServerFn(updateAdZoneStatus);
  const invalidate = usePublisherInvalidate();
  return useMutation({
    mutationFn: (input: ZoneStatusInput) => fn({ data: input }),
    onSuccess: invalidate,
  });
}

export function usePublisherPolicies(organizationId: string | null) {
  const fn = useServerFn(fetchPublisherPolicies);
  return useQuery({
    queryKey: ["publisher", "policies", organizationId],
    enabled: Boolean(organizationId),
    queryFn: () => fn({ data: { organizationId: organizationId! } }),
  });
}

export function useCreatePublisherPolicy() {
  const fn = useServerFn(createPublisherPolicy);
  const invalidate = usePublisherInvalidate();
  return useMutation({
    mutationFn: (input: { organizationId: string; title: string; description: string; category: string; severity: string }) =>
      fn({ data: input }),
    onSuccess: invalidate,
  });
}

export function useUpdatePublisherPolicy() {
  const fn = useServerFn(updatePublisherPolicy);
  const invalidate = usePublisherInvalidate();
  return useMutation({
    mutationFn: (input: { policyId: string; title?: string; description?: string; category?: string; severity?: string; isActive?: boolean }) =>
      fn({ data: input }),
    onSuccess: invalidate,
  });
}

export function useDeletePublisherPolicy() {
  const fn = useServerFn(deletePublisherPolicy);
  const invalidate = usePublisherInvalidate();
  return useMutation({
    mutationFn: (input: { policyId: string }) => fn({ data: input }),
    onSuccess: invalidate,
  });
}

export function useWebsitePolicyStatus(websiteId: string | null) {
  const fn = useServerFn(fetchWebsitePolicyStatus);
  return useQuery({
    queryKey: ["publisher", "website-policy-status", websiteId],
    enabled: Boolean(websiteId),
    queryFn: () => fn({ data: { websiteId: websiteId! } }),
  });
}

export function useUpsertWebsitePolicyStatus() {
  const fn = useServerFn(upsertWebsitePolicyStatus);
  const invalidate = usePublisherInvalidate();
  return useMutation({
    mutationFn: (input: { websiteId: string; organizationId: string; status: string }) => fn({ data: input }),
    onSuccess: invalidate,
  });
}

export function useWebsiteViolations(websiteId: string | null) {
  const fn = useServerFn(fetchWebsiteViolations);
  return useQuery({
    queryKey: ["publisher", "violations", websiteId],
    enabled: Boolean(websiteId),
    queryFn: () => fn({ data: { websiteId: websiteId! } }),
  });
}

export function useCreatePolicyViolation() {
  const fn = useServerFn(createPolicyViolation);
  const invalidate = usePublisherInvalidate();
  return useMutation({
    mutationFn: (input: { organizationId: string; websiteId: string; violationType: string; severity: string; description: string; evidence?: Record<string, unknown>; policyId?: string }) =>
      fn({ data: input }),
    onSuccess: invalidate,
  });
}

export function useUpdatePolicyViolation() {
  const fn = useServerFn(updatePolicyViolation);
  const invalidate = usePublisherInvalidate();
  return useMutation({
    mutationFn: (input: { violationId: string; status?: string; adminNotes?: string; resolvedAt?: string }) =>
      fn({ data: input }),
    onSuccess: invalidate,
  });
}

export function useAllViolations(organizationId: string | null) {
  const fn = useServerFn(fetchAllViolations);
  return useQuery({
    queryKey: ["publisher", "all-violations", organizationId],
    enabled: Boolean(organizationId),
    queryFn: () => fn({ data: { organizationId: organizationId! } }),
  });
}

export function useRunWebsiteHealthChecks() {
  const fn = useServerFn(runWebsiteHealthChecks);
  const invalidate = usePublisherInvalidate();
  return useMutation({
    mutationFn: (input: { websiteId: string; organizationId: string }) => fn({ data: input }),
    onSuccess: invalidate,
  });
}

export function useWebsiteHealthChecks(websiteId: string | null) {
  const fn = useServerFn(fetchWebsiteHealthChecks);
  return useQuery({
    queryKey: ["publisher", "health-checks", websiteId],
    enabled: Boolean(websiteId),
    queryFn: () => fn({ data: { websiteId: websiteId! } }),
  });
}

export function useAdsTxtRecord(websiteId: string | null) {
  const fn = useServerFn(fetchAdsTxtRecord);
  return useQuery({
    queryKey: ["publisher", "ads-txt", websiteId],
    enabled: Boolean(websiteId),
    queryFn: () => fn({ data: { websiteId: websiteId! } }),
  });
}

export function useUpsertAdsTxtRecord() {
  const fn = useServerFn(upsertAdsTxtRecord);
  const invalidate = usePublisherInvalidate();
  return useMutation({
    mutationFn: (input: { websiteId: string; organizationId: string; domain: string; publisherId: string }) =>
      fn({ data: input }),
    onSuccess: invalidate,
  });
}

export function useVerifyAdsTxt() {
  const fn = useServerFn(verifyAdsTxtRecord);
  const invalidate = usePublisherInvalidate();
  return useMutation({
    mutationFn: (input: { websiteId: string; domain: string }) => fn({ data: input }),
    onSuccess: invalidate,
  });
}

export function useAutoAdsConfig(websiteId: string | null) {
  const fn = useServerFn(fetchAutoAdsConfig);
  return useQuery({
    queryKey: ["publisher", "auto-ads", websiteId],
    enabled: Boolean(websiteId),
    queryFn: () => fn({ data: { websiteId: websiteId! } }),
  });
}

export function useUpsertAutoAdsConfig() {
  const fn = useServerFn(upsertAutoAdsConfig);
  const invalidate = usePublisherInvalidate();
  return useMutation({
    mutationFn: (input: { websiteId: string; organizationId: string }) => fn({ data: input }),
    onSuccess: invalidate,
  });
}

export function useUpdateAutoAdsConfig() {
  const fn = useServerFn(updateAutoAdsConfig);
  const invalidate = usePublisherInvalidate();
  return useMutation({
    mutationFn: (input: { websiteId: string; status?: string; adLoad?: string; enabledFormats?: string[]; excludedPages?: string[]; excludedSelectors?: string[]; minSpacing?: number; anchorAdsEnabled?: boolean; overlayAdsEnabled?: boolean; mobileAdsEnabled?: boolean; bannerAdsEnabled?: boolean; responsiveAdsEnabled?: boolean }) => fn({ data: input }),
    onSuccess: invalidate,
  });
}

export function useAutoAdsScript(websiteId: string | null) {
  const fn = useServerFn(fetchAutoAdsScript);
  return useQuery({
    queryKey: ["publisher", "auto-ads-script", websiteId],
    enabled: Boolean(websiteId),
    queryFn: () => fn({ data: { websiteId: websiteId! } }),
  });
}

export function useAdControls(websiteId: string | null, adZoneId?: string) {
  const fn = useServerFn(fetchAdControls);
  return useQuery({
    queryKey: ["publisher", "ad-controls", websiteId, adZoneId],
    enabled: Boolean(websiteId),
    queryFn: () => fn({ data: { websiteId: websiteId!, adZoneId } }),
  });
}

export function useUpsertAdControls() {
  const fn = useServerFn(upsertAdControls);
  const invalidate = usePublisherInvalidate();
  return useMutation({
    mutationFn: (input: { websiteId: string; organizationId: string; adZoneId?: string }) => fn({ data: input }),
    onSuccess: invalidate,
  });
}

export function usePatchAdControls() {
  const fn = useServerFn(patchAdControls);
  const invalidate = usePublisherInvalidate();
  return useMutation({
    mutationFn: (input: { controlsId: string; allowedFormats?: string[] | undefined; blockedCategories?: string[] | undefined; blockedAdvertisers?: string[] | undefined; maxFrequency?: number | undefined; responsiveEnabled?: boolean | undefined; lazyLoadingEnabled?: boolean | undefined; refreshMode?: string | undefined; refreshIntervalSeconds?: number | undefined }) => fn({ data: input }),
    onSuccess: invalidate,
  });
}

export function useAdReports(websiteId?: string, status?: string) {
  const fn = useServerFn(fetchAdReports);
  return useQuery({
    queryKey: ["publisher", "ad-reports", websiteId, status],
    queryFn: () => fn({ data: { websiteId, status } }),
  });
}

export function useSubmitAdReport() {
  const fn = useServerFn(submitAdReport);
  const invalidate = usePublisherInvalidate();
  return useMutation({
    mutationFn: (input: { organizationId: string; adId: string; campaignId: string; websiteId: string; adZoneId: string; reason: string; description?: string; reporterIp?: string; userAgent?: string }) =>
      fn({ data: input }),
    onSuccess: invalidate,
  });
}

export function useReviewAdReport() {
  const fn = useServerFn(reviewAdReport);
  const invalidate = usePublisherInvalidate();
  const invalidateAdmin = useAdminInvalidate();
  return useMutation({
    mutationFn: (input: { reportId: string; status?: string; adminNotes?: string; reviewedBy?: string }) =>
      fn({ data: input }),
    onSuccess: () => {
      void invalidate();
      void invalidateAdmin();
    },
  });
}

export function useAdminPublishers() {
  const fn = useServerFn(fetchAdminPublishers);
  return useQuery({
    queryKey: ["admin", "publishers"],
    queryFn: () => fn(),
  });
}

export function useAdminWebsites() {
  const fn = useServerFn(fetchAdminWebsites);
  return useQuery({
    queryKey: ["admin", "websites"],
    queryFn: () => fn(),
  });
}

export function useAdminPublisherDetail(publisherId: string | null) {
  const fn = useServerFn(fetchAdminPublisherDetail);
  return useQuery({
    queryKey: ["admin", "publisher", publisherId],
    enabled: Boolean(publisherId),
    queryFn: () => fn({ data: { publisherId: publisherId! } }),
  });
}

export function useReviewPublisher() {
  const fn = useServerFn(reviewPublisher);
  const invalidate = usePublisherInvalidate();
  const invalidateAdmin = useAdminInvalidate();
  return useMutation({
    mutationFn: (input: AdminReviewInput) =>
      fn({ data: { publisherId: input.publisherId!, ...input } }),
    onSuccess: () => {
      void invalidate();
      void invalidateAdmin();
    },
  });
}

export function useReviewWebsite() {
  const fn = useServerFn(reviewWebsite);
  const invalidate = usePublisherInvalidate();
  const invalidateAdmin = useAdminInvalidate();
  return useMutation({
    mutationFn: (input: AdminReviewInput) =>
      fn({ data: { websiteId: input.websiteId!, ...input } }),
    onSuccess: () => {
      void invalidate();
      void invalidateAdmin();
    },
  });
}

export function useAdminAdZones(filters?: { websiteId?: string; publisherId?: string; status?: string; page?: number; pageSize?: number }) {
  const fn = useServerFn(fetchAdminAdZones);
  return useQuery({
    queryKey: ["admin", "ad-zones", filters],
    queryFn: () => fn({ data: filters ?? {} }),
  });
}

export function useAdminAdZoneDetail(zoneId: string | null) {
  const fn = useServerFn(fetchAdminAdZoneDetail);
  return useQuery({
    queryKey: ["admin", "ad-zone", zoneId],
    enabled: Boolean(zoneId),
    queryFn: () => fn({ data: { zoneId: zoneId! } }),
  });
}

export function useSetAdminAdZoneStatus() {
  const fn = useServerFn(setAdminAdZoneStatus);
  const invalidate = usePublisherInvalidate();
  const invalidateAdmin = useAdminInvalidate();
  return useMutation({
    mutationFn: (input: { zoneId: string; status: string }) => fn({ data: input }),
    onSuccess: () => {
      void invalidate();
      void invalidateAdmin();
    },
  });
}

export function useAdminWebsiteDetail(websiteId: string | null) {
  const fn = useServerFn(fetchAdminWebsiteDetail);
  return useQuery({
    queryKey: ["admin", "website", websiteId],
    enabled: Boolean(websiteId),
    queryFn: () => fn({ data: { websiteId: websiteId! } }),
  });
}
