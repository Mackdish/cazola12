/**
 * GET /api/v1/wallet/currencies
 *
 * Returns supported currencies.
 */
import { createFileRoute } from "@tanstack/react-router";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { authenticateRequest } from "@/lib/api-auth.server";
import { jsonResponse, serverError } from "@/lib/api-response";
import { corsHeaders, preflight } from "@/lib/api-v1.server";
import { getSupportedCurrencies } from "@/lib/payment-config.server";

export const Route = createFileRoute("/api/v1/wallet/currencies")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) =>
        preflight("GET, OPTIONS", request.headers.get("origin")),

      GET: async ({ request }) => {
        const authResult = await authenticateRequest(request);
        if (!authResult.authenticated) return authResult.response!;

        try {
          const currencies = await getSupportedCurrencies(supabaseAdmin as never);
          return jsonResponse({ ok: true, data: currencies }, 200, corsHeaders("GET", request.headers.get("origin")));
        } catch {
          return serverError("We couldn't load supported currencies.");
        }
      },
    },
  },
});
