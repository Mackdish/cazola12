/**
 * DELETE /api/v1/api-keys/:id — revoke a key by its public key_id
 */
import { createFileRoute } from "@tanstack/react-router";

import { revokeApiKey } from "@/lib/api-keys-manage.server";
import { assertOrganizationAccess } from "@/lib/api-authorization.server";
import { forbiddenError, jsonResponse, notFoundError, serverError } from "@/lib/api-response";
import { corsHeaders, preflight, requireAuth, resolveOrganizationId } from "@/lib/api-v1.server";

const METHODS = "DELETE";

export const Route = createFileRoute("/api/v1/api-keys/$id")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => preflight(METHODS, request.headers.get("origin")),

      DELETE: async ({ request, params }) => {
        const auth = await requireAuth(request);
        if (!auth.ok) return auth.response;
        if (auth.context.authMethod === "api_key") {
          return forbiddenError("API keys cannot revoke other API keys");
        }

        const org = resolveOrganizationId(request, auth.context);
        if (!org.ok) return org.response;

        const access = await assertOrganizationAccess(
          auth.context.userId,
          org.organizationId,
          auth.context.authMethod,
        );
        if (!access.allowed) return access.response;

        try {
          const revoked = await revokeApiKey(org.organizationId, params.id);
          if (!revoked) return notFoundError("API key not found");
          return jsonResponse(
            { ok: true, data: revoked },
            200,
            corsHeaders(METHODS, request.headers.get("origin")),
          );
        } catch {
          return serverError("Failed to revoke API key");
        }
      },
    },
  },
});
