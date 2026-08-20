/**
 * Server-only payment orchestrator.
 *
 * Coordinates payment flow using the provider-agnostic interface.
 * Handles initialization, webhook processing, and verification.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { PaymentProvider, PaymentInitializeInput, PaymentInitializeResult, PaymentVerificationResult, WebhookVerificationResult } from "@/lib/payment-provider.interface";
import { payzaApiProvider, normalizeMpesaPhone, getCallbackUrl, getAppBaseUrl, CurrencyUnavailableError } from "@/lib/payzaapi.server";
import { logAuditEvent } from "@/lib/audit-log.server";
import { logAuditEvent } from "@/lib/audit-log.server";
import { getSupportedCurrencies } from "@/lib/payment-config.server";

type Client = SupabaseClient<Database>;
export type Ctx = { supabase: Client; userId: string; claims?: Record<string, any> | undefined };

export class PaymentOrchestratorError extends Error {}

function fail(message: string): never {
  throw new PaymentOrchestratorError(message);
}

const providers = new Map<string, PaymentProvider>([
  ["payzaapi", payzaApiProvider],
  ["optimapay", optimaPayProvider],
]);

export function registerProvider(provider: PaymentProvider): void {
  providers.set(provider.name, provider);
}

export function getProvider(name: string): PaymentProvider {
  const provider = providers.get(name);
  if (!provider) {
    fail(`Payment provider "${name}" is not configured.`);
  }
  return provider;
}

export async function resolveProviderForPayment(
  supabase: Client,
  paymentMethodId: string,
): Promise<PaymentProvider> {
  const { data, error } = await (supabase as any)
    .from("payment_methods")
    .select("provider_id, payment_providers(name)")
    .eq("id", paymentMethodId)
    .eq("active", true)
    .maybeSingle();

  if (error || !data) {
    fail("Payment method not available.");
  }

  const providerName = data.payment_providers?.name ?? data.provider_id;
  return getProvider(providerName);
}

export async function initializePaymentWithProvider(
  ctx: Ctx,
  input: {
    organizationId: string;
    amount: number;
    countryCode: string;
    currencyCode: string;
    paymentMethodId?: string;
    phoneNumber?: string;
  },
): Promise<{
  paymentId: string;
  reference: string;
  amount: number;
  currency: string;
  countryCode: string;
  symbol: string;
  provider: string;
  paymentMethod: string;
  status: string;
  paymentUrl: string | null;
}> {
  const normalizedCurrency = input.currencyCode.trim().toUpperCase();
  const normalizedCountry = input.countryCode.trim().toUpperCase();

  const supported = await getSupportedCurrencies(ctx.supabase);
  const currencyConfig = supported.find((c) => c.currencyCode === normalizedCurrency && c.active);
  if (!currencyConfig) {
    fail(`Currency "${input.currencyCode}" is not supported. Please select a different currency.`);
  }

  const { data: route, error: routeError } = await (ctx.supabase as any).rpc("get_supported_payment_methods", {
    _country_code: normalizedCountry,
    _currency: normalizedCurrency,
  } as never);

  if (routeError || !(route as any)?.length) {
    fail("Payment method currently unavailable for this country/currency.");
  }

  let selectedMethod = (route as any)[0];
  if (input.paymentMethodId) {
    const found = (route as any).find((m: any) => m.id === input.paymentMethodId);
    if (!found) {
      fail("Payment method not available for this country/currency.");
    }
    selectedMethod = found;
  }

  // KES keeps the existing M-PESA STK push flow. Every other currency goes
  // through PayzaAPI's hosted checkout page (no STK push, no phone required).
  const useHostedCheckout = normalizedCurrency !== "KES";

  const isMobileMoney =
    !useHostedCheckout &&
    /m-?pesa|mpesa|mobile/i.test(
      `${selectedMethod.name ?? ""} ${selectedMethod.display_name ?? ""}`,
    );
  let normalizedPhone: string | undefined;
  if (isMobileMoney) {
    const phone = input.phoneNumber ? normalizeMpesaPhone(input.phoneNumber) : null;
    if (!phone) {
      fail("Enter the M-PESA phone number that should receive the payment prompt (e.g. 0712345678).");
    }
    normalizedPhone = phone;
  } else if (input.phoneNumber) {
    normalizedPhone = input.phoneNumber;
  }

  const minimum = Number(selectedMethod.minimum_amount ?? 0);
  const maximum = selectedMethod.maximum_amount ? Number(selectedMethod.maximum_amount) : null;
  if (minimum && input.amount < minimum) {
    fail(`Minimum deposit for ${selectedMethod.display_name} is ${minimum} ${normalizedCurrency}.`);
  }
  if (maximum && input.amount > maximum) {
    fail(`Maximum deposit for ${selectedMethod.display_name} is ${maximum} ${normalizedCurrency}.`);
  }

  const provider = getProvider(selectedMethod.provider_name ?? selectedMethod.provider_id);

  if (isMobileMoney && normalizedPhone) {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: pendingPayments, error: pendingError } = await ctx.supabase
      .from("payments")
      .select("id, reference, created_at")
      .eq("phone_number", normalizedPhone)
      .eq("status", "pending")
      .gte("created_at", fiveMinutesAgo)
      .order("created_at", { ascending: false })
      .limit(1);

    if (pendingError) {
      console.error("[payment-orchestrator] pending payment check failed", pendingError);
    } else if (pendingPayments && pendingPayments.length > 0) {
      fail(
        "An M-PESA payment prompt is already pending for this phone number. " +
        "Please check your phone and enter your PIN, or wait a few minutes before trying again.",
      );
    }
  }

  const { data: wallet, error: walletError } = await ctx.supabase.rpc("ensure_wallet_for_currency" as never, {
    _organization_id: input.organizationId,
    _currency: normalizedCurrency,
    _country_code: normalizedCountry,
  } as never);

  console.log("[payment-orchestrator] ensure_wallet_for_currency result", {
    walletError: walletError ? { message: walletError.message, code: walletError.code } : null,
    wallet: Array.isArray(wallet) ? wallet[0] : wallet,
    organizationId: input.organizationId,
    currency: normalizedCurrency,
    countryCode: normalizedCountry,
  });

  if (walletError) {
    if (process.env["NODE_ENV"] !== "production") {
      console.error("[payment-orchestrator] ensure_wallet_for_currency error", {
        organizationId: input.organizationId,
        currency: normalizedCurrency,
        countryCode: normalizedCountry,
        message: walletError.message,
        code: walletError.code,
      });
    }
    fail("We couldn't access your wallet. Please try again or contact support.");
  }

  const walletRow = (Array.isArray(wallet) ? wallet[0] : wallet) as any;
  if (!walletRow?.id) {
    if (process.env["NODE_ENV"] !== "production") {
      console.error("[payment-orchestrator] ensure_wallet_for_currency returned no row", {
        organizationId: input.organizationId,
        currency: normalizedCurrency,
        countryCode: normalizedCountry,
        wallet,
      });
    }
    fail("We couldn't find your wallet. Please try again or contact support.");
  }

  const claims = (ctx as any).claims ?? {};
  let customerEmail: string | undefined = claims.email ?? claims.user_metadata?.email ?? undefined;
  let customerName: string | undefined =
    claims.user_metadata?.full_name ?? claims.user_metadata?.name ?? claims.name ?? undefined;

  // The provider requires a valid customer.email. Claims are missing it for
  // API-key callers and some sessions, so fall back to the auth record.
  if (!customerEmail || !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(customerEmail)) {
    customerEmail = undefined;
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: authUser } = await (supabaseAdmin as any).auth.admin.getUserById(
        (ctx as any).userId,
      );
      const email = authUser?.user?.email as string | undefined;
      if (email && /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email)) customerEmail = email;
      if (!customerName) {
        customerName =
          (authUser?.user?.user_metadata?.full_name as string | undefined) ??
          (authUser?.user?.user_metadata?.name as string | undefined) ??
          undefined;
      }
    } catch {
      /* fall through to the synthetic address below */
    }
  }
  if (!customerEmail) {
    customerEmail = `billing+${String((ctx as any).userId ?? "user").slice(0, 8)}@trademall.co.ke`;
  }
  if (!customerName) customerName = "TradeMall Customer";


  const isDuplicateReference = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    return /\(409\)|already exists|duplicate/i.test(message);
  };

  const isTransientProviderError = (error: unknown) => {
    if (error instanceof Error) {
      const status = (error as any).status;
      return [502, 503, 504].includes(status);
    }
    return false;
  };

  let lastError: unknown = null;

  // The provider rejects a reference it has already seen. References are
  // globally unique by construction, but retry with a brand new one if the
  // provider still reports a collision.
  for (let attempt = 0; attempt < 3; attempt++) {
    const reference = `PAY-${Date.now().toString(36).toUpperCase()}-${crypto
      .randomUUID()
      .replace(/-/g, "")
      .slice(0, 12)
      .toUpperCase()}`;
    const paymentId = crypto.randomUUID();

    const { data: payment, error: paymentError } = await ctx.supabase.rpc("create_payment" as never, {
      _id: paymentId,
      _user_id: ctx.userId,
      _organization_id: input.organizationId,
      _wallet_id: walletRow.id,
      _provider: provider.name,
      _amount: input.amount,
      _currency: normalizedCurrency,
      _reference: reference,
      _payment_url: null,
      _phone_number: normalizedPhone ?? null,
    } as never);

    if (paymentError) {
      console.error("[payment-orchestrator] create_payment failed", {
        message: paymentError.message,
        code: paymentError.code,
        details: paymentError.details,
        hint: paymentError.hint,
        organizationId: input.organizationId,
        currency: normalizedCurrency,
        countryCode: normalizedCountry,
        walletId: walletRow?.id,
        paymentId,
        reference,
      });
      fail("We couldn't initialize the payment. Please try again.");
    }

    const created = Array.isArray(payment) ? (payment as any[])[0] : (payment as any);
    if (!created?.id) {
      lastError = new PaymentOrchestratorError("Payment reference already exists.");
      continue;
    }

    try {
      const providerResult = await provider.initializePayment({
        amount: input.amount,
        currency: normalizedCurrency,
        reference: created.reference,
        ...(normalizedPhone ? { phoneNumber: normalizedPhone } : {}),
        description: `Wallet deposit ${created.reference}`,
        ...(customerEmail ? { customerEmail } : {}),
        ...(customerName ? { customerName } : {}),
        callbackUrl: getCallbackUrl(),
        ...(useHostedCheckout
          ? {
              hostedCheckout: true,
              redirectUrl: `${getAppBaseUrl()}/payment/confirm?reference=${encodeURIComponent(created.reference)}`,
              cancelUrl: `${getAppBaseUrl()}/advertiser/wallet`,
            }
          : {}),
      });

      const { error: updateError } = await ctx.supabase.rpc("update_payment_details" as never, {
        _id: created.id,
        _payment_url: providerResult.paymentUrl || null,
        _provider_reference: providerResult.providerReference ?? null,
      } as never);

      if (updateError) {
        console.error("[payment-orchestrator] update_payment_details failed", updateError);
        fail("We couldn't save the payment details. Please try again.");
      }

      await logAuditEvent(ctx, {
        action: "payment.initiated",
        targetType: "payment",
        targetId: created.id,
        metadata: {
          reference: created.reference,
          amount: input.amount,
          currency: normalizedCurrency,
          provider: provider.name,
          paymentMethod: selectedMethod.name,
          countryCode: normalizedCountry,
        },
      });

      return {
        paymentId: created.id,
        reference: created.reference,
        amount: input.amount,
        currency: normalizedCurrency,
        countryCode: normalizedCountry,
        symbol: selectedMethod.display_name,
        provider: provider.name,
        paymentMethod: selectedMethod.name,
        status: providerResult.status || "pending",
        paymentUrl: providerResult.paymentUrl || null,
      };
    } catch (error) {


      const providerPayload = {
        amount: input.amount,
        currency: normalizedCurrency,
        reference: created.reference,
        phoneNumber: normalizedPhone ?? null,
        customerEmail: customerEmail ?? null,
        customerName: customerName ?? null,
        callbackUrl: getCallbackUrl(),
        hostedCheckout: useHostedCheckout,
      };

      const errorDetails = error instanceof Error
        ? { message: error.message, status: (error as any).status, body: (error as any).body }
        : error;

      console.error("[payment-orchestrator] payment initialization failed", {
        error: errorDetails,
        requestPayload: providerPayload,
        paymentId: created?.id,
        reference: created?.reference,
      });

      await ctx.supabase.rpc("mark_payment_failed" as never, {
        _id: created.id,
        _failure_reason: error instanceof Error ? error.message : "Initialization failed",
      } as never);


      lastError = error;
      if (error instanceof CurrencyUnavailableError) {
        fail(
          `${normalizedCurrency} checkout isn't live with our payment provider yet. Please pick another currency.`,
        );
      }
      if ((isDuplicateReference(error) || isTransientProviderError(error)) && attempt < 2) {
        if (isTransientProviderError(error)) {
          await new Promise((r) => setTimeout(r, attempt === 0 ? 2000 : 5000));
        }
        continue;
      }
      throw error;
    }
  }

  if (lastError instanceof Error) throw lastError;
  return fail("We couldn't initialize the payment. Please try again.");
}

export async function processWebhook(
  providerName: string,
  rawPayload: string,
  signature: string | null,
): Promise<{ success: boolean; message?: string }> {
  const provider = getProvider(providerName);

  const verification = provider.verifyWebhookSignature(rawPayload, signature);
  if (!verification) {
    return { success: false, message: "Invalid webhook signature." };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawPayload);
  } catch {
    return { success: false, message: "Malformed JSON payload." };
  }

  const reference = (payload as any).reference;
  if (!reference) {
    return { success: false, message: "Missing payment reference." };
  }

  return { success: true };
}

export async function verifyAndCompletePayment(
  ctx: Ctx,
  reference: string,
  providerName: string,
): Promise<{ paymentId: string; status: string; alreadyCompleted: boolean }> {
  const provider = getProvider(providerName);

  const verification = await provider.verifyPayment(reference);

  if (verification.status !== "completed") {
    return { paymentId: "", status: verification.status, alreadyCompleted: false };
  }

  const { data: payment, error: findError } = await ctx.supabase
    .from("payments" as never)
    .select("id, status, amount, currency, wallet_id, organization_id")
    .eq("reference", reference)
    .maybeSingle();

  if (findError || !payment) {
    fail("Payment not found.");
  }

  if ((payment as any).status === "completed") {
    return { paymentId: (payment as any).id, status: "completed", alreadyCompleted: true };
  }

  if (verification.amount !== undefined && Number((payment as any).amount) !== Number(verification.amount)) {
    fail("Payment amount mismatch.");
  }

  if (verification.currency && (payment as any).currency !== verification.currency) {
    fail("Payment currency mismatch.");
  }

  const { data, error } = await ctx.supabase.rpc("complete_payment" as never, {
    _payment_id: (payment as any).id,
    _provider: providerName,
    _provider_reference: verification.providerTransactionId ?? reference,
    _provider_transaction_id: verification.providerTransactionId ?? null,
    _provider_receipt: verification.providerReceipt ?? null,
  } as never);

  if (error) {
    fail("We couldn't complete the payment. Please contact support.");
  }

  const result = Array.isArray(data) ? data[0] : data;
  return { ...(result as any), alreadyCompleted: false };
}
