import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Send, FileText, Workflow, Megaphone, ListChecks, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/patterns/page-header";
import { LoadingState, ErrorState } from "@/components/patterns/states";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import { getEmailAdminData, saveEmailTemplate, setEmailAutomationEnabled, createEmailCampaignDraft, sendEmailCampaign, createEmailAutomation, scheduleEmailCampaign, updateEmailCampaignStatus, removeEmailSuppression, sendEmailTemplateTest, retryFailedEmail, retryFailedEmails } from "@/lib/email.functions";

export const Route = createFileRoute("/_authenticated/admin/email")({
  head: () => ({ meta: [{ title: "Email — Platform Admin — TradeMall" }, { name: "robots", content: "noindex" }] }),
  component: EmailWorkspace,
});

type Template = { slug: string; name: string; category: "transactional" | "marketing"; subject: string; html_body: string; text_body?: string | null; is_active: boolean; version: number };
function EmailWorkspace() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("overview");
  const query = useQuery({ queryKey: ["admin-email-workspace"], queryFn: () => getEmailAdminData() });
  const [template, setTemplate] = useState({ slug: "", name: "", category: "transactional" as "transactional" | "marketing", subject: "", htmlBody: "<div><h1>Hello {{firstName}}</h1><p>Your message here.</p></div>", textBody: "" });
  const [testRecipient, setTestRecipient] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState(new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0,16));
  const [automation, setAutomation] = useState({ slug: "", name: "", audience: "both" as "advertiser"|"publisher"|"both", triggerEvent: "", category: "transactional" as "transactional"|"marketing", templateSlug: "", delayMinutes: 0 });
  const [campaign, setCampaign] = useState({ name: "", subject: "", audience: "both" as "advertiser" | "publisher" | "both", htmlBody: "<div><h1>TradeMall update</h1><p>Your campaign message.</p></div>" });
  const testTemplate = useMutation({ mutationFn: (templateSlug: string) => sendEmailTemplateTest({ data: { templateSlug, recipient: testRecipient } }), });
  const saveTemplate = useMutation({ mutationFn: () => saveEmailTemplate({ data: template }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-email-workspace"] }) });
  const saveCampaign = useMutation({ mutationFn: () => createEmailCampaignDraft({ data: campaign }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-email-workspace"] }) });
  const sendCampaign = useMutation({ mutationFn: (campaignId: string) => sendEmailCampaign({ data: { campaignId } }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-email-workspace"] }) });
  const saveAutomation = useMutation({ mutationFn: () => createEmailAutomation({ data: automation }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-email-workspace"] }) });
  const scheduleCampaign = useMutation({ mutationFn: (campaignId: string) => scheduleEmailCampaign({ data: { campaignId, scheduledAt: new Date(scheduleAt).toISOString() } }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-email-workspace"] }) });
  const changeCampaignStatus = useMutation({ mutationFn: (input: {campaignId:string;status:"paused"|"cancelled"}) => updateEmailCampaignStatus({ data: input }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-email-workspace"] }) });
  const retryOne = useMutation({ mutationFn: (id: string) => retryFailedEmail({ data: { id } }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-email-workspace"] }) });
  const retryBatch = useMutation({ mutationFn: () => retryFailedEmails({ data: { limit: 100 } }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-email-workspace"] }) });
  const removeSuppression = useMutation({ mutationFn: (email:string) => removeEmailSuppression({ data: {email} }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-email-workspace"] }) });
  const toggleAutomation = useMutation({ mutationFn: (input: { id: string; enabled: boolean }) => setEmailAutomationEnabled({ data: input }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-email-workspace"] }) });
  const data = query.data;
  const templates = useMemo(() => data?.templates ?? [], [data]);
  if (query.isLoading) return <WorkspaceGuard workspace="admin"><LoadingState rows={5} label="Loading email workspace" /></WorkspaceGuard>;
  if (query.error || !data) return <WorkspaceGuard workspace="admin"><ErrorState title="Couldn't load email workspace" message={query.error?.message ?? "Please try again."} onRetry={() => void query.refetch()} /></WorkspaceGuard>;

  const tabs = [
    ["overview", "Overview", Mail], ["templates", "Templates", FileText], ["automations", "Automations", Workflow],
    ["campaigns", "Campaigns", Megaphone], ["queue", "Queue & logs", ListChecks], ["suppression", "Suppressions", ShieldAlert],
  ] as const;
  return <WorkspaceGuard workspace="admin">
    <PageHeader eyebrow="Platform Admin" title="Email workspace" description="Manage transactional notifications, lifecycle automations, broadcasts and delivery health." />
    <div className="flex flex-wrap gap-2 border-b pb-3">
      {tabs.map(([key,label,Icon]) => <Button key={key} size="sm" variant={tab === key ? "default" : "outline"} onClick={() => setTab(key)}><Icon className="mr-2 size-4" />{label}</Button>)}
    </div>
    {tab === "overview" && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric title="Queued" value={data.metrics.queued} note="Waiting for worker" />
      <Metric title="Sent" value={data.metrics.sent} note="Accepted by Resend" />
      <Metric title="Delivered" value={data.metrics.delivered} note="Confirmed by Resend webhook" />
      <Metric title="Processing" value={data.metrics.processing} note="Currently claimed by worker" />
      <Metric title="Failed" value={data.metrics.failed} note="Terminal failures" />
      <Metric title="Suppressed" value={data.metrics.suppressed} note="Bounced or complained" />
      <Card className="sm:col-span-2 xl:col-span-4"><CardHeader><CardTitle className="text-base">Delivery setup</CardTitle></CardHeader><CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>Queue worker: POST /api/worker/email-delivery (Bearer EMAIL_WORKER_SECRET)</p>
        <p>Resend webhook: POST /api/webhooks/resend (signed with RESEND_WEBHOOK_SECRET)</p>
        <p>Schedule the worker every minute. Marketing messages require an explicit email_preferences consent record.</p>
      </CardContent></Card>
    </div>}
    {tab === "templates" && <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
      <Card><CardHeader><CardTitle className="text-base">Template library</CardTitle></CardHeader><CardContent className="space-y-3">
        <Input type="email" placeholder="Test recipient email" value={testRecipient} onChange={e => setTestRecipient(e.target.value)} />
        {templates.map((item: Template) => <div key={item.slug} className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <div className="min-w-0"><p className="truncate font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.slug} · {item.category} · v{item.version}</p></div>
          <div className="flex gap-2"><Button size="sm" variant="outline" disabled={!testRecipient || testTemplate.isPending} onClick={() => testTemplate.mutate(item.slug)}>Test</Button><Button size="sm" variant="outline" onClick={() => setTemplate({ slug: item.slug, name: item.name, category: item.category, subject: item.subject, htmlBody: item.html_body, textBody: item.text_body ?? "" })}>Edit</Button></div>
        </div>)}
        {testTemplate.error && <p className="text-sm text-destructive">{testTemplate.error.message}</p>}{testTemplate.isSuccess && <p className="text-sm text-muted-foreground">Test message accepted by Resend.</p>}
        {templates.length === 0 && <p className="text-sm text-muted-foreground">No templates created yet.</p>}
      </CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">Create or update template</CardTitle></CardHeader><CardContent className="space-y-3">
        <Input placeholder="template-slug" value={template.slug} onChange={e => setTemplate(v => ({...v,slug:e.target.value}))} />
        <Input placeholder="Template name" value={template.name} onChange={e => setTemplate(v => ({...v,name:e.target.value}))} />
        <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={template.category} onChange={e => setTemplate(v => ({...v,category:e.target.value as "transactional"|"marketing"}))}><option value="transactional">Transactional</option><option value="marketing">Marketing</option></select>
        <Input placeholder="Email subject" value={template.subject} onChange={e => setTemplate(v => ({...v,subject:e.target.value}))} />
        <Textarea rows={8} value={template.htmlBody} onChange={e => setTemplate(v => ({...v,htmlBody:e.target.value}))} />
        <Textarea rows={3} placeholder="Plain text fallback (optional)" value={template.textBody} onChange={e => setTemplate(v => ({...v,textBody:e.target.value}))} />
        <Button type="button" variant="outline" onClick={() => setPreviewOpen(v => !v)}>{previewOpen ? "Hide preview" : "Preview email"}</Button>
        {previewOpen && <div className="space-y-2 rounded-lg border p-3"><p className="text-sm font-medium">Subject: {template.subject || "(no subject)"}</p><iframe title="Email template preview" sandbox="" srcDoc={template.htmlBody.replace(/{{\s*firstName\s*}}/g, "TradeMall user")} className="h-80 w-full rounded-md bg-white" /></div>}
        <p className="text-xs text-muted-foreground">Variables use double braces, e.g. {"{{firstName}}"}. Values are HTML-escaped.</p>
        <Button disabled={saveTemplate.isPending} onClick={() => saveTemplate.mutate()}><Send className="mr-2 size-4" />{saveTemplate.isPending ? "Saving…" : "Save and activate"}</Button>
        {saveTemplate.error && <p className="text-sm text-destructive">{saveTemplate.error.message}</p>}
      </CardContent></Card>
    </div>}
    {tab === "automations" && <Card><CardHeader><CardTitle className="text-base">Lifecycle automations</CardTitle></CardHeader><CardContent className="space-y-3">
      <div className="grid gap-3 rounded-lg border p-4 md:grid-cols-2">
        <Input placeholder="automation-slug" value={automation.slug} onChange={e => setAutomation(v => ({...v,slug:e.target.value}))} />
        <Input placeholder="Automation name" value={automation.name} onChange={e => setAutomation(v => ({...v,name:e.target.value}))} />
        <Input placeholder="Trigger event, e.g. advertiser.profile.created" value={automation.triggerEvent} onChange={e => setAutomation(v => ({...v,triggerEvent:e.target.value}))} />
        <Input placeholder="Template slug" value={automation.templateSlug} onChange={e => setAutomation(v => ({...v,templateSlug:e.target.value}))} />
        <select className="h-10 rounded-md border bg-background px-3 text-sm" value={automation.audience} onChange={e => setAutomation(v => ({...v,audience:e.target.value as any}))}><option value="both">Both audiences</option><option value="advertiser">Advertisers</option><option value="publisher">Publishers</option></select>
        <select className="h-10 rounded-md border bg-background px-3 text-sm" value={automation.category} onChange={e => setAutomation(v => ({...v,category:e.target.value as any}))}><option value="transactional">Transactional</option><option value="marketing">Marketing</option></select>
        <Input type="number" min="0" placeholder="Delay in minutes" value={automation.delayMinutes} onChange={e => setAutomation(v => ({...v,delayMinutes:Number(e.target.value)}))} />
        <Button disabled={saveAutomation.isPending} onClick={() => saveAutomation.mutate()}>Create paused automation</Button>
        {saveAutomation.error && <p className="text-sm text-destructive">{saveAutomation.error.message}</p>}
      </div>
      {(data.automations ?? []).map((item: any) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
        <div><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.trigger_event} · {item.audience} · {item.email_automation_steps?.length ?? 0} steps</p></div>
        <Button size="sm" variant={item.is_enabled ? "default" : "outline"} disabled={toggleAutomation.isPending} onClick={() => toggleAutomation.mutate({id:item.id,enabled:!item.is_enabled})}>{item.is_enabled ? "Enabled · Pause" : "Paused · Enable"}</Button>
      </div>)}
      {(data.automations ?? []).length === 0 && <p className="text-sm text-muted-foreground">No automations seeded yet. Automation controls will appear here as event journeys are added.</p>}
    </CardContent></Card>}
    {tab === "campaigns" && <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
      <Card><CardHeader><CardTitle className="text-base">Campaign drafts</CardTitle></CardHeader><CardContent className="space-y-3">
        {(data.campaigns ?? []).map((item: any) => <div key={item.id} className="space-y-2 rounded-lg border p-3"><div><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.subject} · {item.audience} · {item.status}{item.scheduled_at ? " · " + new Date(item.scheduled_at).toLocaleString() : ""}</p></div><div className="flex flex-wrap gap-2">{["draft","paused","scheduled"].includes(item.status) && <Button size="sm" onClick={() => sendCampaign.mutate(item.id)}>Send now to opted-in audience</Button>}{["draft","paused"].includes(item.status) && <Button size="sm" variant="outline" onClick={() => scheduleCampaign.mutate(item.id)}>Schedule at selected time</Button>}{["sending","scheduled"].includes(item.status) && <Button size="sm" variant="outline" onClick={() => changeCampaignStatus.mutate({campaignId:item.id,status:"paused"})}>Pause</Button>}{!["sent","cancelled"].includes(item.status) && <Button size="sm" variant="destructive" onClick={() => changeCampaignStatus.mutate({campaignId:item.id,status:"cancelled"})}>Cancel</Button>}</div></div>)}
        {(data.campaigns ?? []).length === 0 && <p className="text-sm text-muted-foreground">No campaigns yet.</p>}
      </CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">Create campaign draft</CardTitle></CardHeader><CardContent className="space-y-3">
        <Input type="datetime-local" value={scheduleAt} onChange={e => setScheduleAt(e.target.value)} />
        <Input placeholder="Campaign name" value={campaign.name} onChange={e => setCampaign(v => ({...v,name:e.target.value}))} />
        <Input placeholder="Subject" value={campaign.subject} onChange={e => setCampaign(v => ({...v,subject:e.target.value}))} />
        <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={campaign.audience} onChange={e => setCampaign(v => ({...v,audience:e.target.value as "advertiser"|"publisher"|"both"}))}><option value="both">Advertisers and publishers</option><option value="advertiser">Advertisers</option><option value="publisher">Publishers</option></select>
        <Textarea rows={8} value={campaign.htmlBody} onChange={e => setCampaign(v => ({...v,htmlBody:e.target.value}))} />
        <Button disabled={saveCampaign.isPending} onClick={() => saveCampaign.mutate()}>{saveCampaign.isPending ? "Saving…" : "Save draft"}</Button>
        {saveCampaign.error && <p className="text-sm text-destructive">{saveCampaign.error.message}</p>}{sendCampaign.error && <p className="text-sm text-destructive">{sendCampaign.error.message}</p>}{sendCampaign.data && <p className="text-sm text-muted-foreground">Queued {sendCampaign.data.queued} opted-in recipients; skipped {sendCampaign.data.skipped}.</p>}
      </CardContent></Card>
    </div>}
    {tab === "queue" && <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div><p className="font-medium">Failed message recovery</p><p className="text-sm text-muted-foreground">Retry up to 100 failed jobs. Consent and suppression checks run again before delivery.</p></div><Button disabled={retryBatch.isPending || data.metrics.failed === 0} onClick={() => retryBatch.mutate()}>{retryBatch.isPending ? "Queueing retries…" : "Retry up to 100 failed"}</Button></div>{retryBatch.error && <p className="text-sm text-destructive">{retryBatch.error.message}</p>}{retryBatch.data && <p className="text-sm text-muted-foreground">Queued {retryBatch.data.retried} failed messages for retry.</p>}<div className="grid gap-5 xl:grid-cols-2"><Rows title="Recent queue items" rows={data.queue ?? []} columns={["recipient_email","category","status","attempts","last_error"]} /><Rows title="Delivery events" rows={data.logs ?? []} columns={["recipient_email","event_type","provider_message_id","occurred_at"]} /></div>{(data.queue ?? []).filter((row: any) => row.status === "failed").map((row: any) => <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div className="min-w-0"><p className="font-medium">{row.recipient_email}</p><p className="text-xs text-muted-foreground">{row.last_error || "No failure detail recorded"} · {row.attempts} attempts</p></div><Button size="sm" variant="outline" disabled={retryOne.isPending} onClick={() => retryOne.mutate(row.id)}>Retry</Button></div>)}{retryOne.error && <p className="text-sm text-destructive">{retryOne.error.message}</p>}</div>}
    {tab === "suppression" && <Card><CardHeader><CardTitle className="text-base">Suppression list · {data.metrics.suppressed}</CardTitle></CardHeader><CardContent className="space-y-2"><p className="text-sm text-muted-foreground">Remove a suppression only after resolving the underlying delivery or complaint issue. A future bounce or complaint will suppress the address again.</p>{(data.suppressions ?? []).map((row:any) => <div key={row.email} className="flex flex-wrap items-center justify-between gap-3 rounded border p-3"><div><p className="font-medium">{row.email}</p><p className="text-xs text-muted-foreground">{row.reason} · {row.source} · {new Date(row.created_at).toLocaleString()}</p></div><Button size="sm" variant="outline" disabled={removeSuppression.isPending} onClick={() => removeSuppression.mutate(row.email)}>Remove suppression</Button></div>)}{(data.suppressions ?? []).length === 0 && <p className="text-sm text-muted-foreground">No suppressed addresses in the latest 100 records.</p>}{removeSuppression.error && <p className="text-sm text-destructive">{removeSuppression.error.message}</p>}</CardContent></Card>}
  </WorkspaceGuard>;
}
function Metric({title,value,note}:{title:string;value:number;note:string}) {
  return <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">{title}</p><p className="mt-1 text-3xl font-semibold tabular-nums">{value.toLocaleString()}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p></CardContent></Card>;
}
function Rows({title,rows,columns}:{title:string;rows:any[];columns:string[]}) {
  return <Card><CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent className="space-y-2">
    {rows.slice(0,30).map((row,i) => <div key={row.id ?? i} className="rounded border p-2 text-xs">{columns.map(key => <p key={key}><span className="text-muted-foreground">{key}: </span>{String(row[key] ?? "—")}</p>)}</div>)}
    {rows.length === 0 && <p className="text-sm text-muted-foreground">No records yet.</p>}
  </CardContent></Card>;
}
