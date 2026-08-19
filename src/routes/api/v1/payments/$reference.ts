/**
 * GET /api/v1/payments/:reference
 *
 * Returns the status of a payment by reference.
 * Authenticated users can only view their own payments.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { authenticateRequest } from "@/lib/api-auth.server";
import { assertAdvertiserAccess } from "@/lib/api-authorization.server";
import { jsonResponse, validationError, serverError } from "@/lib/api-response";
import { corsHeaders, preflight } from "@/lib/api-v1.server";
import { getPaymentStatus } from "@/lib/payment-service.server";

export const Route = createFileRoute("/api/v1/payments/$reference")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) =>
        preflight("GET, OPTIONS", request.headers.get("origin")),

      GET: async ({ request, params }) => {
        const authResult = await authenticateRequest(request);
        if (!authResult.authenticated) return authResult.response!;

        const reference = params.reference;
        if (!reference || !z.string().min(1).safeParse(reference).success) {
          return jsonResponse(
            { ok: false, error: "invalid_request", message: "Valid payment reference is required" },
            400,
          );
        }

        try {
          const status = await getPaymentStatus(
            { supabase: supabaseAdmin as never, userId: authResult.context.userId } as never,
            reference,
          );

          const { data: payment } = await (supabaseAdmin as any)
            .from("payments")
            .select("organization_id")
            .eq("reference", reference)
            .maybeSingle();

          if (payment?.organization_id) {
            const access = await assertAdvertiserAccess(
              authResult.context.userId,
              payment.organization_id,
              authResult.context.authMethod,
            );
            if (!access.allowed) return access.response!;
          }

          return jsonResponse({ ok: true, data: status }, 200, corsHeaders("GET", request.headers.get("origin")));
        } catch {
          return serverError("We couldn't load the payment status.");
        }
      },
    },
  },
});
