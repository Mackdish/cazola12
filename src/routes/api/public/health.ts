/**
 * GET /api/public/health — unauthenticated liveness probe for the ad API.
 * Returns no PII and no configuration details.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }),

      GET: async () =>
        new Response(JSON.stringify({ ok: true, status: "healthy", time: new Date().toISOString() }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
            "Access-Control-Allow-Origin": "*",
          },
        }),
    },
  },
});
