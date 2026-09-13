import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";

import { AdEditDialog } from "@/components/advertiser/ad-edit-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable, type DataTableColumn } from "@/components/patterns/data-table";
import { ErrorState, LoadingState } from "@/components/patterns/states";
import { StatusBadge, type StatusTone } from "@/components/patterns/status-badge";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import { useAdvertiserAds, useAdvertiserOrg, useCreatives } from "@/hooks/use-advertiser";
import { type AdFormat, type MediaAsset } from "@/lib/advertiser-domain";

export const Route = createFileRoute("/_authenticated/advertiser/advertisements")({
  head: () => ({ meta: [
    { title: "Advertisements — Advertiser — TradeMall" },
    { name: "description", content: "Individual ads, their zones and bidding configuration." },
    { property: "og:title", content: "Advertisements — Advertiser — TradeMall" },
    { property: "og:description", content: "Individual ads, their zones and bidding configuration." },
    { name: "robots", content: "noindex" },
  ] }),
  component: Page,
});

type AdRow = {
  id: string; name: string; campaignName: string; adGroupName: string; format: AdFormat; status: string; approvalStatus: string;
  destinationUrl: string; media_asset_id: string | null; brand_name: string | null; logo_media_asset_id: string | null;
  headlines: unknown; long_headline: string | null; descriptions: unknown; cta: string | null; tracking_url: string | null;
  optimization: string | null; createdAt: string;
};

const FORMAT_LABELS: Record<string, string> = {
  "300x250": "Medium Rectangle", "336x280": "Large Rectangle", "728x90": "Leaderboard", "970x250": "Billboard",
  "320x50": "Mobile Banner", "320x100": "Large Mobile Banner", responsive: "Responsive",
};
const STATUS_TONE: Record<string, StatusTone> = { active: "active", pending: "pending", suspended: "suspended" };
const APPROVAL_TONE: Record<string, StatusTone> = { approved: "active", pending: "pending", rejected: "suspended" };

function Page() {
  const { organizationId } = useAdvertiserOrg();
  const { data, isLoading, error, refetch } = useAdvertiserAds(organizationId);
  const { data: mediaAssetsData } = useCreatives(organizationId);
  const mediaAssets = (mediaAssetsData ?? []) as MediaAsset[];
  const [search, setSearch] = useState("");
  const [formatFilter, setFormatFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editRequest, setEditRequest] = useState<{ adId: string; creativeId: string } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const adId = params.get("editAd");
    const creativeId = params.get("creative");
    if (adId && creativeId) {
      setEditRequest({ adId, creativeId });
      window.history.replaceState({}, "", "/advertiser/advertisements");
    }
  }, []);

  const rows = useMemo(() => {
    const raw = (data ?? []) as Array<{
      id: string; name: string; format: AdFormat; status: string; approval_status: string; destination_url: string;
      media_asset_id: string | null; brand_name: string | null; logo_media_asset_id: string | null; headlines: unknown;
      long_headline: string | null; descriptions: unknown; cta: string | null; tracking_url: string | null; optimization: string | null;
      created_at: string; campaigns: { id: string; name: string; status: string } | null; ad_groups: { id: string; name: string } | null;
    }>;
    return raw.filter((row) => {
      const term = search.toLowerCase();
      if (term && !row.name.toLowerCase().includes(term) && !row.destination_url.toLowerCase().includes(term) && !(row.campaigns?.name ?? "").toLowerCase().includes(term)) return false;
      if (formatFilter !== "all" && row.format !== formatFilter) return false;
      if (statusFilter === "active" && row.status !== "active") return false;
      if (statusFilter === "pending" && row.status !== "pending") return false;
      if (statusFilter === "suspended" && row.status !== "suspended") return false;
      if (statusFilter === "rejected" && row.approval_status !== "rejected") return false;
      return true;
    }).map((row) => ({
      id: row.id, name: row.name, campaignName: row.campaigns?.name ?? "—", adGroupName: row.ad_groups?.name ?? "—",
      format: row.format, status: row.status, approvalStatus: row.approval_status, destinationUrl: row.destination_url,
      media_asset_id: row.media_asset_id, brand_name: row.brand_name, logo_media_asset_id: row.logo_media_asset_id,
      headlines: row.headlines, long_headline: row.long_headline, descriptions: row.descriptions, cta: row.cta,
      tracking_url: row.tracking_url, optimization: row.optimization, createdAt: row.created_at,
    }));
  }, [data, search, formatFilter, statusFilter]);

  const columns: DataTableColumn<AdRow>[] = [
    { id: "name", header: "Name", cell: (row) => row.name },
    { id: "campaign", header: "Campaign", cell: (row) => row.campaignName },
    { id: "adGroup", header: "Ad group", cell: (row) => row.adGroupName },
    { id: "format", header: "Format", cell: (row) => FORMAT_LABELS[row.format] ?? row.format },
    { id: "status", header: "Status", cell: (row) => <StatusBadge tone={STATUS_TONE[row.status] ?? "neutral"}>{row.status}</StatusBadge> },
    { id: "approval", header: "Approval", cell: (row) => <StatusBadge tone={APPROVAL_TONE[row.approvalStatus] ?? "neutral"}>{row.approvalStatus}</StatusBadge> },
    { id: "created", header: "Created", cell: (row) => new Date(row.createdAt).toLocaleDateString() },
    {
      id: "actions", header: "Actions", cell: (row) => (
        <AdEditDialog
          ad={{ id: row.id, name: row.name, format: row.format, destination_url: row.destinationUrl, media_asset_id: row.media_asset_id,
            brand_name: row.brand_name, logo_media_asset_id: row.logo_media_asset_id, headlines: row.headlines,
            long_headline: row.long_headline, descriptions: row.descriptions, cta: row.cta, tracking_url: row.tracking_url,
            optimization: row.optimization }}
          mediaAssets={mediaAssets}
          autoOpen={editRequest?.adId === row.id}
          selectedCreativeId={editRequest?.adId === row.id ? editRequest.creativeId : null}
        />
      ),
    },
  ];

  return (
    <WorkspaceGuard workspace="advertiser">
      <PageHeader eyebrow="Advertiser" title="Advertisements" description="Individual ads, their zones and bidding configuration." />
      {isLoading ? <LoadingState rows={4} label="Loading advertisements" /> : error ? (
        <ErrorState title="Couldn't load advertisements" message={(error as Error).message} onRetry={() => void refetch()} />
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[200px] max-w-sm flex-1"><Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search ads..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" /></div>
            <Select value={formatFilter} onValueChange={setFormatFilter}><SelectTrigger className="w-[180px]"><SelectValue placeholder="All formats" /></SelectTrigger><SelectContent><SelectItem value="all">All formats</SelectItem>{Object.entries(FORMAT_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-[160px]"><SelectValue placeholder="All statuses" /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="suspended">Suspended</SelectItem><SelectItem value="rejected">Rejected</SelectItem></SelectContent></Select>
          </div>
          <section className="mt-6"><DataTable columns={columns} rows={rows} rowKey={(row) => row.id} isLoading={isLoading} error={null} emptyTitle="No advertisements yet" emptyDescription="Create a campaign and add ads to start delivering." caption="Advertisements" /></section>
        </>
      )}
    </WorkspaceGuard>
  );
}
