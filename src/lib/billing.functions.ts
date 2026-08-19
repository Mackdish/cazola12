import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  adminAdjustWallet,
  adminGetLedger,
  adminGetWallet,
  adminListDeposits,
  adminListPayouts,
  adminListWalletTransactions,
  adminRefundSpend,
  adminReviewPayout,
  depositToWallet,
  getBillingSettings,
  getPublisherEarnings,
  getSupportedCurrencies,
  getWallet,
  getWallets,
  listCampaignSpend,
  listPayouts,
  listWalletTransactions,
  requestPayout,
  saveBillingSettings,
} from "@/lib/billing-service.server";
import { getActivePaymentMethods } from "@/lib/payment-config.server";
import {
  getPaymentStatus,
  initializePayment,
} from "@/lib/payment-service.server";

const uuid = z.string().uuid();
const orgInput = z.object({ organizationId: uuid });
const payoutStatus = z.enum(["pending", "approved", "paid", "rejected"]);

export const fetchWallet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ organizationId: uuid, currency: z.string().length(3).optional() }).parse(data),
  )
  .handler(async ({ data, context }) =>
    getWallet(
      await paymentCtx(context as never, data.organizationId),
      data.organizationId,
      data.currency ?? "KES",
    ),
  );


export const fetchWallets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => orgInput.parse(data))
  .handler(async ({ data, context }) =>
    getWallets(await paymentCtx(context as never, data.organizationId), data.organizationId),
  );


export const fetchSupportedCurrencies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) => getSupportedCurrencies(context));

export const fetchPaymentMethods = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ countryCode: z.string().length(2), currencyCode: z.string().length(3) }).parse(data),
  )
  .handler(({ data, context }) =>
    getActivePaymentMethods(context.supabase as never, data.countryCode, data.currencyCode),
  );


export const fetchWalletTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        organizationId: uuid,
        currency: z.string().length(3).optional(),
        limit: z.number().int().min(1).max(500).optional(),
      })
      .parse(data),
  )
      .handler(({ data, context }) =>
        listWalletTransactions(context, data.organizationId, {
          ...(data.currency ? { currency: data.currency } : {}),
          ...(data.limit ? { limit: data.limit } : {}),
        }),
      );

export const fetchCampaignSpend = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => orgInput.parse(data))
  .handler(({ data, context }) => listCampaignSpend(context, data.organizationId));

export const addWalletFunds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        organizationId: uuid,
        amount: z.number().positive().max(1_000_000),
        currency: z.string().length(3).default("KES"),
        idempotencyKey: z.string().trim().min(8).max(120),
        description: z.string().trim().max(200).optional().nullable(),
      })
      .parse(data),
  )
  .handler(({ data, context }) =>
    depositToWallet(context, {
      organizationId: data.organizationId,
      amount: data.amount,
      currency: data.currency,
      idempotencyKey: data.idempotencyKey,
      description: data.description ?? null,
    }),
  );

export const fetchBillingSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) => getBillingSettings(context));

export const saveRevenueSplit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        publisherRevenueShare: z.number().min(0).max(1),
        earningsHoldDays: z.number().int().min(0).max(180),
        minimumPayoutAmount: z.number().min(0).max(100_000),
      })
      .parse(data),
  )
  .handler(({ data, context }) => saveBillingSettings(context, data));

export const fetchPublisherEarnings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => orgInput.parse(data))
  .handler(({ data, context }) => getPublisherEarnings(context, data.organizationId));

export const fetchPayouts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => orgInput.parse(data))
  .handler(({ data, context }) => listPayouts(context, data.organizationId));

export const submitPayoutRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        organizationId: uuid,
        method: z.enum(["bank_transfer", "paypal", "wise"]),
        destination: z.string().trim().min(4).max(200),
      })
      .parse(data),
  )
  .handler(({ data, context }) => requestPayout(context, data));

export const fetchAdminPayouts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) => adminListPayouts(context));

export const decidePayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        payoutId: uuid,
        status: payoutStatus,
        reason: z.string().trim().max(500).optional().nullable(),
        paymentReference: z.string().trim().max(120).optional().nullable(),
      })
      .parse(data),
  )
  .handler(({ data, context }) =>
    adminReviewPayout(context, {
      payoutId: data.payoutId,
      status: data.status,
      reason: data.reason ?? null,
      paymentReference: data.paymentReference ?? null,
    }),
  );

export const fetchAdminLedger = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) => adminGetLedger(context));

export const refundCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({ campaignSpendId: uuid, reason: z.string().trim().max(500).optional().nullable() })
      .parse(data),
  )
  .handler(({ data, context }) =>
    adminRefundSpend(context, {
      campaignSpendId: data.campaignSpendId,
      reason: data.reason ?? null,
    }),
  );

export const fetchAdminWalletTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        organizationId: uuid.optional().nullable(),
        type: z.string().optional().nullable(),
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
    if (d.type) filters["type"] = d.type;
    if (d.search) filters["search"] = d.search;
    if (d.page) filters["page"] = d.page;
    if (d.pageSize) filters["pageSize"] = d.pageSize;
    return adminListWalletTransactions(context, filters as never);
  });

export const fetchAdminWallet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ organizationId: uuid }).parse(data))
  .handler(({ data, context }) => adminGetWallet(context, data.organizationId));

export const adjustAdminWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        walletId: uuid,
        amount: z.number().positive().max(1_000_000),
        reason: z.string().trim().min(3).max(200),
      })
      .parse(data),
  )
  .handler(({ data, context }) =>
    adminAdjustWallet(context, {
      walletId: data.walletId,
      amount: data.amount,
      reason: data.reason,
    }),
  );

export const fetchAdminDeposits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        organizationId: uuid.optional().nullable(),
        page: z.number().int().positive().optional().nullable(),
        pageSize: z.number().int().positive().optional().nullable(),
      })
      .parse(data),
  )
  .handler(({ data, context }) => {
    const filters: Record<string, unknown> = {};
    const d = data as any;
    if (d.organizationId) filters["organizationId"] = d.organizationId;
    if (d.page) filters["page"] = d.page;
    if (d.pageSize) filters["pageSize"] = d.pageSize;
    return adminListDeposits(context, filters as never);
  });

// ------------------------------------------------------------------- payments

/**
 * Payment flows touch SECURITY DEFINER money functions that signed-in users
 * cannot execute directly. We authorize the caller against the organization
 * first, then run the flow with the trusted server client.
 */
async function paymentCtx(context: { supabase: any; userId: string }, organizationId: string) {
  const { data: isMember, error } = await context.supabase.rpc("is_org_member", {
    _organization_id: organizationId,
    _user_id: context.userId,
  });
  if (error || !isMember) throw new Error("You don't have access to this organization.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return { supabase: supabaseAdmin as never, userId: context.userId } as never;
}

async function paymentCtxForReference(
  context: { supabase: any; userId: string },
  reference: string,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: payment } = await (supabaseAdmin as any)
    .from("payments")
    .select("organization_id")
    .eq("reference", reference)
    .maybeSingle();
  if (!payment) throw new Error("Payment not found.");
  return paymentCtx(context, payment.organization_id as string);
}

export const initiatePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        organizationId: uuid,
        amount: z.number().positive().max(10_000_000),
        countryCode: z.string().length(2),
        currencyCode: z.string().length(3),
        paymentMethodId: z.string().optional(),
        phoneNumber: z.string().trim().min(10).max(15).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) =>
    initializePayment(await paymentCtx(context as never, data.organizationId), {
      organizationId: data.organizationId,
      amount: data.amount,
      countryCode: data.countryCode,
      currencyCode: data.currencyCode,
      ...(data.paymentMethodId ? { paymentMethodId: data.paymentMethodId } : {}),
      ...(data.phoneNumber ? { phoneNumber: data.phoneNumber } : {}),
    }),
  );

export const fetchPaymentStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ reference: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data, context }) =>
    getPaymentStatus(await paymentCtxForReference(context as never, data.reference), data.reference),
  );


/**
 * Confirmation-page fallback: if the webhook hasn't landed yet, verify the
 * payment with the provider server-side (secret key never leaves the server)
 * and credit the wallet exactly once.
 */
export const confirmPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ reference: z.string().min(1).max(120) }).parse(data))
  .handler(async ({ data, context }) => {
    const ctx = await paymentCtxForReference(context as never, data.reference);
    const current = await getPaymentStatus(ctx, data.reference);
    if (current.status === "completed" || current.status === "failed" || current.status === "cancelled") {
      return { ...current, verified: false };
    }

    const { verifyAndCompletePayment } = await import("@/lib/payment-orchestrator.server");
    try {
      const result = await verifyAndCompletePayment(
        ctx,
        data.reference,
        current.provider ?? "payzaapi",
      );
      return {
        ...current,
        status: result.status || current.status,
        verified: true,
        alreadyCompleted: result.alreadyCompleted,
      };
    } catch {
      return { ...current, verified: false };
    }
  });
