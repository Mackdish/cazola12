import { Resend } from "resend";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type EmailInput = {
  to: string; userId?: string | null; templateSlug: string;
  payload: Record<string, unknown>; category: "transactional" | "marketing";
  idempotencyKey: string; subjectOverride?: string; scheduledAt?: string;
};
const db = supabaseAdmin as any;
let client: Resend | null = null;
function getResend(): Resend {
  if (!client) {
    if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured.");
    client = new Resend(process.env.RESEND_API_KEY);
  }
  return client;
}
function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c] ?? c);
}
function render(source: string, values: Record<string, unknown>): string {
  return source.replace(/{{\s*([\w.]+)\s*}}/g, (_match, key: string) => {
    const value = key.split(".").reduce<unknown>((v, part) =>
      v && typeof v === "object" ? (v as Record<string, unknown>)[part] : undefined, values);
    return escapeHtml(value);
  });
}
async function suppressed(email: string): Promise<boolean> {
  const { data, error } = await db.from("email_suppressions").select("email")
    .eq("email", email.toLowerCase()).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}
export async function enqueueEmail(input: EmailInput): Promise<void> {
  const { data: template, error: lookupError } = await db.from("email_templates")
    .select("id,category").eq("slug", input.templateSlug).eq("is_active", true).maybeSingle();
  if (lookupError) throw lookupError;
  if (!template) throw new Error("Email template is missing or inactive: " + input.templateSlug);
  if (template.category !== input.category) throw new Error("Email category does not match template.");
  const { error } = await db.from("email_queue").upsert({
    user_id: input.userId ?? null, recipient_email: input.to.trim().toLowerCase(),
    template_id: template.id, category: input.category, subject_override: input.subjectOverride ?? null,
    payload: input.payload, idempotency_key: input.idempotencyKey,
    scheduled_at: input.scheduledAt ?? new Date().toISOString(), status: "queued",
  }, { onConflict: "idempotency_key", ignoreDuplicates: true });
  if (error) throw error;
}
export async function processEmailQueue(batchSize = 25) {
  const { data: jobs, error } = await db.rpc("claim_email_queue", { _limit: batchSize });
  if (error) throw error;
  const result = { claimed: (jobs ?? []).length, sent: 0, skipped: 0, failed: 0 };
  for (const job of jobs ?? []) {
    try {
      const email = String(job.recipient_email).trim().toLowerCase();
      if (await suppressed(email)) {
        await db.from("email_queue").update({ status: "cancelled", last_error: "Recipient suppressed." }).eq("id", job.id);
        result.skipped++; continue;
      }
      if (job.category === "marketing") {
        if (!job.user_id) {
          await db.from("email_queue").update({ status: "cancelled", last_error: "Marketing requires a user consent record." }).eq("id", job.id);
          result.skipped++; continue;
        }
        const { data: prefs, error: prefError } = await db.from("email_preferences")
          .select("marketing_enabled,unsubscribed_at").eq("user_id", job.user_id).maybeSingle();
        if (prefError) throw prefError;
        if (!prefs?.marketing_enabled || prefs.unsubscribed_at) {
          await db.from("email_queue").update({ status: "cancelled", last_error: "Recipient has not consented to marketing." }).eq("id", job.id);
          result.skipped++; continue;
        }
      }
      const { data: template, error: templateError } = await db.from("email_templates")
        .select("subject,html_body,text_body").eq("id", job.template_id).maybeSingle();
      if (templateError) throw templateError;
      if (!template) throw new Error("Email template no longer exists.");
      const values = (job.payload ?? {}) as Record<string, unknown>;
      const response = await getResend().emails.send({
        from: process.env.EMAIL_FROM ?? "TradeMall <no-reply@trademall.co.ke>",
        to: [email], subject: job.subject_override || render(template.subject, values),
        html: render(template.html_body, values),
        ...(template.text_body ? { text: render(template.text_body, values) } : {}),
        headers: { "Idempotency-Key": job.idempotency_key },
      });
      if (response.error) throw new Error(response.error.message);
      await db.from("email_queue").update({
        status: "sent", sent_at: new Date().toISOString(), resend_id: response.data?.id ?? null,
        last_error: null, updated_at: new Date().toISOString(),
      }).eq("id", job.id);
      await db.from("email_logs").insert({
        queue_id: job.id, user_id: job.user_id, recipient_email: email,
        category: job.category, provider: "resend", provider_message_id: response.data?.id ?? null,
        event_type: "sent",
      });
      result.sent++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const terminal = Number(job.attempts ?? 0) >= Number(job.max_attempts ?? 5);
      await db.from("email_queue").update({
        status: terminal ? "failed" : "queued", last_error: message.slice(0, 1000),
        scheduled_at: new Date(Date.now() + Math.min(60, 2 ** Number(job.attempts ?? 1)) * 60_000).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", job.id);
      await db.from("email_logs").insert({
        queue_id: job.id, user_id: job.user_id, recipient_email: job.recipient_email,
        category: job.category, event_type: terminal ? "failed" : "retry_scheduled",
        event_payload: { error: message.slice(0, 1000), attempt: job.attempts },
      });
      result.failed++;
    }
  }
  return result;
}
export async function recordResendWebhook(event: Record<string, any>): Promise<void> {
  const eventId = String(event.id ?? "");
  if (!eventId) throw new Error("Webhook event ID is missing.");
  const { error } = await db.from("email_webhook_events").insert({
    provider_event_id: eventId, event_type: String(event.type ?? "unknown"), payload: event,
  });
  if (error?.code === "23505") return;
  if (error) throw error;
  const data = event.data ?? {};
  const messageId = data.email_id ?? data.id;
  const email = String(data.to?.[0] ?? data.email ?? "").toLowerCase();
  if (messageId) await db.from("email_logs").insert({
    recipient_email: email || "unknown", category: "transactional", provider: "resend",
    provider_message_id: messageId, event_type: String(event.type ?? "unknown"), event_payload: data,
  });
  if (email && ["email.bounced", "email.complained"].includes(String(event.type))) {
    await db.from("email_suppressions").upsert({
      email, reason: String(event.type), source: "resend_webhook", provider_event_id: eventId,
    }, { onConflict: "email" });
  }
}
