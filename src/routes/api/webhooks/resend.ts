import { createFileRoute } from "@tanstack/react-router";
import { jsonResponse } from "@/lib/api-response";

export const Route = createFileRoute("/api/webhooks/resend")({
  server: { handlers: {
    POST: async ({ request }) => {
      const secret = process.env.RESEND_WEBHOOK_SECRET;
      if (!secret) return jsonResponse({ ok: false, error: "webhook_not_configured" }, 503);
      const payload = await request.text();
      const headers = {
        id: request.headers.get("svix-id") ?? "",
        timestamp: request.headers.get("svix-timestamp") ?? "",
        signature: request.headers.get("svix-signature") ?? "",
      };
      try {
        const { Resend } = await import("resend");
        const verifier = new Resend(process.env.RESEND_API_KEY ?? "");
        const event = await verifier.webhooks.verify({ payload, headers, webhookSecret: secret });
        const { recordResendWebhook } = await import("@/lib/email-delivery.server");
        await recordResendWebhook(event as unknown as Record<string, unknown>);
        return jsonResponse({ ok: true });
      } catch (error) {
        console.error("[email] rejected Resend webhook", error);
        return jsonResponse({ ok: false, error: "invalid_webhook" }, 400);
      }
    },
  } },
});
