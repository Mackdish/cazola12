import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { useAuth } from "@/lib/auth-context";
import { membershipsOfType } from "@/lib/authorization";
import {
  addAd,
  addAdGroup,
  addCampaign,
  archiveCreative,
  changeAdGroupStatus,
  changeAdStatus,
  changeCampaignStatus,
  deleteCreative,
  fetchAdminAdvertisers,
  fetchAdminCampaignDetail,
  fetchAdminCampaigns,
  fetchAds,
  fetchAdvertiserProfile,
  fetchCampaignDetail,
  fetchCampaigns,
  fetchCreatives,
  fetchCreativeUrl,
  linkCreativeToAd,
  reviewAd,
  reviewAdvertiser,
  reviewCampaign,
  saveCampaign,
  saveCampaignTargeting,
  upsertAdvertiserProfile,
  uploadCreative,
} from "@/lib/advertiser.functions";
import {
  generateAICampaignPlan,
  generateAIAdCopy,
  generateAITargeting,
  generateAICreativeConcept,
} from "@/lib/ai-copilot.functions";
import {
  maxBytesForMime,
  validateCreativeFile,
  type AdFormat,
  type BidType,
  type BrowserType,
  type CampaignObjective,
  type CampaignStatus,
  type DeviceType,
  type OsType,
} from "@/lib/advertiser-domain";
import type { WebsiteCategory } from "@/lib/publisher-domain";

const MANAGER_ROLES = ["owner", "admin", "manager"];

/** Primary advertiser organization for the signed-in user. */
export function useAdvertiserOrg() {
  const { memberships, loadingIdentity } = useAuth();
  const primary = membershipsOfType(memberships, "advertiser")[0] ?? null;
  return {
    loading: loadingIdentity,
    organizationId: primary?.organization.id ?? null,
    organization: primary?.organization ?? null,
    role: primary?.role ?? null,
    canManage: primary ? MANAGER_ROLES.includes(primary.role) : false,
  };
}

export function useAdvertiserProfile(organizationId: string | null) {
  const fn = useServerFn(fetchAdvertiserProfile);
  return useQuery({
    queryKey: ["advertiser", "profile", organizationId],
    enabled: Boolean(organizationId),
    queryFn: () => fn({ data: { organizationId: organizationId! } }),
  });
}

export function useCampaigns(organizationId: string | null) {
  const fn = useServerFn(fetchCampaigns);
  return useQuery({
    queryKey: ["advertiser", "campaigns", organizationId],
    enabled: Boolean(organizationId),
    queryFn: () => fn({ data: { organizationId: organizationId! } }),
  });
}

export function useCampaignDetail(campaignId: string) {
  const fn = useServerFn(fetchCampaignDetail);
  return useQuery({
    queryKey: ["advertiser", "campaign", campaignId],
    queryFn: () => fn({ data: { campaignId } }),
  });
}

export function useAdvertiserAds(organizationId: string | null) {
  const fn = useServerFn(fetchAds);
  return useQuery({
    queryKey: ["advertiser", "ads", organizationId],
    enabled: Boolean(organizationId),
    queryFn: () => fn({ data: { organizationId: organizationId! } }),
  });
}

export function useCreatives(organizationId: string | null) {
  const fn = useServerFn(fetchCreatives);
  return useQuery({
    queryKey: ["advertiser", "creatives", organizationId],
    enabled: Boolean(organizationId),
    queryFn: () => fn({ data: { organizationId: organizationId! } }),
  });
}

/** Short-lived signed preview URL, resolved through the media service. */
export function useCreativeUrl(assetId: string | null) {
  const fn = useServerFn(fetchCreativeUrl);
  return useQuery({
    queryKey: ["advertiser", "creative-url", assetId],
    enabled: Boolean(assetId),
    staleTime: 5 * 60 * 1000,
    queryFn: () => fn({ data: { assetId: assetId! } }),
  });
}

export function useAdvertiserInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["advertiser"] });
  };
}

function useAdminInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["admin"] });
  };
}

export function useSaveAdvertiserProfile() {
  const fn = useServerFn(upsertAdvertiserProfile);
  const invalidate = useAdvertiserInvalidate();
  return useMutation({
    mutationFn: (input: {
      organizationId: string;
      businessName: string;
      contactEmail: string;
      industry?: string | null | undefined;
      contactPhone?: string | null | undefined;
    }) => fn({ data: input }),
    onSuccess: invalidate,
  });
}

export type CreateCampaignInput = {
  organizationId: string;
  name: string;
  objective: CampaignObjective;
  bidType: BidType;
  bidAmount: number;
  totalBudget: number;
  dailyBudget?: number | null | undefined;
  startDate?: string | null | undefined;
  endDate?: string | null | undefined;
  landingPageUrl: string;
  frequencyCap?: { impressions: number; periodHours: number } | null | undefined;
};

export function useCreateCampaign() {
  const fn = useServerFn(addCampaign);
  const invalidate = useAdvertiserInvalidate();
  return useMutation({
    mutationFn: (input: CreateCampaignInput) => fn({ data: input }),
    onSuccess: invalidate,
  });
}

export function useSaveCampaign() {
  const fn = useServerFn(saveCampaign);
  const invalidate = useAdvertiserInvalidate();
  return useMutation({
    mutationFn: (input: Partial<CreateCampaignInput> & { campaignId: string }) =>
      fn({ data: input }),
    onSuccess: invalidate,
  });
}

export function useSetCampaignStatus() {
  const fn = useServerFn(changeCampaignStatus);
  const invalidate = useAdvertiserInvalidate();
  const invalidateAdmin = useAdminInvalidate();
  return useMutation({
    mutationFn: (input: { campaignId: string; status: CampaignStatus }) => fn({ data: input }),
    onSuccess: () => {
      invalidate();
      invalidateAdmin();
    },
  });
}

export function useCreateAdGroup() {
  const fn = useServerFn(addAdGroup);
  const invalidate = useAdvertiserInvalidate();
  return useMutation({
    mutationFn: (input: { campaignId: string; name: string }) => fn({ data: input }),
    onSuccess: invalidate,
  });
}

export function useSetAdGroupStatus() {
  const fn = useServerFn(changeAdGroupStatus);
  const invalidate = useAdvertiserInvalidate();
  return useMutation({
    mutationFn: (input: { adGroupId: string; status: "active" | "suspended" }) =>
      fn({ data: input }),
    onSuccess: invalidate,
  });
}

export function useCreateAd() {
  const fn = useServerFn(addAd);
  const invalidate = useAdvertiserInvalidate();
  return useMutation({
    mutationFn: (input: {
      campaignId: string;
      adGroupId: string;
      name: string;
      format: AdFormat;
      destinationUrl: string;
      mediaAssetId?: string | null | undefined;
      adType?: string | null | undefined;
      brandName?: string | null | undefined;
      logoMediaAssetId?: string | null | undefined;
      headlines?: string[] | null | undefined;
      longHeadline?: string | null | undefined;
      descriptions?: string[] | null | undefined;
      cta?: string | null | undefined;
      trackingUrl?: string | null | undefined;
      optimization?: string | null | undefined;
    }) => fn({ data: input }),
    onSuccess: invalidate,
  });
}

export function useAttachCreative() {
  const fn = useServerFn(linkCreativeToAd);
  const invalidate = useAdvertiserInvalidate();
  return useMutation({
    mutationFn: (input: { adId: string; mediaAssetId: string }) => fn({ data: input }),
    onSuccess: invalidate,
  });
}

export function useSetAdStatus() {
  const fn = useServerFn(changeAdStatus);
  const invalidate = useAdvertiserInvalidate();
  return useMutation({
    mutationFn: (input: { adId: string; status: "active" | "suspended" | "pending" }) =>
      fn({ data: input }),
    onSuccess: invalidate,
  });
}

export function useSaveTargeting() {
  const fn = useServerFn(saveCampaignTargeting);
  const invalidate = useAdvertiserInvalidate();
  return useMutation({
    mutationFn: (input: {
      campaignId: string;
      countries: string[];
      counties: string[];
      cities: string[];
      devices: DeviceType[];
      operatingSystems: OsType[];
      browsers: BrowserType[];
      websiteCategories: WebsiteCategory[];
      schedule: Record<string, Array<{ start: number; end: number }>>;
    }) => fn({ data: input }),
    onSuccess: invalidate,
  });
}

export function useArchiveCreative() {
  const fn = useServerFn(archiveCreative);
  const invalidate = useAdvertiserInvalidate();
  return useMutation({
    mutationFn: (input: { assetId: string }) => fn({ data: input }),
    onSuccess: invalidate,
  });
}

export function useDeleteCreative() {
  const fn = useServerFn(deleteCreative);
  const invalidate = useAdvertiserInvalidate();
  return useMutation({
    mutationFn: (input: { assetId: string }) => fn({ data: input }),
    onSuccess: invalidate,
  });
}

/**
 * Uploads a creative: the server picks the storage location, the browser
 * streams the bytes into the private bucket, and the server then re-reads the
 * stored file to record its real mime type, size and dimensions.
 */
export function useUploadCreative() {
  const upload = useServerFn(uploadCreative);
  const invalidate = useAdvertiserInvalidate();

  return useMutation({
    mutationFn: async (input: {
      organizationId: string;
      advertiserId: string;
      campaignId?: string | null | undefined;
      file: File;
    }) => {
      const check = validateCreativeFile({
        mimeType: input.file.type,
        fileSize: input.file.size,
      });
      if (!check.ok) throw new Error(check.message);
      if (input.file.size > maxBytesForMime(input.file.type))
        throw new Error("That file is too large.");

      const formData = new FormData();
      formData.append("organizationId", input.organizationId);
      formData.append("advertiserId", input.advertiserId);
      if (input.campaignId) formData.append("campaignId", input.campaignId);
      formData.append("file", input.file);

      return upload({ data: formData });
    },
    onSuccess: invalidate,
  });
}

// ---------------------------------------------------------------- admin

export function useAdminAdvertisers() {
  const fn = useServerFn(fetchAdminAdvertisers);
  return useQuery({ queryKey: ["admin", "advertisers"], queryFn: () => fn() });
}

export function useAdminCampaigns() {
  const fn = useServerFn(fetchAdminCampaigns);
  return useQuery({ queryKey: ["admin", "campaigns"], queryFn: () => fn() });
}

export function useAdminCampaignDetail(campaignId: string | null) {
  const fn = useServerFn(fetchAdminCampaignDetail);
  return useQuery({
    queryKey: ["admin", "campaign", campaignId],
    enabled: Boolean(campaignId),
    queryFn: () => fn({ data: { campaignId: campaignId! } }),
  });
}

export function useReviewCampaign() {
  const fn = useServerFn(reviewCampaign);
  const invalidate = useAdvertiserInvalidate();
  const invalidateAdmin = useAdminInvalidate();
  return useMutation({
    mutationFn: (input: {
      campaignId: string;
      action: "approve" | "reject" | "pause" | "reactivate" | "complete";
      reason?: string | null | undefined;
    }) => fn({ data: input }),
    onSuccess: () => {
      invalidate();
      invalidateAdmin();
    },
  });
}

export function useReviewAdvertiser() {
  const fn = useServerFn(reviewAdvertiser);
  const invalidate = useAdvertiserInvalidate();
  const invalidateAdmin = useAdminInvalidate();
  return useMutation({
    mutationFn: (input: {
      advertiserId: string;
      approvalStatus?: "pending" | "approved" | "rejected" | undefined;
      status?: "active" | "pending" | "suspended" | undefined;
      reason?: string | null | undefined;
    }) => fn({ data: input }),
    onSuccess: () => {
      invalidate();
      invalidateAdmin();
    },
  });
}

export function useReviewAd() {
  const fn = useServerFn(reviewAd);
  const invalidate = useAdvertiserInvalidate();
  const invalidateAdmin = useAdminInvalidate();
  return useMutation({
    mutationFn: (input: {
      adId: string;
      action: "approve" | "reject";
      reason?: string | null | undefined;
    }) => fn({ data: input }),
    onSuccess: () => {
      invalidate();
      invalidateAdmin();
    },
  });
}

// ---------------------------------------------------------------- AI copilot

export function useAICampaignPlan() {
  const fn = useServerFn(generateAICampaignPlan);
  const invalidate = useAdvertiserInvalidate();
  return useMutation({
    mutationFn: (input: {
      organizationId: string;
      description: string;
      currency?: string;
      budget?: number;
      durationDays?: number;
      location?: string;
      website?: string;
      whatsapp?: string;
      objective?: string;
    }) => fn({ data: input }),
    onSuccess: invalidate,
  });
}

export function useAIAdCopy() {
  const fn = useServerFn(generateAIAdCopy);
  const invalidate = useAdvertiserInvalidate();
  return useMutation({
    mutationFn: (input: {
      organizationId: string;
      product: string;
      audience: string;
      tone?: string;
      cta?: string;
      existingCopy?: string;
      action?: "generate" | "improve" | "shorter" | "persuasive" | "professional" | "local";
    }) => fn({ data: input }),
    onSuccess: invalidate,
  });
}

export function useAITargeting() {
  const fn = useServerFn(generateAITargeting);
  const invalidate = useAdvertiserInvalidate();
  return useMutation({
    mutationFn: (input: {
      organizationId: string;
      business: string;
      location: string;
      audience: string;
      budget: number;
      currency?: string;
    }) => fn({ data: input }),
    onSuccess: invalidate,
  });
}

export function useAICreativeConcept() {
  const fn = useServerFn(generateAICreativeConcept);
  const invalidate = useAdvertiserInvalidate();
  return useMutation({
    mutationFn: (input: {
      organizationId: string;
      product: string;
      audience: string;
      message: string;
      formats: string[];
    }) => fn({ data: input }),
    onSuccess: invalidate,
  });
}
