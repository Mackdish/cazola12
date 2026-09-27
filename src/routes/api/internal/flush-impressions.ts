import { createFileRoute } from "@tanstack/react-router";

/**
 * Private scheduler endpoint for VPS deployments. The scheduled Cloudflare
 * handler remains available for Workers deployments; VPS deployments call this
 * route from the Compose scheduler container.
 */
export const Route = createFileRoute("/api/internal/flush-impressions")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.INTERNAL_WORKER_SECRET;
        if (!secret) {
          return Response.json({ ok: false, error: "worker_not_configured" }, { status: 503 });
        }

        if (request.headers.get("authorization") !== "Bearer " + secret) {
          return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
        }

        try {
          const { flushImpressionBatch, getStreamBacklog } = await import(
            "@/lib/impression-buffer.server"
          );
          const result = await flushImpressionBatch();
          const backlog = await getStreamBacklog();
          return Response.json({ ok: result.failed === 0, ...result, backlog }, {
            status: result.failed > 0 ? 503 : 200,
            headers: { "Cache-Control": "no-store" },
          });
        } catch (error) {
          console.error("[vps-worker] impression flush failed", error);
          return Response.json({ ok: false, error: "flush_failed" }, { status: 500 });
        }
      },
    },
  },
});
