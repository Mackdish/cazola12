import { createFileRoute } from "@tanstack/react-router";
import { jsonResponse } from "@/lib/api-response";

export const Route = createFileRoute("/api/worker/email-delivery")({
  server: { handlers: {
    POST: async ({ request }) => {
      const secret = process.env.EMAIL_WORKER_SECRET;
      if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
        return jsonResponse({ ok: false, error: "unauthorized" }, 401);
      }
      try {
        const { processEmailQueue } = await import("@/lib/email-delivery.server");
        return jsonResponse({ ok: true, ...(await processEmailQueue(25)) });
      } catch (error) {
        console.error("[email] delivery worker failed", error);
        return jsonResponse({ ok: false, error: "delivery_failed" }, 500);
      }
    },
  } },
});
