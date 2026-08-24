import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { useAuth } from "@/lib/auth-context";
import { membershipsOfType } from "@/lib/authorization";
import type { PayoutStatus } from "@/lib/billing-domain";
import {
  addWalletFunds,
  decidePayout,
  fetchAdminLedger,
  fetchAdminPayouts,
  fetchAdminWalletTransactions,
  fetchBillingSettings,
  fetchCampaignSpend,
  fetchPayouts,
  fetchPublisherEarnings,
  fetchSupportedCurrencies,
  fetchPaymentMethods,
  fetchWallet,
  fetchWallets,
  fetchWalletTransactions,
  fetchPaymentStatus,
  confirmPayment,
  initiatePayment,
  refundCharge,
  saveRevenueSplit,
  submitPayoutRequest,
  publicFetchPaymentStatus,
  publicConfirmPayment,
} from "@/lib/billing.functions";

const MANAGER_ROLES = ["owner", "admin"];

/** Primary advertiser organization for the signed-in user. */
export function useAdvertiserOrg() {
  const { memberships, loadingIdentity } = useAuth();
  const primary = membershipsOfType(memberships, "advertiser")[0] ?? null;
  return {
    loading: loadingIdentity,
    organizationId: primary?.organization.id ?? null,
    organization: primary?.organization ?? null,
    canManageFunds: primary ? MANAGER_ROLES.includes(primary.role) : false,
  };
}

export function useBillingSettings() {
  const fn = useServerFn(fetchBillingSettings);
  return useQuery({ queryKey: ["billing", "settings"], queryFn: () => fn({}) });
}

export function useSupportedCurrencies() {
  const fn = useServerFn(fetchSupportedCurrencies);
  return useQuery({
    queryKey: ["billing", "supported-currencies"],
    queryFn: () => fn({}),
  });
}

export function usePaymentMethods(countryCode: string | null, currencyCode: string | null) {
  const fn = useServerFn(fetchPaymentMethods);
  return useQuery({
    queryKey: ["billing", "payment-methods", countryCode, currencyCode],
    enabled: Boolean(countryCode && currencyCode),
    queryFn: () => fn({ data: { countryCode: countryCode!, currencyCode: currencyCode! } }),
  });
}


// ------------------------------------------------------------------- wallet

export function useWallet(organizationId: string | null, currency = "KES") {
  const fn = useServerFn(fetchWallet);
  return useQuery({
    queryKey: ["billing", "wallet", organizationId, currency],
    enabled: Boolean(organizationId),
    queryFn: () => fn({ data: { organizationId: organizationId!, currency } }),
  });
}

export function useWallets(organizationId: string | null) {
  const fn = useServerFn(fetchWallets);
  return useQuery({
    queryKey: ["billing", "wallets", organizationId],
    enabled: Boolean(organizationId),
    queryFn: () => fn({ data: { organizationId: organizationId! } }),
  });
}

export function useWalletTransactions(organizationId: string | null, options?: { currency?: string; limit?: number }) {
  const fn = useServerFn(fetchWalletTransactions);
  return useQuery({
    queryKey: ["billing", "wallet-transactions", organizationId, options?.currency],
    enabled: Boolean(organizationId),
    queryFn: () =>
      fn({
        data: {
          organizationId: organizationId!,
          ...(options?.currency ? { currency: options.currency } : {}),
          ...(options?.limit ? { limit: options.limit } : {}),
        },
      }),
  });
}

export function useCampaignSpend(organizationId: string | null) {
  const fn = useServerFn(fetchCampaignSpend);
  return useQuery({
    queryKey: ["billing", "campaign-spend", organizationId],
    enabled: Boolean(organizationId),
    queryFn: () => fn({ data: { organizationId: organizationId! } }),
  });
}

export function useAddFunds(organizationId: string | null) {
  const fn = useServerFn(addWalletFunds);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { amount: number; currency?: string; idempotencyKey: string; description?: string }) =>
      fn({
        data: {
          organizationId: organizationId!,
          amount: input.amount,
          ...(input.currency ? { currency: input.currency } : {}),
          idempotencyKey: input.idempotencyKey,
          ...(input.description ? { description: input.description } : {}),
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["billing"] });
    },
  });
}

export function useInitiatePayment(organizationId: string | null) {
  const fn = useServerFn(initiatePayment);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      amount: number;
      countryCode: string;
      currencyCode: string;
      paymentMethodId?: string;
      phoneNumber?: string;
    }) =>
      fn({
        data: {
          organizationId: organizationId!,
          amount: input.amount,
          countryCode: input.countryCode,
          currencyCode: input.currencyCode,
          ...(input.paymentMethodId ? { paymentMethodId: input.paymentMethodId } : {}),
          ...(input.phoneNumber ? { phoneNumber: input.phoneNumber } : {}),
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["billing"] });
    },
  });
}

export function usePaymentStatus(reference: string | null) {
  const fn = useServerFn(fetchPaymentStatus);
  return useQuery({
    queryKey: ["billing", "payment-status", reference],
    enabled: Boolean(reference),
    queryFn: () => fn({ data: { reference: reference! } }),
    // Poll while the M-PESA prompt is still awaiting the customer's PIN.
    refetchInterval: (query) => {
      const status = (query.state.data as { status?: string } | undefined)?.status;
      return status && status !== "pending" && status !== "processing" ? false : 4000;
    },
  });
}

export function usePublicPaymentStatus(reference: string | null) {
  const fn = useServerFn(publicFetchPaymentStatus);
  return useQuery({
    queryKey: ["billing", "public-payment-status", reference],
    enabled: Boolean(reference),
    queryFn: () => fn({ data: { reference: reference! } }),
    refetchInterval: (query) => {
      const status = (query.state.data as { status?: string } | undefined)?.status;
      return status && status !== "pending" && status !== "processing" ? false : 4000;
    },
  });
}

export function useConfirmPayment() {
  const fn = useServerFn(confirmPayment);
  return useMutation({
    mutationFn: (reference: string) => fn({ data: { reference } }),
  });
}

export function usePublicConfirmPayment() {
  const fn = useServerFn(publicConfirmPayment);
  return useMutation({
    mutationFn: (reference: string) => fn({ data: { reference } }),
  });
}

export function usePublisherEarnings(organizationId: string | null) {
  const fn = useServerFn(fetchPublisherEarnings);
  return useQuery({
    queryKey: ["billing", "earnings", organizationId],
    enabled: Boolean(organizationId),
    queryFn: () => fn({ data: { organizationId: organizationId! } }),
  });
}

export function usePayouts(organizationId: string | null) {
  const fn = useServerFn(fetchPayouts);
  return useQuery({
    queryKey: ["billing", "payouts", organizationId],
    enabled: Boolean(organizationId),
    queryFn: () => fn({ data: { organizationId: organizationId! } }),
  });
}

export function useRequestPayout(organizationId: string | null) {
  const fn = useServerFn(submitPayoutRequest);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { method: "bank_transfer" | "paypal" | "wise"; destination: string }) =>
      fn({ data: { organizationId: organizationId!, ...input } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["billing"] });
    },
  });
}

// -------------------------------------------------------------------- admin

export function useAdminPayouts() {
  const fn = useServerFn(fetchAdminPayouts);
  return useQuery({ queryKey: ["billing", "admin-payouts"], queryFn: () => fn({}) });
}

export function useDecidePayout() {
  const fn = useServerFn(decidePayout);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      payoutId: string;
      status: PayoutStatus;
      reason?: string | null;
      paymentReference?: string | null;
    }) => fn({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["billing"] });
    },
  });
}

export function useAdminLedger() {
  const fn = useServerFn(fetchAdminLedger);
  return useQuery({ queryKey: ["billing", "admin-ledger"], queryFn: () => fn({}) });
}

export function useAdminWalletTransactions(filters: {
  organizationId?: string;
  type?: string;
  search?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  const fn = useServerFn(fetchAdminWalletTransactions);
  return useQuery({
    queryKey: ["billing", "admin-wallet-transactions", filters],
    queryFn: async () => fn({ data: filters }),
  });
}

export function useSaveRevenueSplit() {
  const fn = useServerFn(saveRevenueSplit);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      publisherRevenueShare: number;
      earningsHoldDays: number;
      minimumPayoutAmount: number;
    }) => fn({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["billing"] });
    },
  });
}

export function useRefundCharge() {
  const fn = useServerFn(refundCharge);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { campaignSpendId: string; reason?: string | null }) => fn({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["billing"] });
    },
  });
}
