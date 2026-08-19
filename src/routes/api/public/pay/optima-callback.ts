/**
 * POST /api/public/pay/optima-callback
 *
 * OptimaPayBridge (M-PESA) callback endpoint.
 * Publicly reachable. Every payload is re-verified against the provider's
 * status endpoint before any balance is credited.
 */
import { createFileRoute } from "@tanstack/react-router";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { jsonResponse } from "@/lib/api-response";
import { publicCorsHeaders, publicPreflight } from "@/lib/api-v1.server";
import { verifyOptimaPayment } from "@/lib/optimapay.server";
import { completePaymentByReference, markPaymentFailed } from "@/lib/payment-service.server";
import { logAuditEvent } from "@/lib/audit-log.server";

function findReference(payload: any): string | null {
  const stk = payload?.Body?.stkCallback ?? payload?.body?.stkCallback;
  const candidates = [
    payload?.reference,
    payload?.merchant_reference,
    payload?.account_reference,
    payload?.data?.reference,
    payload?.checkout_request_id,
    payload?.CheckoutRequestID,
    payload?.data?.checkout_request_id,
    stk?.CheckoutRequestID,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

const systemCtx = () => ({ supabase: supabaseAdmin as never, userId: "system" }) as never;

export const Route = createFileRoute("/api/public/pay/optima-callback")({
  server: {
    handlers: {
      OPTIONS: async () => publicPreflight("POST, OPTIONS"),

      POST: async ({ request }) => {
        const rawBody = await request.text();

        let payload: any;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return jsonResponse(
            { ok: false, error: "invalid_payload", message: "Malformed JSON payload." },
            400,
          );
        }

        const identifier = findReference(payload);
        if (!identifier) {
          return jsonResponse(
            { ok: false, error: "validation_error", message: "Missing payment reference." },
            400,
          );
        }

        // Resolve our internal reference: the callback may carry either our
        // reference or the provider's checkout_request_id.
        let reference = identifier;
        if (!/^PAY-/i.test(identifier)) {
          const { data: match } = await (supabaseAdmin as any)
            .from("payments")
            .select("reference")
            .eq("provider_reference", identifier)
            .eq("provider", "optimapay")
            .maybeSingle();
          if (match?.reference) reference = match.reference as string;
        }

        let verification;
        try {
          verification = await verifyOptimaPayment(reference);
        } catch {
          await logAuditEvent(systemCtx(), {
            action: "payment.verification_failed",
            targetType: "payment",
            targetId: reference,
            metadata: { reason: "OptimaPay verification request failed" },
          });
          return jsonResponse(
            { ok: false, error: "verification_failed", message: "Payment verification failed." },
            500,
          );
        }

        if (verification.status === "completed") {
          try {
            const result = await (completePaymentByReference as any)(
              systemCtx(),
              reference,
              verification.providerTransactionId ?? reference,
              verification.providerTransactionId,
              verification.providerReceipt,
              verification.amount,
              verification.currency,
            );

            await logAuditEvent(systemCtx(), {
              action: "payment.completed",
              targetType: "payment",
              targetId: result.paymentId,
              metadata: {
                reference,
                provider: "optimapay",
                amount: verification.amount,
                currency: verification.currency,
                providerTransactionId: verification.providerTransactionId,
                alreadyCompleted: result.alreadyCompleted,
              },
            });

            return jsonResponse(
              { ok: true, status: "completed", paymentId: result.paymentId },
              200,
              publicCorsHeaders("POST"),
            );
          } catch {
            return jsonResponse(
              { ok: false, error: "completion_failed", message: "Payment processing failed." },
              500,
            );
          }
        }

        if (verification.status === "failed" || verification.status === "cancelled") {
          const { data: payment } = await (supabaseAdmin as any)
            .from("payments")
            .select("id")
            .eq("reference", reference)
            .eq("provider", "optimapay")
            .maybeSingle();

          if (payment?.id) {
            await markPaymentFailed(systemCtx(), payment.id as string);
          }
        }

        return jsonResponse(
          { ok: true, status: verification.status },
          200,
          publicCorsHeaders("POST"),
        );
      },
    },
  },
});
