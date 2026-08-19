import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";

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
import { StatusBadge, type StatusTone } from "@/components/patterns/status-badge";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import { useAdminAdvertisers } from "@/hooks/use-advertiser";
import { approvalLabel, approvalTone, type ApprovalStatus } from "@/lib/publisher-domain";

export const Route = createFileRoute("/_authenticated/admin/advertisers")({
  head: () => ({
    meta: [
      { title: "Advertisers — Platform Admin — TradeMall" },
      {
        name: "description",
        content: "Demand-side organizations, their approval status and spend posture.",
      },
      { property: "og:title", content: "Advertisers — Platform Admin — TradeMall" },
      {
        property: "og:description",
        content: "Demand-side organizations, their approval status and spend posture.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

type AdvertiserRow = {
  id: string;
  businessName: string;
  organizationName: string;
  industry: string | null;
  status: string;
  approvalStatus: ApprovalStatus;
  campaignCount: number;
  createdAt: string;
};

const STATUS_TONE: Record<string, StatusTone> = {
  active: "active",
  pending: "pending",
  suspended: "suspended",
};

function Page() {
  const { data, isLoading, error, refetch } = useAdminAdvertisers();
  const [search, setSearch] = useState("");
  const [approvalFilter, setApprovalFilter] = useState<ApprovalStatus | "all">("all");

  const rows = useMemo(() => {
    const raw = (data ?? []) as Array<{
      id: string;
      business_name: string;
      industry: string | null;
      status: string;
      approval_status: ApprovalStatus;
      created_at: string;
      organizations: { id: string; name: string; slug: string; status: string } | null;
      campaigns: Array<{ id: string; status: string; approval_status: string }>;
    }>;

    return raw
      .filter((row) => {
        const term = search.toLowerCase();
        if (term && !row.business_name.toLowerCase().includes(term) && !(row.organizations?.name ?? "").toLowerCase().includes(term)) {
          return false;
        }
        if (approvalFilter !== "all" && row.approval_status !== approvalFilter) return false;
        return true;
      })
      .map((row) => ({
        id: row.id,
        businessName: row.business_name,
        organizationName: row.organizations?.name ?? "—",
        industry: row.industry,
        status: row.status,
        approvalStatus: row.approval_status,
        campaignCount: row.campaigns?.length ?? 0,
        createdAt: row.created_at,
      }));
  }, [data, search, approvalFilter]);

  const columns: DataTableColumn<AdvertiserRow>[] = [
    { id: "business", header: "Business", cell: (row) => row.businessName },
    { id: "org", header: "Organization", cell: (row) => row.organizationName },
    { id: "industry", header: "Industry", cell: (row) => row.industry ?? "—" },
    {
      id: "status",
      header: "Status",
      cell: (row) => (
        <StatusBadge tone={STATUS_TONE[row.status] ?? "neutral"}>
          {row.status}
        </StatusBadge>
      ),
    },
    {
      id: "approval",
      header: "Approval",
      cell: (row) => (
        <StatusBadge tone={approvalTone(row.approvalStatus)}>
          {approvalLabel(row.approvalStatus)}
        </StatusBadge>
      ),
    },
    {
      id: "campaigns",
      header: "Campaigns",
      cell: (row) => (
        <Link to="/admin/campaigns" className="underline-offset-4 hover:underline">
          {row.campaignCount}
        </Link>
      ),
    },
    { id: "created", header: "Joined", cell: (row) => new Date(row.createdAt).toLocaleDateString() },
  ];

  return (
    <WorkspaceGuard workspace="admin">
      <PageHeader
        eyebrow="Platform Admin"
        title="Advertisers"
        description="Demand-side organizations, their approval status and spend posture."
      />

      {isLoading ? (
        <LoadingState rows={4} label="Loading advertisers" />
      ) : error ? (
        <ErrorState
          title="Couldn't load advertisers"
          message={(error as Error).message}
          onRetry={() => void refetch()}
        />
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search advertisers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={approvalFilter} onValueChange={(v) => setApprovalFilter(v as ApprovalStatus | "all")}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All approvals" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All approvals</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <section className="mt-6">
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(row) => row.id}
              isLoading={isLoading}
              error={error ? (error as Error).message : null}
              emptyTitle="No advertisers yet"
              emptyDescription="Advertisers will appear here once they join the platform."
              caption="Advertisers"
            />
          </section>
        </>
      )}
    </WorkspaceGuard>
  );
}
