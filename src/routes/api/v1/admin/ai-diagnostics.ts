import { createFileRoute } from "@tanstack/react-router";
import { diagnoseAIConnection, getAiProviderName } from "@/lib/ai/campaign-copilot.server";
import { authenticateRequest } from "@/lib/api-auth.server";
import { jsonResponse } from "@/lib/api-response";
import { corsHeaders, preflight } from "@/lib/api-v1.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/v1/admin/ai-diagnostics")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) =>
        preflight("GET, OPTIONS", request.headers.get("origin")),

      GET: async ({ request }) => {
        const authResult = await authenticateRequest(request);
        if (!authResult.authenticated) return authResult.response!;

        const userId = authResult.context.userId;

        const { data: platformRole } = await supabaseAdmin
          .from("platform_roles")
          .select("role")
          .eq("user_id", userId)
          .maybeSingle();

        if (!platformRole?.role || !["super_admin", "admin"].includes(platformRole.role)) {
          return jsonResponse(
            { ok: false, error: "forbidden", message: "Platform admin access required" },
            403,
          );
        }

        let provider = "workers-ai";

        const result = await diagnoseAIConnection();
        return jsonResponse(
          {
            configured: result.configured,
            provider,
            model: result.model,
            ok: result.ok,
            message: result.message,
          },
          200,
        );
      },
    },
  },
});
