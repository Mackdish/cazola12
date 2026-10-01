/**
 * GET /ad/loader.js — the publisher embed SDK.
 *
 * Served as plain text from a string constant so no application code is
 * bundled into it. Cached at the edge for five minutes.
 */
import { createFileRoute } from "@tanstack/react-router";
import { AD_SDK_SOURCE } from "@/lib/ad-sdk-source";
import { resolveAdServerOrigin } from "@/lib/publisher-service.server";

export const Route = createFileRoute("/ad/loader.js")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const requestUrl = new URL(request.url);
        // The loader and all public ad APIs live on the main TradeMall origin.
        // Keep the generated SDK callbacks on that canonical origin.
        const origin = resolveAdServerOrigin(requestUrl.href);
        const allowedOrigin = requestUrl.origin;
        const apiOrigin = origin;
        const body = AD_SDK_SOURCE
          .replace("__ORIGIN__", origin)
          .replace("__API_ORIGIN__", apiOrigin);

        return new Response(body, {
          status: 200,
          headers: {
            "Content-Type": "application/javascript; charset=utf-8",
            "Cache-Control": "public, max-age=300",
            "Access-Control-Allow-Origin": allowedOrigin,
            "X-Content-Type-Options": "nosniff",
          },
        });
      },
    },
  },
});
