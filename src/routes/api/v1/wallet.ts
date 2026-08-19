/**
 * GET /api/v1/wallet
 *
 * Returns wallet(s) for an organization.
 * Multi-currency support.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { authenticateRequest } from "@/lib/api-auth.server";
import { assertAdvertiserAccess } from "@/lib/api-authorization.server";
import { jsonResponse, serverError } from "@/lib/api-response";
import { corsHeaders, preflight } from "@/lib/api-v1.server";
import { getWallet, getWallets } from "@/lib/billing-service.server";

export const Route = createFileRoute("/api/v1/wallet")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) =>
        preflight("GET, OPTIONS", request.headers.get("origin")),

      GET: async ({ request }) => {
        const authResult = await authenticateRequest(request);
        if (!authResult.authenticated) return authResult.response!;

        const url = new URL(request.url);
        const organizationId = url.searchParams.get("organizationId");
        const currency = url.searchParams.get("currency");

        if (!organizationId || !z.string().uuid().safeParse(organizationId).success) {
          return jsonResponse(
            { ok: false, error: "invalid_request", message: "Valid organizationId is required" },
            400,
          );
        }

        const access = await assertAdvertiserAccess(
          authResult.context.userId,
          organizationId,
          authResult.context.authMethod,
        );
        if (!access.allowed) return access.response!;

        try {
          if (currency) {
            const wallet = await getWallet(
              { supabase: supabaseAdmin as never, userId: authResult.context.userId } as never,
              organizationId,
              currency,
            );
            return jsonResponse({ ok: true, data: wallet }, 200, corsHeaders("GET", request.headers.get("origin")));
          }

          const wallets = await getWallets(
            { supabase: supabaseAdmin as never, userId: authResult.context.userId } as never,
            organizationId,
          );
          return jsonResponse({ ok: true, data: wallets }, 200, corsHeaders("GET", request.headers.get("origin")));
        } catch {
          return serverError("We couldn't load your wallets.");
        }
      },
    },
  },
});
