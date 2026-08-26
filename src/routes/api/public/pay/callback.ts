/**
 * POST /api/public/pay/callback
 * GET  /api/public/pay/callback?reference=...&status=...
 *
 * PayzaAPI webhook callback endpoint.
 * Publicly reachable. Every payload is re-verified against the provider
 * before any balance is credited (no webhook secret is used).
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { jsonResponse } from "@/lib/api-response";
import { publicCorsHeaders, publicPreflight } from "@/lib/api-v1.server";
import { normalizePaymentStatus, verifyPayzaPayment } from "@/lib/payzaapi.server";
import {
  completePaymentByReference,
  markPaymentFailed,
} from "@/lib/payment-service.server";
import { logAuditEvent } from "@/lib/audit-log.server";


const callbackSchema = z.object({
  event: z.string().optional(),
  gateway: z.string().optional(),
  reference: z.string().min(1),
  status: z.string().min(1).optional(),
  // Provider callback values can be serialized as JSON strings. This value is
  // never used to credit a wallet; Payza verification remains authoritative.
  amount: z.coerce.number().finite().positive().optional(),
  currency: z.string().optional(),
  provider_transaction_id: z.string().optional(),
  provider_receipt: z.string().optional(),
});

async function getRawBody(request: Request): Promise<string> {
  return request.text();
}

async function processPayzaCallback(reference: string, rawStatus: string | null, source: string) {
  console.log("[PAYMENT_CALLBACK_RECEIVED]", { reference, rawStatus, source });
  const status = normalizePaymentStatus(
    rawStatus ?? undefined,
  );

  if (status === "completed") {
    try {
      let verification;
      try {
        console.log("[PAYZAAPI_VERIFICATION_STARTED]", { reference, source });
        verification = await verifyPayzaPayment(reference);
      } catch {
        console.log("[PAYMENT_PROCESSING_FAILED]", {
          reference,
          source,
          stage: "payza_verification",
        });
        await logAuditEvent(
          { supabase: supabaseAdmin as never, userId: "system" } as never,
          {
            action: "payment.verification_failed",
            targetType: "payment",
            targetId: reference,
            metadata: { reason: "Verification request failed", source },
          },
        );
        return { ok: false as const, error: "verification_failed", message: "Payment verification failed.", status: "failed" };
      }

      console.log("[PAYZAAPI_VERIFICATION_RESULT]", {
        reference,
        source,
        status: verification.status,
        amount: verification.amount,
        currency: verification.currency,
        providerTransactionId: verification.providerTransactionId ?? null,
      });

      if (verification.status !== "completed") {
        console.log("[callback][process] provider verification not completed", {
          reference,
          providerStatus: verification.status,
          source,
        });
        console.log("[payment][completion][RESULT]", {
          reference,
          paymentId: null,
          verifiedAmount: verification.amount,
          verifiedCurrency: verification.currency,
          rpcCalled: false,
          rpcSucceeded: false,
          walletBalance: null,
          reason: `verification_status=${verification.status}`,
        });
        return { ok: true as const, status: verification.status };
      }

      const verifiedAmount = verification.amount as number | undefined;
      const verifiedCurrency = verification.currency as string | undefined;

      console.log("[PAYMENT_VERIFICATION_ACCEPTED]", {
        reference,
        source,
        verifiedAmount,
        verifiedCurrency,
      });

      const result = await (completePaymentByReference as any)(
        { supabase: supabaseAdmin as never, userId: "system" } as never,
        reference,
        verification.providerTransactionId ?? reference,
        verification.providerReceipt ?? null,
        verifiedAmount,
        verifiedCurrency,
      );

      await logAuditEvent(
        { supabase: supabaseAdmin as never, userId: "system" } as never,
        {
          action: "payment.completed",
          targetType: "payment",
          targetId: result.paymentId,
          metadata: {
            reference,
            providerTransactionId: verification.providerTransactionId,
            source,
            alreadyCompleted: result.alreadyCompleted,
          },
        },
      );

      const { data: finalPayment } = await (supabaseAdmin as any)
        .from("payments")
        .select("status, wallet_id")
        .eq("reference", reference)
        .maybeSingle();

      const { data: finalWallet } = await (supabaseAdmin as any)
        .from("wallets")
        .select("balance_amount")
        .eq("id", (finalPayment as any)?.wallet_id)
        .maybeSingle();

      console.log("[payment][final]", {
        reference,
        paymentStatus: (finalPayment as any)?.status,
        walletId: (finalPayment as any)?.wallet_id,
        walletBalance: (finalWallet as any)?.balance_amount,
      });
      console.log("[PAYMENT_PROCESSING_COMMITTED]", {
        reference,
        paymentId: result.paymentId,
        status: "completed",
        source,
      });

      return { ok: true as const, status: "completed", paymentId: result.paymentId };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Payment processing failed";
      console.log("[PAYMENT_PROCESSING_FAILED]", {
        reference,
        source,
        stage: "complete_payment",
        message,
        code: (error as any)?.code ?? null,
      });
      await logAuditEvent(
        { supabase: supabaseAdmin as never, userId: "system" } as never,
        {
          action: "payment.completion_failed",
          targetType: "payment",
          targetId: reference,
          metadata: { reason: message, source },
        },
      );
      return { ok: false as const, error: "completion_failed", message: "Payment processing failed.", status: "failed" };
    }
  }

  if (status === "failed" || status === "cancelled") {
    try {
      let providerStatus: string = status;

      try {
        providerStatus = (await verifyPayzaPayment(reference)).status;
      } catch {
        /* provider unreachable — fall back to the callback status */
      }
      if (providerStatus === "completed") {
        return { ok: true as const, status: "completed" };
      }

      const { data: payment } = await (supabaseAdmin as any)
        .from("payments")
        .select("id")
        .eq("reference", reference)
        .eq("provider", "payzaapi")
        .maybeSingle();

      if (payment?.id) {
        await markPaymentFailed(
          { supabase: supabaseAdmin as never, userId: "system" } as never,
          payment.id as string,
        );
      }

      return { ok: true as const, status };
    } catch {
      return {
        ok: false as const,
        error: "status_update_failed",
        message: "Could not update payment status.",
        status,
      };
    }
  }

  return { ok: true as const, status };
}

export const Route = createFileRoute("/api/public/pay/callback")({
  server: {
    handlers: {
      OPTIONS: async () => publicPreflight("POST, OPTIONS"),

      POST: async ({ request }) => {
        const rawBody = await getRawBody(request);

        let payload: unknown;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return jsonResponse(
            { ok: false, error: "invalid_payload", message: "Malformed JSON payload." },
            400,
          );
        }

        const parsed = callbackSchema.safeParse(payload);
        if (!parsed.success) {
          console.log("[callback][POST] validation failed:", parsed.error.flatten());
          return jsonResponse(
            { ok: false, error: "validation_error", message: "Invalid callback payload." },
            400,
          );
        }

        const data = parsed.data;
        const normalizedCallbackStatus = normalizePaymentStatus(
          data.status ?? (data.event ? data.event.split(".").pop() : undefined),
        );
        const rawStatus = normalizedCallbackStatus === "pending" ? data.status ?? null : normalizedCallbackStatus;
        console.log("[callback][POST] accepted callback", {
          reference: data.reference,
          status: data.status ?? null,
          event: data.event ?? null,
          normalizedStatus: normalizedCallbackStatus,
          rawPayloadLength: rawBody.length,
        });
        console.log("[PAYMENT_REFERENCE_EXTRACTED]", {
          reference: data.reference,
          source: "payzaapi_post_callback",
        });

        const result = await processPayzaCallback(data.reference, rawStatus, "payzaapi_post_callback");
        return jsonResponse(result, result.ok ? 200 : 500, publicCorsHeaders("POST"));
      },

      GET: async ({ request }) => {
        const url = new URL(request.url);
        const reference = url.searchParams.get("reference")?.trim() ?? null;
        const callbackStatus = url.searchParams.get("status")?.trim() ?? null;
        const event = url.searchParams.get("event")?.trim() ?? null;

        console.log("[callback][GET] received callback", { reference, callbackStatus, event });

        if (!reference) {
          return jsonResponse(
            { ok: false, error: "invalid_request", message: "Missing payment reference." },
            400,
          );
        }

        console.log("[PAYMENT_REFERENCE_EXTRACTED]", {
          reference,
          source: "payzaapi_get_callback",
        });

        const status = normalizePaymentStatus(
          callbackStatus ?? (event ? event.split(".").pop() : undefined),
        );

        const result = await processPayzaCallback(reference, status === "pending" ? callbackStatus : status, "payzaapi_get_callback");

        const confirmUrl = new URL("/payment/confirm", url.origin);
        confirmUrl.searchParams.set("reference", reference);

        if (!result.ok) {
          console.log("[callback][GET] processing failed:", result);
          return Response.redirect(confirmUrl, 303);
        }

        console.log("[callback][GET] processing result:", result);
        return Response.redirect(confirmUrl, 303);
      },
    },
  },
});
