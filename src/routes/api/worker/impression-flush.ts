/**
 * POST /api/worker/impression-flush
 *
 * Flush endpoint for the impression buffer worker.
 * Can be called by:
 *   - Cloudflare scheduled handler (configured in wrangler.jsonc)
 *   - External cron service (e.g. Upstash QStash) for sub-minute intervals
 *
 * Protected by a shared secret to prevent unauthorized flushing.
 */

import { createFileRoute } from "@tanstack/react-router";
import { jsonResponse } from "@/lib/api-response";

export const Route = createFileRoute("/api/worker/impression-flush")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        const expectedToken = process.env.IMPRESSION_FLUSH_SECRET;

        if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
          return jsonResponse({ ok: false, error: "unauthorized" }, 401);
        }

        const { flushImpressionBatch, getStreamBacklog, checkRedisPersistence } = await import(
          "@/lib/impression-buffer.server"
        );

        const persistence = await checkRedisPersistence();
        const backlog = await getStreamBacklog();

        const result = await flushImpressionBatch();

        return jsonResponse({
          ok: true,
          backlog,
          persistence,
          ...result,
        });
      },

      GET: async () => {
        const { getStreamBacklog, getPendingInfo, checkRedisPersistence } = await import(
          "@/lib/impression-buffer.server"
        );

        const backlog = await getStreamBacklog();
        const pending = await getPendingInfo();
        const persistence = await checkRedisPersistence();

        return jsonResponse({
          ok: true,
          backlog,
          pending,
          persistence,
        });
      },
    },
  },
});
