import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, type DataTableColumn } from "@/components/patterns/data-table";
import { PageHeader } from "@/components/patterns/page-header";
import { ErrorState, LoadingState } from "@/components/patterns/states";
import { StatusBadge } from "@/components/patterns/status-badge";
import { AdDialog } from "@/components/advertiser/ad-dialog";
import { AiAdCreativeAssistant } from "@/components/advertiser/ai-ad-creative-assistant";
import { TargetingForm } from "@/components/advertiser/targeting-form";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import {
  useAdvertiserOrg,
  useAdvertiserProfile,
  useCampaignDetail,
  useCreateAdGroup,
  useSetAdGroupStatus,
  useSetAdStatus,
  useSetCampaignStatus,
} from "@/hooks/use-advertiser";
import { useBillingSettings } from "@/hooks/use-billing";
import {
  allowedTransitions,
  campaignStatusLabel,
  campaignStatusTone,
  formatCurrency,
  objectiveLabel,
} from "@/lib/advertiser-domain";
import { toFriendlyError } from "@/lib/errors";
import type { fetchCampaignDetail } from "@/lib/advertiser.functions";

type CampaignDetail = Awaited<ReturnType<typeof fetchCampaignDetail>>;

export const Route = createFileRoute("/_authenticated/advertiser/campaigns/$campaignId")({
  head: () => ({
    meta: [
      { title: "Campaign details — Advertiser — TradeMall" },
      { name: "description", content: "Ad groups, creatives, targeting and delivery status for this campaign." },
      { property: "og:title", content: "Campaign details — Advertiser — TradeMall" },
      { property: "og:description", content: "Ad groups, creatives, targeting and delivery status for this campaign." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CampaignDetailPage,
});

function CampaignDetailPage() {
  const { campaignId } = Route.useParams();
  const billing = useBillingSettings();
  const { data: detail, isLoading, error, refetch } = useCampaignDetail(campaignId);

  if (isLoading) return <WorkspaceGuard workspace="advertiser"><LoadingState rows={3} label="Loading campaign" /></WorkspaceGuard>;
  if (error || !detail) return <WorkspaceGuard workspace="advertiser"><ErrorState title="Couldn't load campaign" message={error ? toFriendlyError(error).message : "That campaign doesn't exist or you don't have access to it."} onRetry={() => void refetch()} /></WorkspaceGuard>;
  return <WorkspaceGuard workspace="advertiser"><CampaignDetailView detail={detail} currency={billing.data?.currency ?? "USD"} /></WorkspaceGuard>;
}

function CampaignDetailView({ detail, currency }: { detail: CampaignDetail; currency: string }) {
  const { campaign, adGroups, ads, targeting, mediaAssets } = detail;
  const { organizationId } = useAdvertiserOrg();
  const { data: profile } = useAdvertiserProfile(organizationId);
  const setCampaignStatus = useSetCampaignStatus();
  const locked = campaign.status !== "draft" && campaign.status !== "rejected";
  const transitions = allowedTransitions(campaign.status, "advertiser");

  return (
    <div className="space-y-6">
      <Button asChild size="sm" variant="ghost" className="-ml-2 w-fit"><Link to="/advertiser/campaigns"><ArrowLeft className="size-4" /> All campaigns</Link></Button>
      <PageHeader eyebrow="Campaign" title={campaign.name} description={`${objectiveLabel(campaign.objective)} · ${campaign.bid_type.toUpperCase()} ${formatCurrency(campaign.bid_amount, currency)}`} actions={<div className="flex flex-wrap items-center gap-2"><StatusBadge tone={campaignStatusTone(campaign.status)}>{campaignStatusLabel(campaign.status)}</StatusBadge>{transitions.map((next) => <Button key={next} size="sm" variant={next === "pending_review" ? "default" : "outline"} disabled={setCampaignStatus.isPending} onClick={async () => { try { await setCampaignStatus.mutateAsync({ campaignId: campaign.id, status: next }); toast.success(`Campaign moved to ${campaignStatusLabel(next)}.`); } catch (mutationError) { toast.error(toFriendlyError(mutationError).message); } }}>{next === "pending_review" ? "Submit for review" : campaignStatusLabel(next)}</Button>)}</div>} />
      {campaign.rejection_reason ? <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">Review feedback: {campaign.rejection_reason}</p> : null}
      {campaign.status === "paused" && campaign.pause_reason === "insufficient_funds" ? <p className="rounded-md border border-orange-500/30 bg-orange-50 p-3 text-sm text-orange-700 dark:bg-orange-950 dark:text-orange-300">Paused — insufficient wallet balance. Add funds to resume this campaign.</p> : null}
      <Tabs defaultValue="overview">
        <TabsList><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="ad-groups">Ad groups</TabsTrigger><TabsTrigger value="ads">Ads</TabsTrigger><TabsTrigger value="targeting">Targeting</TabsTrigger></TabsList>
        <TabsContent value="overview" className="pt-5"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><MetricCard label="Total budget" value={formatCurrency(campaign.total_budget, currency)} /><MetricCard label="Daily budget" value={campaign.daily_budget ? formatCurrency(campaign.daily_budget, currency) : "Not set"} /><MetricCard label="Ad groups" value={String(adGroups.length)} /><MetricCard label="Ads" value={String(ads.length)} /></div><Card className="mt-4 shadow-none"><CardHeader><CardTitle className="text-base">Flight & destination</CardTitle><CardDescription>Schedule and landing page for this campaign.</CardDescription></CardHeader><CardContent className="grid gap-3 text-sm sm:grid-cols-2"><DetailRow label="Starts" value={campaign.start_date ?? "Immediately"} /><DetailRow label="Ends" value={campaign.end_date ?? "No end date"} /><DetailRow label="Landing page" value={campaign.landing_page_url ?? "—"} /><DetailRow label="Approval" value={campaign.approval_status} /></CardContent></Card></TabsContent>
        <TabsContent value="ad-groups" className="pt-5"><AdGroupsTab campaignId={campaign.id} adGroups={adGroups} locked={locked} /></TabsContent>
        <TabsContent value="ads" className="pt-5"><AdsTab campaignId={campaign.id} organizationId={campaign.organization_id} advertiserId={profile?.id ?? campaign.advertiser_id} websiteUrl={campaign.landing_page_url ?? ""} brandName={profile?.business_name ?? ""} adGroups={adGroups} ads={ads} mediaAssets={mediaAssets} locked={locked} /></TabsContent>
        <TabsContent value="targeting" className="pt-5"><TargetingForm campaignId={campaign.id} targeting={targeting} readOnly={locked} /></TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) { return <div className="panel p-4"><p className="text-eyebrow">{label}</p><p className="text-numeric mt-1 text-xl font-semibold">{value}</p></div>; }
function DetailRow({ label, value }: { label: string; value: string }) { return <div className="space-y-0.5"><p className="text-eyebrow">{label}</p><p className="break-words">{value}</p></div>; }

function AdGroupsTab({ campaignId, adGroups, locked }: { campaignId: string; adGroups: CampaignDetail["adGroups"]; locked: boolean }) {
  const createGroup = useCreateAdGroup();
  const setGroupStatus = useSetAdGroupStatus();
  const [name, setName] = useState("");
  const columns: DataTableColumn<CampaignDetail["adGroups"][number]>[] = [
    { id: "name", header: "Ad group", cell: (group) => group.name },
    { id: "status", header: "Status", cell: (group) => <StatusBadge tone={group.status === "active" ? "active" : "suspended"}>{group.status}</StatusBadge> },
    { id: "actions", header: "", align: "right", cell: (group) => <Button size="sm" variant="ghost" disabled={setGroupStatus.isPending} onClick={() => void setGroupStatus.mutateAsync({ adGroupId: group.id, status: group.status === "active" ? "suspended" : "active" })}>{group.status === "active" ? "Suspend" : "Activate"}</Button> },
  ];
  return <div className="space-y-4">{!locked ? <form className="flex flex-col gap-2 sm:flex-row" onSubmit={async (event) => { event.preventDefault(); if (name.trim().length < 2) { toast.error("Give the ad group a name."); return; } try { await createGroup.mutateAsync({ campaignId, name: name.trim() }); setName(""); toast.success("Ad group created."); } catch (mutationError) { toast.error(toFriendlyError(mutationError).message); } }}><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="New ad group name" aria-label="New ad group name" className="sm:max-w-sm" /><Button type="submit" size="sm" disabled={createGroup.isPending}>Add ad group</Button></form> : null}<DataTable columns={columns} rows={adGroups} rowKey={(group) => group.id} emptyTitle="No ad groups yet" emptyDescription="Ad groups organise the ads inside this campaign." /></div>;
}

function AdsTab({ campaignId, organizationId, advertiserId, websiteUrl, brandName, adGroups, ads, mediaAssets, locked }: { campaignId: string; organizationId: string; advertiserId: string; websiteUrl: string; brandName: string; adGroups: CampaignDetail["adGroups"]; ads: CampaignDetail["ads"]; mediaAssets: CampaignDetail["mediaAssets"]; locked: boolean }) {
  const setAdStatus = useSetAdStatus();
  const columns: DataTableColumn<CampaignDetail["ads"][number]>[] = [
    { id: "name", header: "Ad", cell: (ad) => ad.name },
    { id: "format", header: "Format", cell: (ad) => ad.format },
    { id: "approval", header: "Approval", cell: (ad) => <StatusBadge tone={ad.approval_status === "approved" ? "active" : ad.approval_status === "rejected" ? "suspended" : "pending"}>{ad.approval_status}</StatusBadge> },
    { id: "status", header: "Status", cell: (ad) => <StatusBadge tone={ad.status === "active" ? "active" : "suspended"}>{ad.status}</StatusBadge> },
    { id: "actions", header: "", align: "right", cell: (ad) => <Button size="sm" variant="ghost" disabled={setAdStatus.isPending} onClick={() => void setAdStatus.mutateAsync({ adId: ad.id, status: ad.status === "active" ? "suspended" : "active" })}>{ad.status === "active" ? "Suspend" : "Activate"}</Button> },
  ];
  return <div className="space-y-4">
    {adGroups.length > 0 ? <AiAdCreativeAssistant organizationId={organizationId} campaignId={campaignId} adGroupId={adGroups[0].id} websiteUrl={websiteUrl} brandName={brandName} /> : null}
    <div className="flex items-center justify-between gap-4"><div className="space-y-0.5"><p className="text-sm font-medium">Ads</p><p className="text-xs text-muted-foreground">Creatives and destinations reviewed by the platform.</p></div>{adGroups.length > 0 ? <AdDialog campaignId={campaignId} organizationId={organizationId} advertiserId={advertiserId} adGroups={adGroups.map((group) => ({ id: group.id, name: group.name }))} mediaAssets={mediaAssets} disabled={locked} /> : null}</div>
    <DataTable columns={columns} rows={ads} rowKey={(ad) => ad.id} emptyTitle="No ads yet" emptyDescription={adGroups.length === 0 ? "Create an ad group first, then add ads to it." : "Add your first ad creative."} />
  </div>;
}
