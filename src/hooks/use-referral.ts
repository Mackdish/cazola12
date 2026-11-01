import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  adminFetchReferralOverview,
  adminProcessReferrals,
  adminUpdateReferralSettings,
  adminVoidReferral,
  applyReferralCode,
  fetchReferralOverview,
  type ReferralSettingsInput,
} from "@/lib/referral.functions";

export function useReferralOverview(organizationId: string | null) {
  const fn = useServerFn(fetchReferralOverview);
  return useQuery({
    queryKey: ["referral", "overview", organizationId],
    queryFn: () => fn({ data: { organizationId: organizationId! } }),
    enabled: Boolean(organizationId),
  });
}

export function useApplyReferralCode() {
  const fn = useServerFn(applyReferralCode);
  return useMutation({ mutationFn: (code: string) => fn({ data: { code } }) });
}

export function useAdminReferralOverview() {
  const fn = useServerFn(adminFetchReferralOverview);
  return useQuery({ queryKey: ["referral", "admin"], queryFn: () => fn() });
}

export function useAdminUpdateReferralSettings() {
  const fn = useServerFn(adminUpdateReferralSettings);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ReferralSettingsInput) => fn({ data }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["referral"] }),
  });
}

export function useAdminVoidReferral() {
  const fn = useServerFn(adminVoidReferral);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { referralId: string; reason?: string }) => fn({ data }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["referral"] }),
  });
}

export function useAdminProcessReferrals() {
  const fn = useServerFn(adminProcessReferrals);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => fn(),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["referral"] }),
  });
}
