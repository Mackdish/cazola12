import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { captureRuntimeEnv } from "./lib/runtime-env.server";
import { captureRuntimeBindings } from "./lib/runtime-bindings.server";
import {
  ACTIVE_SUPABASE_URL,
  ACTIVE_SUPABASE_PUBLISHABLE_KEY,
  ACTIVE_SUPABASE_PROJECT_ID,
} from "./lib/supabase-target";

// Point every server-side Supabase client at the external project, overriding
// the managed env vars injected for the built-in project. Cloudflare injects env
// per request, so this also runs on every fetch (see applyExternalSupabaseEnv).
function applyExternalSupabaseEnv() {
  try {
    process.env["SUPABASE_URL"] = ACTIVE_SUPABASE_URL;
    process.env["SUPABASE_PUBLISHABLE_KEY"] = ACTIVE_SUPABASE_PUBLISHABLE_KEY;
    process.env["SUPABASE_ANON_KEY"] = ACTIVE_SUPABASE_PUBLISHABLE_KEY;
    process.env["SUPABASE_PROJECT_ID"] = ACTIVE_SUPABASE_PROJECT_ID;
    // Privileged key for the external project (managed SUPABASE_* secrets cannot
    // be overwritten, so it is supplied under one of these names).
    const externalServiceKey =
      process.env["EXTERNAL_SUPABASE_SERVICE_ROLE_KEY"] || process.env["SERVICE_ROLE_KEY"];
    if (externalServiceKey) {
      process.env["SUPABASE_SERVICE_ROLE_KEY"] = externalServiceKey;
    }
  } catch {
    // process.env may be read-only in some runtimes; client env still applies.
  }
}

applyExternalSupabaseEnv();



type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      // Cloudflare passes secrets on `env`, not process.env — cache them and
      // mirror into process.env where the runtime allows writes.
      captureRuntimeEnv(env);
      captureRuntimeBindings(env);
      if (env && typeof env === "object") {
        for (const [key, value] of Object.entries(env as Record<string, unknown>)) {
          try {
            if (typeof value === "string" && !process.env[key]) process.env[key] = value;
          } catch {
            // process.env may be read-only; the runtime-env cache still has it.
          }
        }
      }
      applyExternalSupabaseEnv();
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);

    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },

  async scheduled(controller: ScheduledController, env: unknown, ctx: unknown) {
    try {
      captureRuntimeEnv(env);
      captureRuntimeBindings(env);
      if (env && typeof env === "object") {
        for (const [key, value] of Object.entries(env as Record<string, unknown>)) {
          try {
            if (typeof value === "string" && !process.env[key]) process.env[key] = value;
          } catch {
            // process.env may be read-only
          }
        }
      }
      applyExternalSupabaseEnv();

      const { flushImpressionBatch, getStreamBacklog } = await import("@/lib/impression-buffer.server");
      const backlog = await getStreamBacklog();
      console.info("[impression-buffer] scheduled flush start", { backlog });

      const result = await flushImpressionBatch();
      console.info("[impression-buffer] scheduled flush complete", result);
    } catch (error) {
      console.error("[impression-buffer] scheduled flush failed", error);
    }
  },
};
