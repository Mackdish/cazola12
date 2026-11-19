import { Resend } from "resend";
import { createHmac } from "node:crypto";
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
function createUnsubscribeUrl(userId: string, email: string): string {
  const secret = process.env.EMAIL_UNSUBSCRIBE_SECRET;
  if (!secret) throw new Error("EMAIL_UNSUBSCRIBE_SECRET is not configured.");
  const payload = Buffer.from(JSON.stringify({
    userId, email: email.toLowerCase(), exp: Date.now() + 90 * 24 * 60 * 60 * 1000,
  })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  const origin = process.env.APP_BASE_URL ?? "https://trademall.co.ke";
  return origin + "/api/email/unsubscribe?token=" + payload + "." + signature;
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
async function syncCampaignRecipient(queueId: string, status: string): Promise<void> {
  const { data: rows } = await db.from("email_campaign_recipients")
    .select("campaign_id").eq("queue_id", queueId);
  const campaignIds = [...new Set((rows ?? []).map((row: any) => row.campaign_id))];
  if (campaignIds.length === 0) return;
  await db.from("email_campaign_recipients").update({ status, updated_at: new Date().toISOString() }).eq("queue_id", queueId);
  for (const campaignId of campaignIds) {
    const { count, error } = await db.from("email_campaign_recipients")
      .select("id", { count: "exact", head: true }).eq("campaign_id", campaignId)
      .in("status", ["pending", "queued"]);
    if (!error && count === 0) {
      await db.from("email_campaigns").update({
        status: "sent", completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq("id", campaignId);
    }
  }
}

async function queueDueCampaigns(): Promise<void> {
  const { data, error } = await db.from("email_campaigns").select("id")
    .eq("status", "scheduled").lte("scheduled_at", new Date().toISOString()).limit(10);
  if (error) throw error;
  for (const campaign of data ?? []) await queueEmailCampaign(campaign.id);
}

export async function processEmailQueue(batchSize = 25) {
  await queueDueCampaigns();
  const { data: jobs, error } = await db.rpc("claim_email_queue", { _limit: batchSize });
  if (error) throw error;
  const result = { claimed: (jobs ?? []).length, sent: 0, skipped: 0, failed: 0 };
  for (const job of jobs ?? []) {
    try {
      const email = String(job.recipient_email).trim().toLowerCase();
      if (await suppressed(email)) {
        await db.from("email_queue").update({ status: "cancelled", last_error: "Recipient suppressed." }).eq("id", job.id);
        await syncCampaignRecipient(job.id, "skipped");
        result.skipped++; continue;
      }
      if (job.category === "marketing") {
        if (!job.user_id) {
          await db.from("email_queue").update({ status: "cancelled", last_error: "Marketing requires a user consent record." }).eq("id", job.id);
          await syncCampaignRecipient(job.id, "skipped");
          result.skipped++; continue;
        }
        const { data: prefs, error: prefError } = await db.from("email_preferences")
          .select("marketing_enabled,unsubscribed_at").eq("user_id", job.user_id).maybeSingle();
        if (prefError) throw prefError;
        if (!prefs?.marketing_enabled || prefs.unsubscribed_at) {
          await db.from("email_queue").update({ status: "cancelled", last_error: "Recipient has not consented to marketing." }).eq("id", job.id);
          await syncCampaignRecipient(job.id, "skipped");
          result.skipped++; continue;
        }
      }
      const { data: template, error: templateError } = await db.from("email_templates")
        .select("subject,html_body,text_body").eq("id", job.template_id).maybeSingle();
      if (templateError) throw templateError;
      if (!template) throw new Error("Email template no longer exists.");
      const values = (job.payload ?? {}) as Record<string, unknown>;
      const unsubscribeUrl = job.category === "marketing" && job.user_id
        ? createUnsubscribeUrl(job.user_id, email) : undefined;
      const renderedHtml = render(template.html_body, { ...values, unsubscribeUrl });
      const html = unsubscribeUrl
        ? renderedHtml + `<div style="font:12px Arial,sans-serif;color:#777;margin-top:28px"><p>You received this because you opted in to TradeMall updates.</p><p><a href="${escapeHtml(unsubscribeUrl)}">Unsubscribe</a></p></div>`
        : renderedHtml;
      const renderedText = template.text_body ? render(template.text_body, { ...values, unsubscribeUrl }) : undefined;
      const response = await getResend().emails.send({
        from: process.env.EMAIL_FROM ?? "TradeMall <no-reply@trademall.co.ke>",
        to: [email], subject: job.subject_override || render(template.subject, values),
        html,
        ...(renderedText ? { text: unsubscribeUrl ? renderedText + "\\nUnsubscribe: " + unsubscribeUrl : renderedText } : {}),
        headers: {
          "Idempotency-Key": job.idempotency_key,
          ...(unsubscribeUrl ? { "List-Unsubscribe": `<${unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : {}),
        },
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
      await syncCampaignRecipient(job.id, "sent");
      result.sent++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const terminal = Number(job.attempts ?? 0) >= Number(job.max_attempts ?? 5);
      await db.from("email_queue").update({
        status: terminal ? "failed" : "queued", last_error: message.slice(0, 1000),
        scheduled_at: new Date(Date.now() + Math.min(60, 2 ** Number(job.attempts ?? 1)) * 60_000).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", job.id);
      if (terminal) await syncCampaignRecipient(job.id, "failed");
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
export async function dispatchEmailEvent(input: {
  eventKey: string; eventName: string; userId: string; audience: "advertiser" | "publisher" | "both";
  organizationId?: string; payload?: Record<string, unknown>;
}): Promise<{ queued: number; duplicate: boolean }> {
  const { data: event, error: eventError } = await db.from("email_events").insert({
    event_key: input.eventKey, event_name: input.eventName, user_id: input.userId,
    organization_id: input.organizationId ?? null, audience: input.audience, payload: input.payload ?? {},
  }).select("id").single();
  if (eventError?.code === "23505") return { queued: 0, duplicate: true };
  if (eventError) throw eventError;
  const [{ data: userResult, error: userError }, { data: automations, error: automationError }] = await Promise.all([
    db.auth.admin.getUserById(input.userId),
    db.from("email_automations").select("id,category,audience,email_automation_steps(id,delay_minutes,template_id,is_enabled)")
      .eq("trigger_event", input.eventName).eq("is_enabled", true),
  ]);
  if (userError || automationError) throw new Error("Unable to evaluate email automations.");
  const recipient = userResult?.user?.email;
  if (!recipient) return { queued: 0, duplicate: false };
  let queued = 0;
  for (const automation of automations ?? []) {
    if (automation.audience !== "both" && automation.audience !== input.audience) continue;
    for (const step of (automation.email_automation_steps ?? []).filter((item: any) => item.is_enabled)) {
      const { error } = await db.from("email_queue").upsert({
        event_id: event.id, user_id: input.userId, recipient_email: recipient.toLowerCase(),
        template_id: step.template_id, category: automation.category,
        payload: input.payload ?? {},
        idempotency_key: input.eventKey + ":" + automation.id + ":" + step.id,
        scheduled_at: new Date(Date.now() + Number(step.delay_minutes ?? 0) * 60_000).toISOString(),
        status: "queued",
      }, { onConflict: "idempotency_key", ignoreDuplicates: true });
      if (error) throw error;
      queued++;
    }
  }
  await db.from("email_events").update({ processed_at: new Date().toISOString() }).eq("id", event.id);
  return { queued, duplicate: false };
}

export async function queueEmailCampaign(campaignId: string): Promise<{ queued: number; skipped: number }> {
  const { data: campaign, error: campaignError } = await db.from("email_campaigns")
    .select("*").eq("id", campaignId).maybeSingle();
  if (campaignError) throw campaignError;
  if (!campaign || !["draft", "scheduled", "paused"].includes(campaign.status)) {
    throw new Error("Campaign is not in a sendable state.");
  }
  const { data: users, error: usersError } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersError) throw usersError;
  const userIds = (users?.users ?? []).map((user: any) => user.id);
  if (userIds.length === 0) return { queued: 0, skipped: 0 };

  const [{ data: memberships, error: membershipError }, { data: preferences, error: preferencesError }, { data: suppressions, error: suppressionError }] = await Promise.all([
    db.from("organization_members").select("user_id, organizations!inner(type)").eq("status", "active").in("user_id", userIds),
    db.from("email_preferences").select("user_id,marketing_enabled,unsubscribed_at").in("user_id", userIds),
    db.from("email_suppressions").select("email"),
  ]);
  if (membershipError || preferencesError || suppressionError) throw new Error("Unable to resolve campaign audience.");
  const audienceIds = new Set((memberships ?? [])
    .filter((row: any) => campaign.audience === "both" || row.organizations?.type === campaign.audience)
    .map((row: any) => row.user_id));
  const optedIn = new Set((preferences ?? [])
    .filter((row: any) => row.marketing_enabled && !row.unsubscribed_at).map((row: any) => row.user_id));
  const suppressedEmails = new Set((suppressions ?? []).map((row: any) => String(row.email).toLowerCase()));
  const eligible = (users?.users ?? []).filter((user: any) =>
    user.email && audienceIds.has(user.id) && optedIn.has(user.id) && !suppressedEmails.has(user.email.toLowerCase()));
  const { data: template, error: templateError } = await db.from("email_templates").upsert({
    slug: "campaign-" + campaign.id, name: campaign.name, category: "marketing",
    subject: campaign.subject, html_body: campaign.html_body, text_body: campaign.text_body ?? null,
    is_active: true, updated_at: new Date().toISOString(),
  }, { onConflict: "slug" }).select("id").single();
  if (templateError) throw templateError;

  const recipients = eligible.map((user: any) => ({
    campaign_id: campaign.id, user_id: user.id, recipient_email: user.email.toLowerCase(), status: "queued",
  }));
  if (recipients.length) {
    const { error: recipientError } = await db.from("email_campaign_recipients")
      .upsert(recipients, { onConflict: "campaign_id,recipient_email", ignoreDuplicates: true });
    if (recipientError) throw recipientError;
  }
  const queueRows = eligible.map((user: any) => ({
    user_id: user.id, recipient_email: user.email.toLowerCase(), template_id: template.id,
    category: "marketing", payload: { firstName: user.user_metadata?.first_name ?? user.user_metadata?.full_name ?? "there" },
    idempotency_key: "campaign:" + campaign.id + ":" + user.id, status: "queued",
  }));
  if (queueRows.length) {
    const { error: queueError } = await db.from("email_queue")
      .upsert(queueRows, { onConflict: "idempotency_key", ignoreDuplicates: true });
    if (queueError) throw queueError;
    const { data: queuedRows, error: queuedError } = await db.from("email_queue")
      .select("id,user_id").eq("category", "marketing").like("idempotency_key", "campaign:" + campaign.id + ":%");
    if (queuedError) throw queuedError;
    for (const row of queuedRows ?? []) {
      await db.from("email_campaign_recipients").update({ queue_id: row.id, status: "queued" })
        .eq("campaign_id", campaign.id).eq("user_id", row.user_id);
    }
  }
  await db.from("email_campaigns").update({
    status: eligible.length ? "sending" : "sent",
    started_at: new Date().toISOString(),
    completed_at: eligible.length ? null : new Date().toISOString(),
  }).eq("id", campaign.id);
  return { queued: eligible.length, skipped: (users?.users ?? []).length - eligible.length };
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
  if (messageId && email) {
    const { data: queueRow } = await db.from("email_queue").select("id")
      .eq("resend_id", messageId).maybeSingle();
    const statusByEvent: Record<string, string> = {
      "email.delivered": "delivered", "email.bounced": "bounced",
      "email.complained": "complained", "email.failed": "failed",
    };
    const recipientStatus = statusByEvent[String(event.type ?? "")];
    if (queueRow && recipientStatus) {
      await db.from("email_campaign_recipients").update({
        status: recipientStatus, updated_at: new Date().toISOString(),
      }).eq("queue_id", queueRow.id);
    }
  }
  if (messageId && email) {
    const { data: queueRow } = await db.from("email_queue").select("id").eq("resend_id", messageId).maybeSingle();
    const statusByEvent: Record<string, string> = {
      "email.delivered": "delivered", "email.bounced": "bounced",
      "email.complained": "complained", "email.failed": "failed",
    };
    const recipientStatus = statusByEvent[String(event.type ?? "")];
    if (queueRow && recipientStatus) {
      await db.from("email_campaign_recipients").update({
        status: recipientStatus, updated_at: new Date().toISOString(),
      }).eq("queue_id", queueRow.id);
    }
  }
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
