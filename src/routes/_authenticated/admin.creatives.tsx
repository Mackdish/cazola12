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
import { useAdminCreatives, useAdminDeleteCreative } from "@/hooks/use-admin-creatives";
import { ImageOff } from "lucide-react";
import type { MediaAsset } from "@/lib/advertiser-domain";

export const Route = createFileRoute("/_authenticated/admin/creatives")({
  head: () => ({
    meta: [
      { title: "Creatives — Platform Admin — TradeMall" },
      { name: "description", content: "All uploaded media assets across the network." },
      { property: "og:title", content: "Creatives — Platform Admin — TradeMall" },
      { property: "og:description", content: "All uploaded media assets across the network." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

const PAGE_SIZE = 10;

type CreativeRow = MediaAsset & {
  organization?: { name: string } | null;
};

function Page() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const creativesQuery = useAdminCreatives({
    search: search || undefined,
    status: status === "all" ? undefined : status,
    page,
    pageSize: PAGE_SIZE,
  } as any);
  const deleteCreative = useAdminDeleteCreative();

  const rows: CreativeRow[] = (creativesQuery.data?.creatives ?? []).map((c) => ({
    ...c,
    organization: (c as any).organizations ?? null,
  }));
  const total = creativesQuery.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), pageCount);

  function handleDelete(assetId: string, fileName: string) {
    deleteCreative.mutate(assetId, {
      onSuccess: () => toast.success(`"${fileName}" deleted.`),
      onError: (error: Error) => toast.error(error.message),
    });
  }

  const columns: DataTableColumn<CreativeRow>[] = [
    {
      id: "file",
      header: "File",
      cell: (row) => (
        <div className="min-w-0">
          <p className="font-medium truncate">{row.file_name}</p>
          <p className="text-xs text-muted-foreground">
            {row.mime_type} · {(row.file_size / 1024).toFixed(0)} KB
          </p>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => (
        <StatusBadge
          tone={
            row.status === "ready" ? "active" : row.status === "rejected" ? "suspended" : "pending"
          }
        >
          {row.status}
        </StatusBadge>
      ),
    },
    {
      id: "storage",
      header: "Storage",
      cell: (row) => <span className="text-sm">{row.storage_provider ?? "supabase"}</span>,
    },
    {
      id: "created",
      header: "Uploaded",
      cell: (row) => (
        <span className="text-sm tabular-nums">
          {new Date(row.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (row) => (
        <Button
          size="sm"
          variant="ghost"
          disabled={deleteCreative.isPending}
          onClick={() => handleDelete(row.id, row.file_name)}
        >
          Delete
        </Button>
      ),
    },
  ];

  return (
    <WorkspaceGuard workspace="admin">
      <PageHeader
        eyebrow="Platform Admin"
        title="Creatives"
        description="All uploaded media assets across the network."
      />

      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <div className="relative">
          <Input
            placeholder="Search by filename"
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
            <SelectItem value="ready">Ready</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {creativesQuery.isLoading ? (
        <LoadingState rows={4} label="Loading creatives" />
      ) : creativesQuery.error ? (
        <ErrorState title="Couldn't load creatives" message={creativesQuery.error.message} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<ImageOff className="size-5" />}
          title="No creatives found"
          description="Uploaded media assets will appear here."
        />
      ) : (
        <div className="space-y-3">
          <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} caption="Creatives" />
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Page {safePage} of {pageCount} · {total} creatives
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
