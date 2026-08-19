/**
 * GET /ad/loader.js — the publisher embed SDK.
 *
 * Served as plain text from a string constant so no application code is
 * bundled into it. Cached at the edge for five minutes.
 */
import { createFileRoute } from "@tanstack/react-router";
import { AD_SDK_SOURCE } from "@/lib/ad-sdk-source";

export const Route = createFileRoute("/ad/loader.js")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const requestUrl = new URL(request.url);
        const configuredOrigin = process.env["PUBLIC_SITE_ORIGIN"] ?? process.env["SITE_URL"];
        const allowedOrigin =
          configuredOrigin && /^https?:\/\//.test(configuredOrigin)
            ? configuredOrigin.replace(/\/+$/, "")
            : requestUrl.origin;

        const origin = requestUrl.origin;
        const apiOrigin = allowedOrigin.replace(/\/+$/, "");
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
