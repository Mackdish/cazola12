/**
 * GET  /api/v1/api-keys — list keys for the organization (never the secrets)
 * POST /api/v1/api-keys — issue a key; the token is returned exactly once
 *
 * Session-authenticated callers only: API keys cannot mint further API keys.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { createApiKey, listApiKeys } from "@/lib/api-keys-manage.server";
import { assertOrganizationAccess } from "@/lib/api-authorization.server";
import { forbiddenError, jsonResponse, serverError } from "@/lib/api-response";
import {
  corsHeaders,
  parseJsonBody,
  preflight,
  requireAuth,
  resolveOrganizationId,
} from "@/lib/api-v1.server";

const METHODS = "GET, POST";

const createSchema = z.object({
  permissions: z.record(z.string(), z.array(z.string())).optional(),
  expires_at: z.string().datetime().nullable().optional(),
});

export const Route = createFileRoute("/api/v1/api-keys/")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => preflight(METHODS, request.headers.get("origin")),

      GET: async ({ request }) => {
        const auth = await requireAuth(request);
        if (!auth.ok) return auth.response;

        const org = resolveOrganizationId(request, auth.context);
        if (!org.ok) return org.response;

        const access = await assertOrganizationAccess(
          auth.context.userId,
          org.organizationId,
          auth.context.authMethod,
        );
        if (!access.allowed) return access.response;

        try {
          const keys = await listApiKeys(org.organizationId);
          return jsonResponse(
            { ok: true, data: keys },
            200,
            corsHeaders(METHODS, request.headers.get("origin")),
          );
        } catch {
          return serverError("Failed to list API keys");
        }
      },

      POST: async ({ request }) => {
        const auth = await requireAuth(request);
        if (!auth.ok) return auth.response;
        if (auth.context.authMethod === "api_key") {
          return forbiddenError("API keys cannot issue other API keys");
        }

        const org = resolveOrganizationId(request, auth.context);
        if (!org.ok) return org.response;

        const access = await assertOrganizationAccess(
          auth.context.userId,
          org.organizationId,
          auth.context.authMethod,
        );
        if (!access.allowed) return access.response;

        const body = await parseJsonBody(request, createSchema);
        if (!body.ok) return body.response;

        try {
          const key = await createApiKey({
            organizationId: org.organizationId,
            ...(body.data.permissions ? { permissions: body.data.permissions } : {}),
            expiresAt: body.data.expires_at ?? null,
          });
          return jsonResponse(
            { ok: true, data: key },
            201,
            corsHeaders(METHODS, request.headers.get("origin")),
          );
        } catch {
          return serverError("Failed to create API key");
        }
      },
    },
  },
});
