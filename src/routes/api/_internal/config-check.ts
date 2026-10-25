/**
 * GET /api/_internal/config-check
 *
 * Lightweight health/config probe. Returns booleans for required server-side
 * environment variables (never echoes actual secret values).
 *
 * In production, protect this endpoint via Cloudflare Access, a service token,
 * or restrict it to internal IPs. It is intentionally unauthenticated here so
 * you can hit it from `wrangler dev` without extra setup.
 */

import { createFileRoute } from "@tanstack/react-router";

import { tokenSecretStatus } from "@/lib/ad-token.server";
import { readEnv } from "@/lib/runtime-env.server";

export const Route = createFileRoute("/api/_internal/config-check")({
  server: {
    handlers: {
      GET: async () => {
        // AD_TOKEN_SECRET must be present AND at least 32 chars, otherwise ad
        // serving fails after the winning ad is picked. Report that exact state.
        const adTokenStatus = tokenSecretStatus();
        const checks = {
          API_KEY_PEPPER: Boolean(readEnv("API_KEY_PEPPER")),
          AD_TOKEN_SECRET: adTokenStatus === "ok",
          PAYZA_SECRET_KEY: Boolean(readEnv("PAYZA_SECRET_KEY")),
          SUPABASE_SERVICE_ROLE_KEY: Boolean(
            readEnv("SUPABASE_SERVICE_ROLE_KEY", "EXTERNAL_SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY"),
          ),
        };

        const missing = Object.entries(checks)
          .filter(([, present]) => !present)
          .map(([name]) => name);

        return new Response(
          JSON.stringify({
            ok: missing.length === 0,
            checks,
            missing,
            details: { AD_TOKEN_SECRET: adTokenStatus },
          }),
          {
            status: missing.length === 0 ? 200 : 503,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            },
          },
        );
      },
    },
  },
});
