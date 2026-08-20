/**
 * Server-only OptimaPayBridge integration (M-PESA STK push).
 *
 * Used for KES / M-PESA payments. All other currencies continue to route
 * through PayzaAPI's hosted checkout.
 *
 * Credentials (server-side only):
 *   X_API_KEY                  — X-API-KEY header
 *   X_API_SECRET               — X-API-SECRET header
 *   OPTIMA_PAYMENT_ACCOUNT_ID  — the payment account id from the OptimaPay dashboard
 *   OPTIMA_API_BASE_URL        — optional override (defaults to https://optimapaybridge.co.ke)
 */

import type {
  PaymentProvider,
  PaymentInitializeInput,
  PaymentInitializeResult,
  PaymentVerificationResult,
} from "@/lib/payment-provider.interface";
import { normalizeMpesaPhone, normalizePaymentStatus, getCallbackUrl } from "@/lib/payzaapi.server";
import { readEnv } from "@/lib/runtime-env.server";

const DEFAULT_BASE_URL = "https://optimapaybridge.co.ke";

function getEnv() {
  const apiKey = readEnv("X_API_KEY", "OPTIMA_API_KEY", "X-API-KEY");
  const apiSecret = readEnv("X_API_SECRET", "OPTIMA_API_SECRET", "X-API-SECRET");
  const baseUrl = (readEnv("OPTIMA_API_BASE_URL") ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const paymentAccountId = readEnv("OPTIMA_PAYMENT_ACCOUNT_ID", "OPTIMA_ACCOUNT_ID", "PAYMENT_ACCOUNT_ID");

  if (!apiKey || !apiSecret) {
    const missing = [
      ...(!apiKey ? ["X_API_KEY"] : []),
      ...(!apiSecret ? ["X_API_SECRET"] : []),
    ];
    throw new Error(`Missing OptimaPay environment variable(s): ${missing.join(", ")}`);
  }

  return { apiKey, apiSecret, baseUrl, paymentAccountId };
}

function pick<T = unknown>(source: any, keys: string[]): T | undefined {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && value !== "") return value as T;
  }
  return undefined;
}

async function optimaFetch(endpoint: string, body: Record<string, unknown>): Promise<any> {
  const env = getEnv();
  const url = `${env.baseUrl}/api/v2/${endpoint}.php`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-API-KEY": env.apiKey,
        "X-API-SECRET": env.apiSecret,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Could not reach the M-PESA payment provider. Please try again in a moment.");
  }

  const text = await response.text().catch(() => "");
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!response.ok || json?.success === false) {
    const message =
      pick<string>(json, ["message", "error", "ResultDesc", "detail"]) ??
      text.slice(0, 300) ??
      `HTTP ${response.status}`;
    // 402 means OptimaPay accepted our request shape but its own M-PESA
    // channel rejected the collection (account not enabled / float / Daraja
    // credentials). It is not a caller error, so mark it as "provider
    // unavailable" and let the orchestrator fall back to another provider.
    const unavailable = response.status === 402 || response.status >= 500;
    const error = new Error(
      unavailable
        ? `M-PESA is temporarily unavailable through our provider (${message.trim()}).`
        : `OptimaPay request failed (${response.status}): ${message}`,
    );
    (error as any).status = response.status;
    (error as any).body = text;
    if (unavailable) (error as any).providerUnavailable = true;
    throw error;
  }


  return json ?? {};
}

/** Resolves an M-PESA checkout_request_id from one of our payment references. */
async function resolveCheckoutRequestId(reference: string): Promise<string> {
  if (!/^PAY-/i.test(reference)) return reference;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any)
      .from("payments")
      .select("provider_reference")
      .eq("reference", reference)
      .maybeSingle();
    return (data?.provider_reference as string | undefined) ?? reference;
  } catch {
    return reference;
  }
}

export const optimaPayProvider: PaymentProvider = {
  name: "optimapay",

  async initializePayment(input: PaymentInitializeInput): Promise<PaymentInitializeResult> {
    const env = getEnv();

    if ((input.currency ?? "KES").toUpperCase() !== "KES") {
      throw new Error("OptimaPay only supports KES M-PESA payments.");
    }

    const msisdn = input.phoneNumber ? normalizeMpesaPhone(input.phoneNumber) : null;
    if (!msisdn) {
      throw new Error("A valid Kenyan M-PESA phone number is required (e.g. 0712345678).");
    }
    if (!env.paymentAccountId) {
      throw new Error(
        "M-PESA is not fully configured yet: the OptimaPay payment account id is missing.",
      );
    }

    const json = await optimaFetch("stkpush", {
      payment_account_id: Number(env.paymentAccountId),
      phone: msisdn,
      // M-PESA amounts are whole shillings.
      amount: Math.round(input.amount),
      reference: input.reference,
      description: input.description ?? `Wallet deposit ${input.reference}`,
      callback_url: input.callbackUrl || getCallbackUrl(),
    });

    const data = json?.data ?? json;
    const checkoutRequestId = pick<string>(data, [
      "checkout_request_id",
      "CheckoutRequestID",
      "checkoutRequestId",
      "transaction_id",
      "id",
    ]);

    const result: PaymentInitializeResult = {
      paymentUrl: "",
      reference: pick<string>(data, ["reference", "merchant_reference"]) ?? input.reference,
      status: normalizePaymentStatus(pick(data, ["status", "state"]) ?? "pending"),
    };
    if (checkoutRequestId) result.providerReference = String(checkoutRequestId);
    return result;
  },

  async verifyPayment(reference: string): Promise<PaymentVerificationResult> {
    const checkoutRequestId = await resolveCheckoutRequestId(reference);
    const json = await optimaFetch("status", { checkout_request_id: checkoutRequestId });
    const data = json?.data ?? json;

    const resultCode = pick(data, ["result_code", "ResultCode"]);
    const status = normalizePaymentStatus(
      pick(data, ["status", "state"]) ?? (resultCode !== undefined ? String(resultCode) : undefined),
    );

    const result: PaymentVerificationResult = {
      reference: String(pick(data, ["reference", "merchant_reference"]) ?? reference),
      status,
    };
    const amount = pick(data, ["amount", "Amount"]);
    if (amount !== undefined) result.amount = Number(amount);
    result.currency = "KES";
    const txnId = pick(data, [
      "mpesa_receipt_number",
      "MpesaReceiptNumber",
      "transaction_id",
      "checkout_request_id",
      "CheckoutRequestID",
    ]);
    if (txnId) result.providerTransactionId = String(txnId);
    const receipt = pick(data, ["mpesa_receipt_number", "MpesaReceiptNumber", "receipt"]);
    if (receipt) result.providerReceipt = String(receipt);
    return result;
  },

  /**
   * OptimaPay does not sign webhooks. Authenticity is established by
   * re-verifying the transaction against the status endpoint.
   */
  verifyWebhookSignature(): boolean {
    return true;
  },

  async getPaymentStatus(reference: string): Promise<{ status: string }> {
    const result = await optimaPayProvider.verifyPayment(reference);
    return { status: result.status };
  },
};

export async function verifyOptimaPayment(reference: string): Promise<PaymentVerificationResult> {
  return optimaPayProvider.verifyPayment(reference);
}
