import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
async function getAdminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}
async function assertEmailAdmin(userId: string, supabase: any) {
  const { data, error } = await supabase.from("platform_roles").select("role").eq("user_id", userId);
  if (error) throw new Error("Unable to verify platform permissions.");
  if (!(data ?? []).some((row: { role: string }) => ["admin", "super_admin"].includes(row.role))) {
    throw new Error("Forbidden: email administration requires a platform admin.");
  }
}

export const getEmailAdminData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertEmailAdmin(context.userId, context.supabase);
    const db = await getAdminDb();
    const [templates, automations, campaigns, queue, logs, queued, sent, failed, suppressions, suppressionRows] = await Promise.all([
      db.from("email_templates").select("*").order("updated_at", { ascending: false }),
      db.from("email_automations").select("*, email_automation_steps(id,step_order,delay_minutes,template_id,is_enabled)").order("created_at", { ascending: false }),
      db.from("email_campaigns").select("*").order("created_at", { ascending: false }).limit(50),
      db.from("email_queue").select("id,recipient_email,category,status,scheduled_at,attempts,last_error,created_at").order("created_at", { ascending: false }).limit(50),
      db.from("email_logs").select("id,recipient_email,category,event_type,provider_message_id,occurred_at").order("occurred_at", { ascending: false }).limit(100),
      db.from("email_queue").select("id", { count: "exact", head: true }).eq("status", "queued"),
      db.from("email_queue").select("id", { count: "exact", head: true }).eq("status", "sent"),
      db.from("email_queue").select("id", { count: "exact", head: true }).eq("status", "failed"),
      db.from("email_suppressions").select("email,reason,source,created_at").order("created_at", { ascending: false }).limit(100),
    ]);
    for (const result of [templates, automations, campaigns, queue, logs, queued, sent, failed, suppressions]) {
      if (result.error) throw new Error("Unable to load email workspace data.");
    }
    return {
      templates: templates.data ?? [], automations: automations.data ?? [],
      campaigns: campaigns.data ?? [], queue: queue.data ?? [], logs: logs.data ?? [],
      suppressions: suppressionRows.data ?? [],\n      metrics: { queued: queued.count ?? 0, sent: sent.count ?? 0, failed: failed.count ?? 0, suppressed: suppressionRows.data?.length ?? 0 },
    };
  });

const templateSchema = z.object({
  slug: z.string().min(3).max(100).regex(/^[a-z0-9-]+$/),
  name: z.string().min(2).max(120),
  category: z.enum(["transactional", "marketing"]),
  subject: z.string().min(2).max(200),
  htmlBody: z.string().min(10).max(50000),
  textBody: z.string().max(20000).optional(),
});
export const saveEmailTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => templateSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertEmailAdmin(context.userId, context.supabase);
    const db = await getAdminDb();
    const { data: existing, error: lookupError } = await db.from("email_templates")
      .select("id,version").eq("slug", data.slug).maybeSingle();
    if (lookupError) throw new Error("Unable to check the existing template.");
    const values = {
      name: data.name, category: data.category, subject: data.subject,
      html_body: data.htmlBody, text_body: data.textBody ?? null,
      is_active: true, version: (existing?.version ?? 0) + 1,
      updated_at: new Date().toISOString(), created_by: context.userId,
    };
    const query = existing
      ? db.from("email_templates").update(values).eq("id", existing.id)
      : db.from("email_templates").insert({ ...values, slug: data.slug });
    const { error } = await query;
    if (error) throw new Error("Unable to save email template.");
    return { ok: true };
  });

export const setEmailAutomationEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ id: z.string().uuid(), enabled: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertEmailAdmin(context.userId, context.supabase);
    const db = await getAdminDb();
    const { error } = await db.from("email_automations")
      .update({ is_enabled: data.enabled, updated_at: new Date().toISOString() }).eq("id", data.id);
    if (error) throw new Error("Unable to update automation.");
    return { ok: true };
  });

export const createEmailCampaignDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({
    name: z.string().min(2).max(120), subject: z.string().min(2).max(200),
    htmlBody: z.string().min(10).max(50000),
    audience: z.enum(["advertiser", "publisher", "both"]),
    segment: z.record(z.string(), z.unknown()).optional(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    await assertEmailAdmin(context.userId, context.supabase);
    const db = await getAdminDb();
    const { error } = await db.from("email_campaigns").insert({
      name: data.name, subject: data.subject, html_body: data.htmlBody,
      audience: data.audience, segment: data.segment ?? {}, status: "draft",
      created_by: context.userId,
    });
    if (error) throw new Error("Unable to save campaign draft.");
    return { ok: true };
  });

export const sendEmailCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ campaignId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertEmailAdmin(context.userId, context.supabase);
    const { queueEmailCampaign } = await import("@/lib/email-delivery.server");
    return queueEmailCampaign(data.campaignId);
  });

export const createEmailAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({
    slug: z.string().min(3).max(100).regex(/^[a-z0-9-]+$/),
    name: z.string().min(2).max(120), description: z.string().max(500).optional(),
    audience: z.enum(["advertiser", "publisher", "both"]),
    triggerEvent: z.string().min(3).max(120),
    category: z.enum(["transactional", "marketing"]),
    templateSlug: z.string().min(3).max(100),
    delayMinutes: z.number().int().min(0).max(525600),
  }).parse(data))
  .handler(async ({ data, context }) => {
    await assertEmailAdmin(context.userId, context.supabase);
    const db = await getAdminDb();
    const { data: template, error: templateError } = await db.from("email_templates")
      .select("id,category").eq("slug", data.templateSlug).eq("is_active", true).maybeSingle();
    if (templateError || !template || template.category !== data.category) throw new Error("Choose an active template with the same email category.");
    const { data: automation, error } = await db.from("email_automations").insert({
      slug: data.slug, name: data.name, description: data.description ?? null,
      audience: data.audience, trigger_event: data.triggerEvent, category: data.category,
      is_enabled: false, created_by: context.userId,
    }).select("id").single();
    if (error) throw new Error("Unable to create automation.");
    const { error: stepError } = await db.from("email_automation_steps").insert({
      automation_id: automation.id, step_order: 1, delay_minutes: data.delayMinutes,
      template_id: template.id, is_enabled: true,
    });
    if (stepError) {
      await db.from("email_automations").delete().eq("id", automation.id);
      throw new Error("Unable to create automation step.");
    }
    return { ok: true };
  });

export const updateEmailCampaignStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({
    campaignId: z.string().uuid(), status: z.enum(["scheduled", "paused", "cancelled"]),
    scheduledAt: z.string().datetime().optional(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    await assertEmailAdmin(context.userId, context.supabase);
    const db = await getAdminDb();
    const { error } = await db.from("email_campaigns").update({
      status: data.status, scheduled_at: data.scheduledAt ?? null, updated_at: new Date().toISOString(),
    }).eq("id", data.campaignId);
    if (error) throw new Error("Unable to update campaign.");
    if (data.status === "cancelled" || data.status === "paused") {
      await db.from("email_queue").update({ status: "cancelled", last_error: "Campaign " + data.status + " by an administrator." })
        .like("idempotency_key", "campaign:" + data.campaignId + ":%").eq("status", "queued");
      await db.from("email_campaign_recipients").update({ status: "skipped" })
        .eq("campaign_id", data.campaignId).in("status", ["pending", "queued"]);
    }
    return { ok: true };
  });

export const removeEmailSuppression = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ email: z.string().email() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertEmailAdmin(context.userId, context.supabase);
    const db = await getAdminDb();
    const { error } = await db.from("email_suppressions").delete().eq("email", data.email.toLowerCase());
    if (error) throw new Error("Unable to remove suppression.");
    return { ok: true };
  });
