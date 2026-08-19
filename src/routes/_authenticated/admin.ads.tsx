import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/patterns/data-table";
import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/patterns/states";
import { StatusBadge } from "@/components/patterns/status-badge";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import { useAdminAds, useAdminArchiveAd } from "@/hooks/use-admin-ads";
import { Megaphone } from "lucide-react";
import type { Ad } from "@/lib/advertiser-domain";

export const Route = createFileRoute("/_authenticated/admin/ads")({
  head: () => ({
    meta: [
      { title: "Ads — Platform Admin — TradeMall" },
      {
        name: "description",
        content: "All ads across the network, with approval status and performance.",
      },
      { property: "og:title", content: "Ads — Platform Admin — TradeMall" },
      {
        property: "og:description",
        content: "All ads across the network, with approval status and performance.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

const PAGE_SIZE = 10;

type AdRow = Ad & {
  campaigns?: { name: string; status: string } | null;
  advertisers?: { business_name: string } | null;
};

function Page() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const adsQuery = useAdminAds({
    search: search || undefined,
    status: status === "all" ? undefined : status,
    page,
    pageSize: PAGE_SIZE,
  } as any);
  const archive = useAdminArchiveAd();

  const rows: AdRow[] = (adsQuery.data?.ads ?? []).map((ad) => ({
    ...ad,
    campaigns: (ad as any).campaigns ?? null,
    advertisers: (ad as any).advertisers ?? null,
  }));
  const total = adsQuery.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), pageCount);

  function handleArchive(adId: string, adName: string) {
    archive.mutate(adId, {
      onSuccess: () => toast.success(`"${adName}" archived.`),
      onError: (error: Error) => toast.error(error.message),
    });
  }

  const columns: DataTableColumn<AdRow>[] = [
    {
      id: "name",
      header: "Ad",
      cell: (row) => (
        <div className="min-w-0">
          <p className="font-medium truncate">{row.name}</p>
          <p className="text-xs text-muted-foreground truncate">{row.destination_url}</p>
        </div>
      ),
    },
    {
      id: "campaign",
      header: "Campaign",
      cell: (row) => <span className="text-sm">{row.campaigns?.name ?? "—"}</span>,
    },
    {
      id: "advertiser",
      header: "Advertiser",
      cell: (row) => <span className="text-sm">{row.advertisers?.business_name ?? "—"}</span>,
    },
    {
      id: "approval",
      header: "Approval",
      cell: (row) => (
        <StatusBadge
          tone={
            row.approval_status === "approved"
              ? "active"
              : row.approval_status === "rejected"
                ? "suspended"
                : "pending"
          }
        >
          {row.approval_status}
        </StatusBadge>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => (
        <StatusBadge
          tone={
            row.status === "active"
              ? "active"
              : row.status === "suspended"
                ? "suspended"
                : "pending"
          }
        >
          {row.status}
        </StatusBadge>
      ),
    },
    {
      id: "format",
      header: "Format",
      cell: (row) => <span className="text-sm">{row.format}</span>,
    },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (row) => (
        <Button
          size="sm"
          variant="ghost"
          disabled={archive.isPending || row.status === "suspended"}
          onClick={() => handleArchive(row.id, row.name)}
        >
          Archive
        </Button>
      ),
    },
  ];

  return (
    <WorkspaceGuard workspace="admin">
      <PageHeader
        eyebrow="Platform Admin"
        title="Ads"
        description="All ads across the network, with approval status and performance."
      />

      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <div className="relative">
          <Input
            placeholder="Search ads or destinations"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-3"
          />
        </div>
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full md:w-44">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {adsQuery.isLoading ? (
        <LoadingState rows={4} label="Loading ads" />
      ) : adsQuery.error ? (
        <ErrorState title="Couldn't load ads" message={adsQuery.error.message} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="size-5" />}
          title="No ads found"
          description="Ads will appear here once advertisers create them."
        />
      ) : (
        <div className="space-y-3">
          <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} caption="Ads" />
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Page {safePage} of {pageCount} · {total} ads
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={safePage >= pageCount}
                onClick={() => setPage((p) => p + 1)}
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
