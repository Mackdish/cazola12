import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CampaignReviewDialog } from "@/components/admin/campaign-review-dialog";
import { DataTable, type DataTableColumn } from "@/components/patterns/data-table";
import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/patterns/states";
import { StatusBadge } from "@/components/patterns/status-badge";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import { useAdminCampaigns } from "@/hooks/use-advertiser";
import { useBillingSettings } from "@/hooks/use-billing";
import { fetchAdminCampaigns } from "@/lib/advertiser.functions";
import {
  CAMPAIGN_STATUSES,
  campaignStatusLabel,
  campaignStatusTone,
  formatCurrency,
  objectiveLabel,
  type CampaignSortKey,
  type CampaignStatus,
  type SortDirection,
} from "@/lib/advertiser-domain";

export const Route = createFileRoute("/_authenticated/admin/campaigns")({
  head: () => ({
    meta: [
      { title: "Campaigns — Platform Admin — TradeMall" },
      {
        name: "description",
        content: "Network-wide campaign review, moderation and pacing oversight.",
      },
      { property: "og:title", content: "Campaigns — Platform Admin — TradeMall" },
      {
        property: "og:description",
        content: "Network-wide campaign review, moderation and pacing oversight.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CampaignsPage,
});

const PAGE_SIZE = 10;

type CampaignRow = Awaited<ReturnType<typeof fetchAdminCampaigns>>[number];

function CampaignsPage() {
  const billing = useBillingSettings();
  const { data, isLoading, error, refetch } = useAdminCampaigns();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CampaignStatus | "all">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sortBy, setSortBy] = useState<CampaignSortKey>("created_at");
  const [direction, setDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);

  const rows = useMemo(() => {
    const searchLower = search.trim().toLowerCase();
    let filtered = (data ?? []).filter((row) => {
      const text =
        `${row.name} ${row.organizations?.name ?? ""} ${row.advertisers?.business_name ?? ""}`.toLowerCase();
      if (searchLower && !text.includes(searchLower)) return false;
      if (status !== "all" && row.status !== status) return false;
      if (from && row.created_at.slice(0, 10) < from) return false;
      if (to && row.created_at.slice(0, 10) > to) return false;
      return true;
    });

    filtered = [...filtered].sort((a, b) => {
      const av = a[sortBy] ?? "";
      const bv = b[sortBy] ?? "";
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
      return direction === "asc" ? cmp : -cmp;
    });

    const total = filtered.length;
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const safePage = Math.min(Math.max(1, page), pageCount);
    const start = (safePage - 1) * PAGE_SIZE;
    return { rows: filtered.slice(start, start + PAGE_SIZE), total, page: safePage, pageCount };
  }, [data, search, status, from, to, sortBy, direction, page]);

  const columns: DataTableColumn<CampaignRow>[] = [
    {
      id: "campaign",
      header: "Campaign",
      cell: (row) => (
        <div className="min-w-0">
          <p className="font-medium">{row.name}</p>
          <p className="text-xs text-muted-foreground">{objectiveLabel(row.objective)}</p>
        </div>
      ),
    },
    {
      id: "advertiser",
      header: "Advertiser",
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm">{row.advertisers?.business_name ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{row.organizations?.name ?? "—"}</p>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => (
        <StatusBadge tone={campaignStatusTone(row.status)}>
          {campaignStatusLabel(row.status)}
        </StatusBadge>
      ),
    },
    {
      id: "ads",
      header: "Ads",
      cell: (row) => <span className="text-numeric">{(row.ads ?? []).length}</span>,
    },
    {
      id: "budget",
      header: "Budget",
      align: "right",
      cell: (row) => (
        <span className="text-numeric">{formatCurrency(row.total_budget, billing.data?.currency ?? "USD")}</span>
      ),
    },
    {
      id: "created",
      header: "Created",
      align: "right",
      cell: (row) => <span className="text-numeric">{row.created_at.slice(0, 10)}</span>,
    },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (row) => (
        <CampaignReviewDialog
          campaignId={row.id}
          status={row.status}
          trigger={
            <Button size="sm" variant="outline">
              Review
            </Button>
          }
        />
      ),
    },
  ];

  return (
    <WorkspaceGuard workspace="admin">
      <PageHeader
        eyebrow="Platform Admin"
        title="Campaigns"
        description="Network-wide campaign review, moderation and pacing oversight."
      />

      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search campaigns or advertisers"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value as CampaignStatus | "all");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full md:w-44">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {CAMPAIGN_STATUSES.map((entry) => (
              <SelectItem key={entry.value} value={entry.value}>
                {entry.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          aria-label="Created from"
          value={from}
          onChange={(event) => {
            setFrom(event.target.value);
            setPage(1);
          }}
          className="md:w-40"
        />
        <Input
          type="date"
          aria-label="Created to"
          value={to}
          onChange={(event) => {
            setTo(event.target.value);
            setPage(1);
          }}
          className="md:w-40"
        />
        <Select
          value={`${sortBy}:${direction}`}
          onValueChange={(value) => {
            const [key, dir] = value.split(":");
            setSortBy(key as CampaignSortKey);
            setDirection(dir as SortDirection);
          }}
        >
          <SelectTrigger className="w-full md:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at:desc">Newest first</SelectItem>
            <SelectItem value="created_at:asc">Oldest first</SelectItem>
            <SelectItem value="name:asc">Name A–Z</SelectItem>
            <SelectItem value="name:desc">Name Z–A</SelectItem>
            <SelectItem value="total_budget:desc">Largest budget</SelectItem>
            <SelectItem value="start_date:asc">Earliest start</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <LoadingState rows={4} label="Loading campaigns" />
      ) : error ? (
        <ErrorState
          title="Couldn't load campaigns"
          message={error.message}
          onRetry={() => void refetch()}
        />
      ) : rows.total === 0 ? (
        <EmptyState
          icon={<Sparkles className="size-5" />}
          title={(data ?? []).length === 0 ? "No campaigns yet" : "No campaigns match"}
          description={
            (data ?? []).length === 0
              ? "Campaigns will appear here once advertisers submit them for review."
              : "Try a different search, status or date range."
          }
          action={
            (data ?? []).length === 0 ? null : (
              <Button
                onClick={() => {
                  setSearch("");
                  setStatus("all");
                  setFrom("");
                  setTo("");
                  setPage(1);
                }}
              >
                Clear filters
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-3">
          <DataTable
            columns={columns}
            rows={rows.rows}
            rowKey={(row) => row.id}
            caption="Campaigns"
          />
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Page {rows.page} of {rows.pageCount} · {rows.total} campaigns
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={rows.page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={rows.page >= rows.pageCount}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}
    </WorkspaceGuard>
  );
}
