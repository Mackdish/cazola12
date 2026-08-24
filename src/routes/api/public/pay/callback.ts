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
  amount: z.number().optional(),
  currency: z.string().optional(),
  provider_transaction_id: z.string().optional(),
  provider_receipt: z.string().optional(),
});

async function getRawBody(request: Request): Promise<string> {
  return request.text();
}

async function processPayzaCallback(reference: string, rawStatus: string | null, source: string) {
  const status = normalizePaymentStatus(
    rawStatus ?? undefined,
  );

  if (status === "completed") {
    try {
      let verification;
      try {
        verification = await verifyPayzaPayment(reference);
      } catch {
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

      if (verification.status !== "completed") {
        return { ok: true as const, status: verification.status };
      }

      const verifiedAmount = verification.amount as number | undefined;
      const verifiedCurrency = verification.currency as string | undefined;

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

      return { ok: true as const, status: "completed", paymentId: result.paymentId };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Payment processing failed";
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

        console.log("[callback][POST] raw body:", rawBody);

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
        console.log("[callback][POST] parsed data:", data);

        const result = await processPayzaCallback(data.reference, data.status ?? null, "payzaapi_post_callback");
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
