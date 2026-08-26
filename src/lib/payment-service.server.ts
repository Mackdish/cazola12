/**
 * Server-only payment service.
 *
 * Handles payment initialization, tracking, and wallet crediting.
 * Uses the payment orchestrator for provider-agnostic operations.
 * All financial mutations go through SECURITY DEFINER database functions.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkRateLimit, getRateLimitConfig, extractIpAddress } from "@/lib/rate-limit.server";
import { logAuditEvent } from "@/lib/audit-log.server";
import { initializePaymentWithProvider, processWebhook, verifyAndCompletePayment } from "@/lib/payment-orchestrator.server";

type Client = SupabaseClient<Database>;
export type Ctx = { supabase: Client; userId: string };

export class PaymentError extends Error {}

function fail(message: string): never {
  throw new PaymentError(message);
}

function normalizePhoneNumber(raw: string, countryCode: string): string {
  const digits = raw.replace(/\D/g, "");

  if (countryCode === "KE") {
    if (digits.startsWith("254")) return digits;
    if (digits.startsWith("0")) return "254" + digits.slice(1);
  }

  return digits;
}

export async function initializePayment(
  ctx: Ctx,
  input: {
    organizationId: string;
    amount: number;
    countryCode: string;
    currencyCode: string;
    paymentMethodId?: string;
    phoneNumber?: string;
  },
) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    fail("Enter a valid amount.");
  }

  let phone = "";
  if (input.phoneNumber) {
    phone = normalizePhoneNumber(input.phoneNumber, input.countryCode);
  }

  const result = await initializePaymentWithProvider(ctx, {
    organizationId: input.organizationId,
    amount: input.amount,
    countryCode: input.countryCode,
    currencyCode: input.currencyCode,
    ...(input.paymentMethodId ? { paymentMethodId: input.paymentMethodId } : {}),
    ...(input.phoneNumber ? { phoneNumber: input.phoneNumber } : {}),
  } as any);

  return result;
}

export async function markPaymentFailed(
  ctx: Ctx,
  paymentId: string,
  reason?: string,
) {
  const { data, error } = await ctx.supabase.rpc("fail_payment" as never, {
    _payment_id: paymentId,
    _provider: "payzaapi",
    _failure_reason: reason ?? null,
  } as never);

  if (error) fail("We couldn't update the payment status.");

  const result = Array.isArray(data) ? data[0] : data;
  return result;
}

export async function markPaymentCancelled(ctx: Ctx, paymentId: string) {
  const { data, error } = await ctx.supabase.rpc("cancel_payment" as never, {
    _payment_id: paymentId,
    _provider: "payzaapi",
  } as never);

  if (error) fail("We couldn't cancel the payment.");

  const result = Array.isArray(data) ? data[0] : data;
  return result;
}

export async function completePaymentByReference(
  ctx: Ctx,
  reference: string,
  providerReference: string,
  providerTransactionId?: string,
  providerReceipt?: string,
  verifiedAmount?: number,
  verifiedCurrency?: string,
) {
  console.log("[payment] completePaymentByReference:", {
    reference,
    providerReference,
    providerTransactionId,
    providerReceipt,
    verifiedAmount,
    verifiedCurrency,
    userId: ctx.userId,
  });
  const { data: payment, error: findError } = await ctx.supabase
    .from("payments" as never)
    .select("id, status, amount, currency, wallet_id, organization_id, provider")
    .eq("reference", reference)
    .maybeSingle();

  if (findError || !payment) {
    console.log("[payment] completePaymentByReference not found:", { findError: findError?.message });
    fail("Payment not found.");
  }

  console.log("[payment] completePaymentByReference found:", {
    id: (payment as any).id,
    status: (payment as any).status,
    walletId: (payment as any).wallet_id,
    organizationId: (payment as any).organization_id,
    amount: (payment as any).amount,
    currency: (payment as any).currency,
  });

  if ((payment as any).status === "completed") {
    console.log("[payment] completePaymentByReference already completed");
    console.log("[payment][completion][RESULT]", {
      reference,
      paymentId: (payment as any).id,
      verifiedAmount,
      verifiedCurrency,
      rpcCalled: false,
      rpcSucceeded: true,
      walletBalance: null,
      alreadyCompleted: true,
    });
    return { paymentId: (payment as any).id, status: "completed", alreadyCompleted: true };
  }

  if (verifiedAmount !== undefined && Number((payment as any).amount) !== Number(verifiedAmount)) {
    fail("Payment amount mismatch.");
  }

  if (verifiedCurrency && (payment as any).currency !== verifiedCurrency) {
    fail("Payment currency mismatch.");
  }

  const provider = (payment as any).provider ?? "payzaapi";

  console.log("[payment] completePaymentByReference calling complete_payment RPC:", {
    paymentId: (payment as any).id,
    walletId: (payment as any).wallet_id,
    provider,
    providerReference,
    verifiedAmount,
    verifiedCurrency,
  });

  console.log("[wallet][target]", {
    reference,
    paymentId: (payment as any).id,
    organizationId: (payment as any).organization_id,
    userId: ctx.userId,
    walletId: (payment as any).wallet_id,
    walletCurrency: (payment as any).currency,
    verifiedCurrency,
    verifiedAmount,
  });

  const { data, error } = await ctx.supabase.rpc("complete_payment" as never, {
    _payment_id: (payment as any).id,
    _provider: provider,
    _provider_reference: providerReference,
    _provider_transaction_id: providerTransactionId ?? null,
    _provider_receipt: providerReceipt ?? null,
  } as never);

  if (error) {
    console.log("[wallet][credit][ERROR]", {
      reference,
      paymentId: (payment as any).id,
      walletId: (payment as any).wallet_id,
      error: error.message,
      code: (error as any).code,
      details: (error as any).details,
      hint: (error as any).hint,
    });
    console.log("[payment] completePaymentByReference RPC error:", error);
    console.log("[payment][completion][RESULT]", {
      reference,
      paymentId: (payment as any).id,
      verifiedAmount,
      verifiedCurrency,
      rpcCalled: true,
      rpcSucceeded: false,
      walletBalance: null,
      rpcError: error.message,
    });
    fail("We couldn't complete the payment. Please contact support.");
  }

  const result = Array.isArray(data) ? data[0] : data;
  console.log("[wallet][credit][SUCCESS]", {
    reference,
    paymentId: (payment as any).id,
    walletId: (payment as any).wallet_id,
    newBalance: (result as any).wallet_balance,
    alreadyCompleted: (result as any).already_completed,
  });
  console.log("[wallet][transaction]", {
    reference,
    paymentId: (payment as any).id,
    walletId: (payment as any).wallet_id,
    walletBalance: (result as any).wallet_balance,
    alreadyCompleted: (result as any).already_completed,
    rpcResult: result,
  });
  console.log("[payment][completion][RESULT]", {
    reference,
    paymentId: (payment as any).id,
    verifiedAmount,
    verifiedCurrency,
    rpcCalled: true,
    rpcSucceeded: true,
    walletBalance: (result as any).wallet_balance,
    rpcResult: result,
  });
  console.log("[payment] completePaymentByReference RPC result:", {
    ...result,
    walletBalance: (result as any).wallet_balance,
  });
  return {
    ...(result as any),
    alreadyCompleted: Boolean((result as any)?.already_completed),
  };
}

export async function getPaymentStatus(
  ctx: Ctx,
  reference: string,
) {
  console.log("[payment] getPaymentStatus:", { reference, userId: ctx.userId });
  const { data: payment, error: findError } = await ctx.supabase
    .from("payments" as never)
    .select("id, status, amount, currency, reference, payment_url, provider, created_at, updated_at")
    .eq("reference", reference)
    .maybeSingle();

  if (findError || !payment) {
    console.log("[payment] getPaymentStatus not found:", { findError: findError?.message, payment });
    fail("Payment not found.");
  }

  console.log("[payment] getPaymentStatus found:", { id: (payment as any).id, status: (payment as any).status });
  return {
    paymentId: (payment as any).id,
    reference: (payment as any).reference,
    status: (payment as any).status,
    amount: (payment as any).amount,
    currency: (payment as any).currency,
    paymentUrl: (payment as any).payment_url,
    provider: (payment as any).provider,
    createdAt: (payment as any).created_at,
    updatedAt: (payment as any).updated_at,
  };
}
