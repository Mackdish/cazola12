import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

const securityHeadersMiddleware = createMiddleware().server(async ({ next, request }) => {
  const raw = await next();
  const response = (raw as unknown as Response);
  const isApi = new URL(request.url).pathname.startsWith("/api/");

  try {
    const headers = new Headers(response.headers);
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("X-Frame-Options", "DENY");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    headers.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
    if (!isApi) {
      headers.set("X-XSS-Protection", "1; mode=block");
    }
    if (process.env["NODE_ENV"] === "production" || process.env["NODE_ENV"] === "staging") {
      headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
    }

    const cloned = response.clone();
    return new Response(cloned.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch {
    return response;
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, csrfMiddleware, securityHeadersMiddleware],
}));
