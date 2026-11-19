import { createHmac, timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { jsonResponse } from "@/lib/api-response";

function htmlPage(message: string): Response {
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TradeMall email preferences</title></head><body style="font:16px Arial,sans-serif;max-width:560px;margin:12vh auto;padding:24px;color:#222"><h1>Email preferences updated</h1><p>${message}</p><p>You can still receive essential account, security, billing and service notifications.</p><p><a href="https://trademall.co.ke">Return to TradeMall</a></p></body></html>`, {
    status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
async function unsubscribe(token: string): Promise<void> {
  const secret = process.env.EMAIL_UNSUBSCRIBE_SECRET;
  if (!secret) throw new Error("Unsubscribe is not configured.");
  const separator = token.lastIndexOf(".");
  if (separator < 1) throw new Error("Invalid unsubscribe token.");
  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new Error("Invalid unsubscribe token.");
  const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (!decoded.userId || !decoded.email || Number(decoded.exp) < Date.now()) throw new Error("This unsubscribe link has expired.");
  const { error } = await (supabaseAdmin as any).from("email_preferences").upsert({
    user_id: decoded.userId, marketing_enabled: false, product_updates_enabled: false,
    unsubscribed_at: new Date().toISOString(), unsubscribe_reason: "one_click_unsubscribe",
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) throw error;
}
export const Route = createFileRoute("/api/email/unsubscribe")({
  server: { handlers: {
    GET: async ({ request }) => {
      const token = new URL(request.url).searchParams.get("token") ?? "";
      try { await unsubscribe(token); return htmlPage("You have been unsubscribed from TradeMall marketing emails."); }
      catch { return new Response("This unsubscribe link is invalid or has expired.", { status: 400 }); }
    },
    POST: async ({ request }) => {
      const contentType = request.headers.get("content-type") ?? "";
      const body = contentType.includes("application/json")
        ? await request.json() as { token?: string }
        : Object.fromEntries(new URLSearchParams(await request.text()).entries());
      const token = String((body as { token?: string }).token ?? "");
      try { await unsubscribe(token); return jsonResponse({ ok: true, unsubscribed: true }); }
      catch { return jsonResponse({ ok: false, error: "invalid_unsubscribe_token" }, 400); }
    },
  } },
});
