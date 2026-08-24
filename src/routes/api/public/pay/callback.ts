/**
 * POST /api/public/pay/callback
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
  amount: z.number().optional(),
  currency: z.string().optional(),
  provider_transaction_id: z.string().optional(),
  provider_receipt: z.string().optional(),
});

async function getRawBody(request: Request): Promise<string> {
  return request.text();
}

export const Route = createFileRoute("/api/public/pay/callback")({
  server: {
    handlers: {
      OPTIONS: async () => publicPreflight("POST, OPTIONS"),

      POST: async ({ request }) => {
        // PayzaAPI does not sign webhooks. Every payload is re-verified
        // server-side against /api/v1/verify/{reference} before we act on it.
        const rawBody = await getRawBody(request);

        console.log("[callback] raw body:", rawBody);

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
          console.log("[callback] validation failed:", parsed.error.flatten());
          return jsonResponse(
            { ok: false, error: "validation_error", message: "Invalid callback payload." },
            400,
          );
        }

        const data = parsed.data;
        console.log("[callback] parsed data:", data);
        // Hosted multi-currency checkout sends `event: "payment.success"`;
        // the M-PESA flow sends `status`. Both map to the same statuses.
        const status = normalizePaymentStatus(
          data.status ?? (data.event ? data.event.split(".").pop() : undefined),
        );

        if (status === "completed") {

          try {
            let verification;
            try {
              verification = await verifyPayzaPayment(data.reference);
            } catch {
              await logAuditEvent(
                { supabase: supabaseAdmin as never, userId: "system" } as never,
                {
                  action: "payment.verification_failed",
                  targetType: "payment",
                  targetId: data.reference,
                  metadata: { reason: "Verification request failed" },
                },
              );
              return jsonResponse(
                { ok: false, error: "verification_failed", message: "Payment verification failed." },
                500,
              );
            }

            if (verification.status !== "completed") {
              return jsonResponse(
                { ok: true, status: verification.status },
                200,
                publicCorsHeaders("POST"),
              );
            }

            const verifiedAmount = verification.amount as number | undefined;
            const verifiedCurrency = verification.currency as string | undefined;

            const result = await (completePaymentByReference as any)(
              { supabase: supabaseAdmin as never, userId: "system" } as never,
              data.reference,
              verification.providerTransactionId ?? data.reference,
              verification.providerReceipt ?? data.provider_receipt,
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
                  reference: data.reference,
                  amount: data.amount,
                  currency: data.currency,
                  gateway: data.gateway,
                  providerTransactionId: verification.providerTransactionId,
                  alreadyCompleted: result.alreadyCompleted,
                },
              },
            );

            return jsonResponse(
              { ok: true, status: "completed", paymentId: result.paymentId },
              200,
              publicCorsHeaders("POST"),
            );
          } catch (error) {
            const message = error instanceof Error ? error.message : "Payment processing failed";
            await logAuditEvent(
              { supabase: supabaseAdmin as never, userId: "system" } as never,
              {
                action: "payment.completion_failed",
                targetType: "payment",
                targetId: data.reference,
                metadata: { reason: message },
              },
            );
            return jsonResponse(
              { ok: false, error: "completion_failed", message: "Payment processing failed." },
              500,
            );
          }
        }

        if (status === "failed" || status === "cancelled") {
          try {
            let providerStatus: string = status;

            try {
              providerStatus = (await verifyPayzaPayment(data.reference)).status;
            } catch {
              /* provider unreachable — fall back to the webhook status */
            }
            if (providerStatus === "completed") {
              return jsonResponse({ ok: true, status: "completed" }, 200, publicCorsHeaders("POST"));
            }

            const { data: payment } = await (supabaseAdmin as any)
              .from("payments")
              .select("id")
              .eq("reference", data.reference)
              .eq("provider", "payzaapi")
              .maybeSingle();

            if (payment?.id) {
              await markPaymentFailed(
                { supabase: supabaseAdmin as never, userId: "system" } as never,
                payment.id as string,
              );
            }


            return jsonResponse({ ok: true, status }, 200, publicCorsHeaders("POST"));
          } catch {
            return jsonResponse(
              { ok: false, error: "status_update_failed", message: "Could not update payment status." },
              500,
            );
          }
        }

        return jsonResponse({ ok: true, status }, 200, publicCorsHeaders("POST"));
      },
    },
  },
});
