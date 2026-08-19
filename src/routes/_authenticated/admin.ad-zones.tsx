import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/patterns/page-header";
import { DataTable, type DataTableColumn } from "@/components/patterns/data-table";
import { ErrorState, LoadingState } from "@/components/patterns/states";
import { StatusBadge } from "@/components/patterns/status-badge";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import { useAdminWebsites } from "@/hooks/use-publisher";
import { formatDimensions, type AdZone, type Website } from "@/lib/publisher-domain";

export const Route = createFileRoute("/_authenticated/admin/ad-zones")({
  head: () => ({
    meta: [
      { title: "Ad Zones — Platform Admin — TradeMall" },
      {
        name: "description",
        content: "Placement inventory across all verified publisher websites.",
      },
      { property: "og:title", content: "Ad Zones — Platform Admin — TradeMall" },
      {
        property: "og:description",
        content: "Placement inventory across all verified publisher websites.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminAdZonesPage,
});

function AdminAdZonesPage() {
  const { data: websites, isLoading, error, refetch } = useAdminWebsites();

  const rows: Array<
    AdZone & {
      website: Pick<Website, "domain" | "name" | "verification_status" | "approval_status">;
    }
  > = [];

  (websites ?? []).forEach((website) => {
    const zones = (website as typeof website & { ad_zones: AdZone[] }).ad_zones ?? [];
    zones.forEach((zone) => {
      rows.push({
        ...zone,
        website: {
          domain: website.domain,
          name: website.name,
          verification_status: website.verification_status,
          approval_status: website.approval_status,
        },
      });
    });
  });

  const columns: DataTableColumn<(typeof rows)[number]>[] = [
    { id: "name", header: "Zone", cell: (row) => row.name },
    { id: "format", header: "Format", cell: (row) => formatDimensions(row) },
    { id: "domain", header: "Website", cell: (row) => row.website.domain },
    {
      id: "status",
      header: "Status",
      cell: (row) => (
        <StatusBadge tone={row.status === "active" ? "active" : "suspended"}>
          {row.status}
        </StatusBadge>
      ),
    },
    {
      id: "ready",
      header: "Ready to serve",
      cell: (row) => (
        <StatusBadge
          tone={
            row.website.verification_status === "verified" &&
            row.website.approval_status === "approved"
              ? "active"
              : "pending"
          }
        >
          {row.website.verification_status === "verified" &&
          row.website.approval_status === "approved"
            ? "Yes"
            : "No"}
        </StatusBadge>
      ),
    },
  ];

  return (
    <WorkspaceGuard workspace="admin">
      <PageHeader
        eyebrow="Platform Admin"
        title="Ad Zones"
        description="Placement inventory across all verified publisher websites."
      />

      {isLoading ? (
        <LoadingState rows={4} label="Loading ad zones" />
      ) : error ? (
        <ErrorState
          title="Couldn't load ad zones"
          message={error.message}
          onRetry={() => void refetch()}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          emptyTitle="No ad zones yet"
          emptyDescription="Ad zones will appear here once publishers create them."
        />
      )}
    </WorkspaceGuard>
  );
}
