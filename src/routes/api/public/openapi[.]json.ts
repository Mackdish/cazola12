/**
 * GET /api/public/openapi.json — machine-readable description of the v1 API.
 */
import { createFileRoute } from "@tanstack/react-router";

const json = (path: string, methods: Record<string, unknown>) => [path, methods] as const;

function spec(origin: string) {
  const authed = { security: [{ bearerAuth: [] }] };
  const okResponse = { "200": { description: "Success" } };

  return {
    openapi: "3.0.3",
    info: { title: "TradeMall Ad Platform API", version: "1.0.0", description: "Serving, event, and management endpoints." },
    servers: [{ url: origin }],
    components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } } },
    paths: Object.fromEntries([
      json("/api/public/health", { get: { summary: "Health check", responses: okResponse } }),
      json("/api/public/placements", { get: { summary: "Discover enabled placements for the calling registered website", responses: okResponse } }),
      json("/api/public/ad", { get: { summary: "Serve an ad for a zone", responses: okResponse } }),
      json("/api/public/impression", { post: { summary: "Record an impression", responses: okResponse } }),
      json("/api/public/click", { get: { summary: "Record a click and redirect", responses: okResponse } }),
      json("/api/v1/ads/serve", { get: { summary: "Serve an ad (v1)", responses: okResponse } }),
      json("/api/v1/events/impression", { post: { summary: "Record impression (v1)", responses: okResponse } }),
      json("/api/v1/events/click", { post: { summary: "Record click (v1)", responses: okResponse } }),
      json("/api/v1/campaigns", { get: { summary: "List campaigns", ...authed, responses: okResponse }, post: { summary: "Create campaign", ...authed, responses: okResponse } }),
      json("/api/v1/campaigns/{id}", { get: { summary: "Campaign detail", ...authed, responses: okResponse }, patch: { summary: "Update campaign", ...authed, responses: okResponse } }),
      json("/api/v1/campaigns/{id}/submit", { post: { summary: "Submit campaign for review", ...authed, responses: okResponse } }),
      json("/api/v1/ads", { get: { summary: "List ads", ...authed, responses: okResponse }, post: { summary: "Create ad", ...authed, responses: okResponse } }),
      json("/api/v1/ads/{id}", { get: { summary: "Ad detail", ...authed, responses: okResponse }, patch: { summary: "Update ad status or creative", ...authed, responses: okResponse } }),
      json("/api/v1/websites", { get: { summary: "List websites", ...authed, responses: okResponse }, post: { summary: "Create website", ...authed, responses: okResponse } }),
      json("/api/v1/websites/{id}", { get: { summary: "Website detail", ...authed, responses: okResponse }, patch: { summary: "Update website", ...authed, responses: okResponse } }),
      json("/api/v1/websites/{id}/verify", { post: { summary: "Run website verification", ...authed, responses: okResponse } }),
      json("/api/v1/ad-zones", { get: { summary: "List ad zones", ...authed, responses: okResponse }, post: { summary: "Create ad zone", ...authed, responses: okResponse } }),
      json("/api/v1/ad-zones/{id}", { get: { summary: "Ad zone detail", ...authed, responses: okResponse }, patch: { summary: "Activate or suspend a zone", ...authed, responses: okResponse } }),
      json("/api/v1/analytics", { get: { summary: "Analytics summary", ...authed, responses: okResponse } }),
      json("/api/v1/api-keys", { get: { summary: "List API keys", ...authed, responses: okResponse }, post: { summary: "Issue an API key", ...authed, responses: okResponse } }),
      json("/api/v1/api-keys/{id}", { delete: { summary: "Revoke an API key", ...authed, responses: okResponse } }),
    ]),
  };
}

export const Route = createFileRoute("/api/public/openapi.json")({
  server: {
    handlers: {
      GET: async ({ request }) => new Response(JSON.stringify(spec(new URL(request.url).origin), null, 2), {
        status: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" },
      }),
    },
  },
});
