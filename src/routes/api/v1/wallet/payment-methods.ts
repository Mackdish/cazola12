/**
 * GET /api/v1/wallet/payment-methods
 *
 * Returns available payment methods for a country/currency.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { authenticateRequest } from "@/lib/api-auth.server";
import { jsonResponse, serverError } from "@/lib/api-response";
import { corsHeaders, preflight } from "@/lib/api-v1.server";
import { getActivePaymentMethods } from "@/lib/payment-config.server";

export const Route = createFileRoute("/api/v1/wallet/payment-methods")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) =>
        preflight("GET, OPTIONS", request.headers.get("origin")),

      GET: async ({ request }) => {
        const authResult = await authenticateRequest(request);
        if (!authResult.authenticated) return authResult.response!;

        const url = new URL(request.url);
        const countryCode = url.searchParams.get("countryCode");
        const currencyCode = url.searchParams.get("currencyCode");

        if (!countryCode || !currencyCode) {
          return jsonResponse(
            { ok: false, error: "invalid_request", message: "countryCode and currencyCode are required" },
            400,
          );
        }

        try {
          const methods = await getActivePaymentMethods(
            supabaseAdmin as never,
            countryCode,
            currencyCode,
          );
          return jsonResponse({ ok: true, data: methods }, 200, corsHeaders("GET", request.headers.get("origin")));
        } catch {
          return serverError("We couldn't load payment methods.");
        }
      },
    },
  },
});
