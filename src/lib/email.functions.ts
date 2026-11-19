import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const db = supabaseAdmin as any;
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
    const [templates, automations, campaigns, queue, logs, queued, sent, failed, suppressions] = await Promise.all([
      db.from("email_templates").select("*").order("updated_at", { ascending: false }),
      db.from("email_automations").select("*, email_automation_steps(id,step_order,delay_minutes,template_id,is_enabled)").order("created_at", { ascending: false }),
      db.from("email_campaigns").select("*").order("created_at", { ascending: false }).limit(50),
      db.from("email_queue").select("id,recipient_email,category,status,scheduled_at,attempts,last_error,created_at").order("created_at", { ascending: false }).limit(50),
      db.from("email_logs").select("id,recipient_email,category,event_type,provider_message_id,occurred_at").order("occurred_at", { ascending: false }).limit(100),
      db.from("email_queue").select("id", { count: "exact", head: true }).eq("status", "queued"),
      db.from("email_queue").select("id", { count: "exact", head: true }).eq("status", "sent"),
      db.from("email_queue").select("id", { count: "exact", head: true }).eq("status", "failed"),
      db.from("email_suppressions").select("email", { count: "exact", head: true }),
    ]);
    for (const result of [templates, automations, campaigns, queue, logs, queued, sent, failed, suppressions]) {
      if (result.error) throw new Error("Unable to load email workspace data.");
    }
    return {
      templates: templates.data ?? [], automations: automations.data ?? [],
      campaigns: campaigns.data ?? [], queue: queue.data ?? [], logs: logs.data ?? [],
      metrics: { queued: queued.count ?? 0, sent: sent.count ?? 0, failed: failed.count ?? 0, suppressed: suppressions.count ?? 0 },
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
    const { error } = await db.from("email_campaigns").insert({
      name: data.name, subject: data.subject, html_body: data.htmlBody,
      audience: data.audience, segment: data.segment ?? {}, status: "draft",
      created_by: context.userId,
    });
    if (error) throw new Error("Unable to save campaign draft.");
    return { ok: true };
  });
