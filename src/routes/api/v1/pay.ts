/**
 * POST /api/v1/pay
 *
 * Initializes a payment for wallet deposit.
 * Authenticated advertisers only.
 * Supports multi-currency, multi-country payments.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { authenticateRequest } from "@/lib/api-auth.server";
import { assertAdvertiserAccess } from "@/lib/api-authorization.server";
import { jsonResponse, validationError, serverError } from "@/lib/api-response";
import { corsHeaders, preflight } from "@/lib/api-v1.server";
import {
  initializePayment,
  PaymentError,
} from "@/lib/payment-service.server";
import { checkRateLimit, getRateLimitConfig, extractIpAddress } from "@/lib/rate-limit.server";

const paySchema = z.object({
  organizationId: z.string().uuid(),
  amount: z.number().positive().max(10_000_000),
  countryCode: z.string().length(2),
  currencyCode: z.string().length(3),
  paymentMethodId: z.string().optional(),
  phoneNumber: z.string().trim().min(10).max(15).optional(),
});

export const Route = createFileRoute("/api/v1/pay")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) =>
        preflight("POST, OPTIONS", request.headers.get("origin")),

      POST: async ({ request }) => {
        const authResult = await authenticateRequest(request);
        if (!authResult.authenticated) return authResult.response!;

        const body = await request.json();
        const parsed = paySchema.safeParse(body);
        if (!parsed.success) {
          return validationError(parsed.error.flatten().fieldErrors);
        }

        const ipAddress = extractIpAddress(request);
        try {
          checkRateLimit(
            supabaseAdmin as unknown as Parameters<typeof checkRateLimit>[0],
            getRateLimitConfig("payout"),
            ipAddress,
            authResult.context.userId,
            parsed.data.organizationId,
          );
        } catch {
          return jsonResponse(
            { ok: false, error: "rate_limited", message: "Too many payment requests. Please wait." },
            429,
          );
        }

        const access = await assertAdvertiserAccess(
          authResult.context.userId,
          parsed.data.organizationId,
          authResult.context.authMethod,
        );
        if (!access.allowed) return access.response!;

        try {
          const result = await initializePayment(
            { supabase: supabaseAdmin as never, userId: authResult.context.userId } as never,
            {
              organizationId: parsed.data.organizationId,
              amount: parsed.data.amount,
              countryCode: parsed.data.countryCode,
              currencyCode: parsed.data.currencyCode,
              ...(parsed.data.paymentMethodId ? { paymentMethodId: parsed.data.paymentMethodId } : {}),
              ...(parsed.data.phoneNumber ? { phoneNumber: parsed.data.phoneNumber } : {}),
            },
          );

          return jsonResponse(
            {
              ok: true,
              data: {
                paymentId: result.paymentId,
                reference: result.reference,
                amount: result.amount,
                currency: result.currency,
                countryCode: result.countryCode,
                symbol: result.symbol,
                provider: result.provider,
                paymentMethod: result.paymentMethod,
                status: result.status,
              },
            },
            200,
            corsHeaders("POST", request.headers.get("origin")),
          );
        } catch (error) {
          const message =
            error instanceof PaymentError ? error.message : "We couldn't initialize the payment.";
          return jsonResponse(
            { ok: false, error: "payment_init_failed", message },
            400,
          );
        }
      },
    },
  },
});
