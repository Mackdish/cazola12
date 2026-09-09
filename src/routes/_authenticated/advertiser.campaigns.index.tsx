import { createFileRoute, Link } from "@tanstack/react-router";
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
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable, type DataTableColumn } from "@/components/patterns/data-table";
import { EmptyState, ErrorState, LoadingState } from "@/components/patterns/states";
import { StatusBadge } from "@/components/patterns/status-badge";
import { CampaignDialog } from "@/components/advertiser/campaign-dialog";
import { AiCopilotDialog } from "@/components/advertiser/ai-copilot-dialog";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import { useAdvertiserOrg, useCampaigns } from "@/hooks/use-advertiser";
import { useBillingSettings } from "@/hooks/use-billing";
import {
  CAMPAIGN_STATUSES,
  campaignStatusLabel,
  campaignStatusTone,
  filterSortPaginateCampaigns,
  formatCurrency,
  objectiveLabel,
  type CampaignSortKey,
  type CampaignStatus,
  type SortDirection,
} from "@/lib/advertiser-domain";

export const Route = createFileRoute("/_authenticated/advertiser/campaigns/")({
  head: () => ({
    meta: [
      { title: "Campaigns — Advertiser — TradeMall" },
      {
        name: "description",
        content: "Budgets, flight dates, targeting and review status for your campaigns.",
      },
      { property: "og:title", content: "Campaigns — Advertiser — TradeMall" },
      {
        property: "og:description",
        content: "Budgets, flight dates, targeting and review status for your campaigns.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CampaignsPage,
});

const PAGE_SIZE = 10;

function CampaignsPage() {
  const { organizationId } = useAdvertiserOrg();
  const billing = useBillingSettings();
  const { data, isLoading, error, refetch } = useCampaigns(organizationId);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CampaignStatus | "all">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sortBy, setSortBy] = useState<CampaignSortKey>("created_at");
  const [direction, setDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);
  const [aiOpen, setAiOpen] = useState(false);

  const result = useMemo(
    () =>
      filterSortPaginateCampaigns(data ?? [], {
        search,
        status,
        from: from || null,
        to: to || null,
        sortBy,
        direction,
        page,
        pageSize: PAGE_SIZE,
      }),
    [data, search, status, from, to, sortBy, direction, page],
  );

  const columns: DataTableColumn<(typeof result.rows)[number]>[] = [
    {
      id: "name",
      header: "Campaign",
      cell: (row) => (
        <Link
          to="/advertiser/campaigns/$campaignId"
          params={{ campaignId: row.id }}
          className="font-medium underline-offset-4 hover:underline"
        >
          {row.name}
        </Link>
      ),
    },
    { id: "objective", header: "Objective", cell: (row) => objectiveLabel(row.objective) },
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
      cell: (row) => <span className="text-numeric">{row.adCount}</span>,
    },
    {
      id: "budget",
      header: "Budget",
      align: "right",
      cell: (row) => (
        <span className="text-numeric">
          {formatCurrency(row.total_budget, billing.data?.currency ?? "USD")}
        </span>
      ),
    },
    {
      id: "created",
      header: "Created",
      align: "right",
      cell: (row) => <span className="text-numeric">{row.created_at.slice(0, 10)}</span>,
    },
  ];

  return (
    <WorkspaceGuard workspace="advertiser">
      <PageHeader
        eyebrow="Advertiser"
        title="Campaigns"
        description="Budgets, flight dates, targeting and review status for your campaigns."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setAiOpen(true)}>
              <Sparkles className="mr-1 size-4" /> AI Copilot
            </Button>
            <CampaignDialog organizationId={organizationId} />
          </div>
        }
      />

      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search campaigns"
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
      ) : result.total === 0 ? (
        <EmptyState
          icon={<Sparkles className="size-5" />}
          title={(data ?? []).length === 0 ? "No campaigns yet" : "No campaigns match"}
          description={
            (data ?? []).length === 0
              ? "Create a campaign, attach creatives and submit it for review."
              : "Try a different search, status or date range."
          }
          action={
            (data ?? []).length === 0 ? (
              <CampaignDialog organizationId={organizationId} />
            ) : (
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
            rows={result.rows}
            rowKey={(row) => row.id}
            caption="Campaigns"
          />
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Page {result.page} of {result.pageCount} · {result.total} campaigns
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={result.page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={result.page >= result.pageCount}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}

      <AiCopilotDialog open={aiOpen} onOpenChange={setAiOpen} />
    </WorkspaceGuard>
  );
}
