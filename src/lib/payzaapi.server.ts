/**
 * Server-only PayzaAPI integration (M-PESA STK push + hosted checkout).
 *
 * Implements the standard PaymentProvider interface.
 * Only two credentials are required, both server-side only:
 *   PAYZA_PUBLIC_KEY  — X-Public-Key header
 *   PAYZA_SECRET_KEY  — X-Secret-Key header
 * Webhooks are authenticated by re-verifying the reference against
 * GET /api/v1/verify/{reference} rather than an HMAC secret.
 */

import type {
  PaymentProvider,
  PaymentInitializeInput,
  PaymentInitializeResult,
  PaymentVerificationResult,
} from "@/lib/payment-provider.interface";
import { readEnv } from "@/lib/runtime-env.server";

const DEFAULT_BASE_URL = "https://payzaapi.co.ke";
const DEFAULT_APP_URL = "https://trademall.co.ke";

export function getAppBaseUrl(): string {
  return (readEnv("APP_BASE_URL") ?? DEFAULT_APP_URL).replace(/\/+$/, "");
}

export function getCallbackUrl(): string {
  const explicit = readEnv("PAYZA_CALLBACK_URL");
  if (explicit) return explicit;
  return `${getAppBaseUrl()}/api/public/pay/callback`;
}

/** Error thrown when the provider does not (yet) support the requested currency. */
export class CurrencyUnavailableError extends Error {}

/** Error thrown when a phone number is not a Safaricom number but STK push is requested. */
export class SafaricomNumberError extends Error {}

const SAFARICOM_PREFIXES = new Set([
  "701",
  "702",
  "703",
  "704",
  "705",
  "706",
  "707",
  "708",
  "709",
  "710",
  "711",
  "712",
  "713",
  "714",
  "715",
  "716",
  "717",
  "718",
  "719",
  "720",
  "721",
  "722",
  "723",
  "724",
  "725",
  "726",
  "727",
  "728",
  "729",
  "740",
  "741",
  "742",
  "743",
  "746",
  "748",
  "790",
  "791",
  "792",
  "793",
  "794",
  "795",
  "796",
  "797",
  "798",
  "799",
  "110",
  "111",
  "112",
  "113",
  "114",
  "115",
  "118",
  "119",
  "140",
  "141",
  "142",
  "143",
  "180",
  "181",
  "182",
]);

function isSafaricomNumber(msisdn: string): boolean {
  if (!/^254\d{9}$/.test(msisdn)) return false;
  const prefix = msisdn.slice(3, 6);
  return SAFARICOM_PREFIXES.has(prefix);
}

function getEnv() {
  const publicKey = readEnv("PAYZA_PUBLIC_KEY", "PAYZA_PUBLIC", "X_PUBLIC_KEY");
  const secretKey = readEnv("PAYZA_SECRET_KEY", "PAYZA_SECRET", "X_SECRET_KEY");
  const baseUrl = readEnv("PAYZA_API_BASE_URL") ?? DEFAULT_BASE_URL;

  if (!publicKey || !secretKey) {
    const missing = [
      ...(!publicKey ? ["PAYZA_PUBLIC_KEY"] : []),
      ...(!secretKey ? ["PAYZA_SECRET_KEY"] : []),
    ];
    throw new Error(`Missing PayzaAPI environment variable(s): ${missing.join(", ")}`);
  }

  return {
    publicKey,
    secretKey,
    baseUrl: baseUrl.replace(/\/+$/, ""),
    callbackUrl: getCallbackUrl(),
  };
}

/** Normalizes a Kenyan MSISDN to the 2547XXXXXXXX / 2541XXXXXXXX form M-PESA requires. */
export function normalizeMpesaPhone(raw: string): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  let msisdn = digits;
  if (msisdn.startsWith("0")) msisdn = `254${msisdn.slice(1)}`;
  else if (msisdn.startsWith("7") || msisdn.startsWith("1")) msisdn = `254${msisdn}`;
  else if (msisdn.startsWith("2540")) msisdn = `254${msisdn.slice(4)}`;
  if (!/^254(7|1)\d{8}$/.test(msisdn)) return null;
  return msisdn;
}

/** Maps any provider status string onto our canonical payment statuses. */
export function normalizePaymentStatus(
  raw: unknown,
): "completed" | "failed" | "cancelled" | "pending" {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (
    ["completed", "complete", "success", "successful", "paid", "confirmed", "0"].includes(value)
  ) {
    return "completed";
  }
  if (
    [
      "failed",
      "failure",
      "error",
      "declined",
      "rejected",
      "insufficient_funds",
      "timeout",
      "expired",
    ].includes(value)
  ) {
    return "failed";
  }
  if (["cancelled", "canceled", "user_cancelled", "aborted"].includes(value)) {
    return "cancelled";
  }
  return "pending";
}

function pick<T = unknown>(source: any, keys: string[]): T | undefined {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && value !== "") return value as T;
  }
  return undefined;
}

const VERIFICATION_ERROR_STATUSES = new Set([
  "authentication_failed",
  "provider_forbidden",
  "payment_not_found",
  "rate_limited",
  "provider_unavailable",
  "provider_request_error",
  "verification_failed",
]);

function isVerificationErrorStatus(status: string): boolean {
  return VERIFICATION_ERROR_STATUSES.has(status);
}

function mapHttpStatusToVerificationStatus(status: number): string {
  if (status === 401) return "authentication_failed";
  if (status === 403) return "provider_forbidden";
  if (status === 404) return "payment_not_found";
  if (status === 429) return "rate_limited";
  if (status === 502 || status === 503 || status === 504) return "provider_unavailable";
  return "provider_request_error";
}

async function payzaVerifyFetch(
  path: string,
): Promise<{ status: number; json: any; text: string }> {
  const env = getEnv();
  const url = `${env.baseUrl}${path}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Public-Key": env.publicKey,
    "X-Secret-Key": env.secretKey,
  };

  let response: Response | null = null;
  let text = "";

  const maxAttempts = 3;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, attempt * 1200));

    try {
      response = await fetch(url, {
        method: "GET",
        headers,
      });
    } catch (error) {
      if (attempt === maxAttempts - 1) {
        throw new Error(
          `Could not reach the payment provider at ${env.baseUrl}. Please try again in a moment.`,
        );
      }
      continue;
    }

    text = await response.text().catch(() => "");
    if (response.ok || ![502, 503, 504].includes(response.status)) break;
  }

  if (!response) {
    throw new Error(`Could not reach the payment provider at ${env.baseUrl}.`);
  }

  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return { status: response.status, json, text };
}

async function payzaFetch(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown },
): Promise<any> {
  const env = getEnv();
  const rawBody = init.body === undefined ? undefined : JSON.stringify(init.body);

  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Public-Key": env.publicKey,
    "X-Secret-Key": env.secretKey,
  };
  if (rawBody !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const url = `${env.baseUrl}${path}`;

  console.log("[payza][request]", {
    method: init.method,
    url,
    hasPublicKey: Boolean(env.publicKey),
    hasSecretKey: Boolean(env.secretKey),
    headerKeys: Object.keys(headers),
  });

  let response: Response | null = null;
  let text = "";

  const maxAttempts = init.method === "GET" ? 3 : 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, attempt * 1200));

    try {
      response = await fetch(url, {
        method: init.method,
        headers,
        ...(rawBody !== undefined ? { body: rawBody } : {}),
      });
    } catch (error) {
      if (attempt === maxAttempts - 1) {
        throw new Error(
          `Could not reach the payment provider at ${env.baseUrl}. Please try again in a moment.`,
        );
      }
      continue;
    }

    text = await response.text().catch(() => "");
    if (response.ok || ![502, 503, 504].includes(response.status)) break;
  }

  if (!response) {
    throw new Error(`Could not reach the payment provider at ${env.baseUrl}.`);
  }

  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  console.log("[payza][response]", {
    url,
    status: response.status,
    success: json?.success,
    message: json?.message,
    hasData: Boolean(json?.data),
    dataStatus: json?.data?.status,
  });

  if (!response.ok) {
    const status = response.status;
    let message: string;

    if (status >= 520 || /error code: 1\d{3}/i.test(text)) {
      message =
        `PayzaAPI endpoint ${env.baseUrl} is unreachable (HTTP ${status}). ` +
        `Set PAYZA_API_BASE_URL to the API base URL from your PayzaAPI dashboard.`;
    } else if ([502, 503, 504].includes(status)) {
      message =
        `The payment provider is temporarily unavailable (HTTP ${status}). ` +
        `This is on PayzaAPI's side — please try again in a few moments.`;
    } else {
      message =
        pick<string>(json, ["message", "error", "error_message", "detail"]) ??
        text.slice(0, 300) ??
        `HTTP ${status}`;
      if (
        status === 400 &&
        /coming soon|not (yet )?(live|supported|available|enabled)|unsupported currency|currency/i.test(
          message,
        )
      ) {
        message =
          "This currency isn't live on our payment provider yet. Please choose another currency.";
      }
      message = `PayzaAPI request failed (${status}): ${message}`;
    }

    const error = new Error(message);
    (error as any).status = status;
    (error as any).body = text;
    throw error;
  }

  return json ?? {};
}

export const payzaApiProvider: PaymentProvider = {
  name: "payzaapi",

  /**
   * Triggers an M-PESA STK push. There is no redirect URL: the customer
   * approves the prompt on their handset and PayzaAPI posts the result to our
   * public callback endpoint.
   */
  async initializePayment(input: PaymentInitializeInput): Promise<PaymentInitializeResult> {
    const env = getEnv();

    const callbackUrl =
      input.callbackUrl && input.callbackUrl.startsWith("http")
        ? input.callbackUrl
        : env.callbackUrl;

    // The provider rejects blank/invalid emails with a 400.
    const emailValid = (v?: string) => !!v && /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(v);
    const customerEmail = emailValid(input.customerEmail)
      ? (input.customerEmail as string)
      : `billing+${input.reference.toLowerCase()}@trademall.co.ke`;
    const customerName = input.customerName?.trim() || "TradeMall Customer";

    let body: Record<string, unknown>;

    if (input.hostedCheckout) {
      // Multi-currency hosted checkout: no STK push, the customer completes
      // payment on PayzaAPI's page and is redirected back to us.
      const appBase = getAppBaseUrl();
      const encoded = encodeURIComponent(input.reference);
      body = {
        amount: input.amount,
        currency: input.currency,
        reference: input.reference,
        customer: {
          email: customerEmail,
          name: customerName,
          ...(input.phoneNumber ? { phone: input.phoneNumber } : {}),
        },
        callback_url: callbackUrl,
        redirect_url: input.redirectUrl ?? `${appBase}/payment/confirm?reference=${encoded}`,
        cancel_url: input.cancelUrl ?? `${appBase}/advertiser/wallet`,
      };
    } else {
      const msisdn = input.phoneNumber ? normalizeMpesaPhone(input.phoneNumber) : null;
      if (!msisdn) {
        throw new Error("A valid Kenyan M-PESA phone number is required (e.g. 0712345678).");
      }
      if (!isSafaricomNumber(msisdn)) {
        throw new SafaricomNumberError(
          "M-PESA STK push is only available for Safaricom numbers. " +
            "Please use a Safaricom line (e.g. 0712345678 or 254712345678) " +
            "or choose hosted checkout instead.",
        );
      }
      body = {
        // M-PESA STK push amounts are whole shillings.
        amount: Math.round(input.amount),
        currency: input.currency,
        reference: input.reference,
        customer: {
          email: customerEmail,
          name: customerName,
          phone: msisdn,
        },
        callback_url: callbackUrl,
      };
    }

    const json = await payzaFetch("/api/v1/pay", { method: "POST", body });

    const data = json?.data ?? json;

    const reference =
      pick<string>(data, ["reference", "merchant_reference", "account_reference"]) ??
      input.reference;
    const providerReference = pick<string>(data, [
      "providerReference",
      "provider_reference",
      "checkout_request_id",
      "CheckoutRequestID",
      "transaction_id",
      "id",
    ]);
    const paymentUrl = pick<string>(data, ["paymentUrl", "payment_url", "redirect_url"]) ?? "";

    const result: PaymentInitializeResult = {
      paymentUrl,
      reference,
      status: normalizePaymentStatus(pick(data, ["status", "state"]) ?? "pending"),
    };
    if (providerReference) result.providerReference = String(providerReference);
    return result;
  },

  async verifyPayment(reference: string): Promise<PaymentVerificationResult> {
    const encoded = encodeURIComponent(reference);
    const { status: httpStatus, json } = await payzaVerifyFetch(`/api/v1/verify/${encoded}`);

    const httpStatusNum = Number(httpStatus);

    if (httpStatusNum === 401) {
      console.log("[payza][verify] authentication_failed", {
        reference,
        httpStatus: httpStatusNum,
      });
      return { reference, status: "authentication_failed" };
    }
    if (httpStatusNum === 403) {
      console.log("[payza][verify] provider_forbidden", { reference, httpStatus: httpStatusNum });
      return { reference, status: "provider_forbidden" };
    }
    if (httpStatusNum === 404) {
      console.log("[payza][verify] payment_not_found", { reference, httpStatus: httpStatusNum });
      return { reference, status: "payment_not_found" };
    }
    if (httpStatusNum === 429) {
      console.log("[payza][verify] rate_limited", { reference, httpStatus: httpStatusNum });
      return { reference, status: "rate_limited" };
    }
    if ([502, 503, 504].includes(httpStatusNum)) {
      console.log("[payza][verify] provider_unavailable", { reference, httpStatus: httpStatusNum });
      return { reference, status: "provider_unavailable" };
    }
    if (!Number.isFinite(httpStatusNum) || httpStatusNum < 200 || httpStatusNum >= 500) {
      console.log("[payza][verify] provider_request_error", {
        reference,
        httpStatus: httpStatusNum,
      });
      return { reference, status: "provider_request_error" };
    }

    if (httpStatusNum >= 400 && httpStatusNum < 500) {
      console.log("[payza][verify] provider_request_error", {
        reference,
        httpStatus: httpStatusNum,
      });
      return { reference, status: "provider_request_error" };
    }

    const success = json?.success;
    const data = json?.data ?? json;

    if (success === false) {
      const reason =
        pick<string>(json, ["message", "error", "error_message", "detail"]) ??
        "Provider returned failure";
      console.log("[payza][verify] verification_failed", {
        reference,
        httpStatus: httpStatusNum,
        success,
        reason,
      });
      return {
        reference,
        status: "verification_failed",
        providerTransactionId: pick<string>(data, [
          "provider_transaction_id",
          "transaction_id",
          "id",
        ]),
      };
    }

    const statusRaw = pick(data, [
      "status",
      "state",
      "result_code",
      "ResultCode",
      "payment_status",
      "transaction_status",
      "result",
    ]);
    const amount = pick(data, ["amount", "Amount"]);
    const result: PaymentVerificationResult = {
      reference: String(
        pick(data, ["reference", "merchant_reference", "account_reference"]) ?? reference,
      ),
      status: normalizePaymentStatus(statusRaw),
    };
    if (amount !== undefined) result.amount = Number(amount);
    const currency = pick<string>(data, ["currency"]);
    if (currency) result.currency = String(currency).toUpperCase();
    const txnId = pick<string>(data, [
      "providerTransactionId",
      "provider_transaction_id",
      "mpesa_receipt_number",
      "MpesaReceiptNumber",
      "transaction_id",
      "checkout_request_id",
    ]);
    if (txnId) result.providerTransactionId = String(txnId);
    const receipt = pick<string>(data, [
      "providerReceipt",
      "receipt",
      "mpesa_receipt_number",
      "MpesaReceiptNumber",
    ]);
    if (receipt) result.providerReceipt = String(receipt);

    console.log("[payza][verify] normalized", {
      reference,
      httpStatus: httpStatusNum,
      success,
      providerStatus: statusRaw,
      normalizedStatus: result.status,
      amount: result.amount,
      currency: result.currency,
    });

    return result;
  },

  /**
   * PayzaAPI does not sign webhooks. Authenticity is established by
   * re-verifying the reference server-side against /api/v1/verify.
   */
  verifyWebhookSignature(): boolean {
    return true;
  },

  async getPaymentStatus(reference: string): Promise<{ status: string }> {
    const result = await payzaApiProvider.verifyPayment(reference);
    return { status: result.status };
  },
};

export function maskPhoneNumber(phone: string): string {
  if (phone.length <= 4) return "****";
  return phone.slice(0, 3) + "****" + phone.slice(-4);
}

export async function verifyPayzaPayment(reference: string): Promise<PaymentVerificationResult> {
  const publicKeyConfigured = Boolean(readEnv("PAYZA_PUBLIC_KEY", "PAYZA_PUBLIC", "X_PUBLIC_KEY"));
  const secretKeyConfigured = Boolean(readEnv("PAYZA_SECRET_KEY", "PAYZA_SECRET", "X_SECRET_KEY"));
  const baseUrlConfigured = Boolean(readEnv("PAYZA_API_BASE_URL"));
  const verifyUrl = `${(readEnv("PAYZA_API_BASE_URL") ?? DEFAULT_BASE_URL).replace(/\/+$/, "")}/api/v1/verify/${encodeURIComponent(reference)}`;

  console.log("[payza][verify] config check", {
    reference,
    publicKeyConfigured,
    secretKeyConfigured,
    baseUrlConfigured,
    verifyUrl,
  });

  try {
    const result = await payzaApiProvider.verifyPayment(reference);
    return result;
  } catch (error) {
    console.log("[payza][verify] provider error", {
      reference,
      error: error instanceof Error ? error.message : String(error),
      status: (error as any)?.status,
    });
    throw error;
  }
}

export function verifyPayzaWebhookSignature(payload: string, signature: string | null): boolean {
  return payzaApiProvider.verifyWebhookSignature(payload, signature);
}
