import { createFileRoute } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable, type DataTableColumn } from "@/components/patterns/data-table";
import { ErrorState, LoadingState } from "@/components/patterns/states";
import { StatusBadge } from "@/components/patterns/status-badge";
import { AdminReviewDialog } from "@/components/admin/admin-review-dialog";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import { useAdminWebsites } from "@/hooks/use-publisher";
import {
  approvalLabel,
  approvalTone,
  categoryLabel,
  normalizeDomain,
  type Website,
  verificationLabel,
  verificationTone,
} from "@/lib/publisher-domain";

export const Route = createFileRoute("/_authenticated/admin/websites")({
  head: () => ({
    meta: [
      { title: "Websites — Platform Admin — TradeMall" },
      {
        name: "description",
        content: "Publisher domains awaiting verification or already serving ads.",
      },
      { property: "og:title", content: "Websites — Platform Admin — TradeMall" },
      {
        property: "og:description",
        content: "Publisher domains awaiting verification or already serving ads.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminWebsitesPage,
});

function AdminWebsitesPage() {
  const { data: websites, isLoading, error, refetch } = useAdminWebsites();

  const rows: Array<
    Website & {
      publisher: { id: string; business_name: string; approval_status: string };
      zoneCount: number;
      activeZoneCount: number;
    }
  > =
    (websites ?? []).map((website) => {
      const publisher = (website as typeof website & { publishers: unknown }).publishers as {
        id: string;
        business_name: string;
        approval_status: string;
      };
      const zones =
        (website as typeof website & { ad_zones: Array<{ id: string; status: string }> })
          .ad_zones ?? [];
      return {
        ...website,
        publisher,
        zoneCount: zones.length,
        activeZoneCount: zones.filter((zone) => zone.status === "active").length,
      };
    }) ?? [];

  const columns: DataTableColumn<(typeof rows)[number]>[] = [
    {
      id: "domain",
      header: "Domain",
      cell: (row) => {
        const normalized = normalizeDomain(row.domain);
        if (!normalized) {
          return (
            <span className="text-destructive" title="Invalid domain stored in database">
              {row.domain}
            </span>
          );
        }
        return (
          <a
            href={`https://${normalized}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline-offset-4 hover:underline"
          >
            {normalized}
          </a>
        );
      },
    },
    { id: "publisher", header: "Publisher", cell: (row) => row.publisher.business_name },
    {
      id: "category",
      header: "Category",
      cell: (row) => categoryLabel(row.category),
    },
    {
      id: "verification",
      header: "Verification",
      cell: (row) => (
        <StatusBadge tone={verificationTone(row.verification_status)}>
          {verificationLabel(row.verification_status)}
        </StatusBadge>
      ),
    },
    {
      id: "approval",
      header: "Approval",
      cell: (row) => (
        <StatusBadge tone={approvalTone(row.approval_status)}>
          {approvalLabel(row.approval_status)}
        </StatusBadge>
      ),
    },
    {
      id: "zones",
      header: "Zones",
      cell: (row) => (
        <span className="text-numeric">
          {row.activeZoneCount} / {row.zoneCount}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (row) => (
        <AdminReviewDialog
          target="website"
          id={row.id}
          currentApprovalStatus={row.approval_status}
          currentStatus={row.status}
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
        title="Websites"
        description="Publisher domains awaiting verification or already serving ads."
      />

      {isLoading ? (
        <LoadingState rows={4} label="Loading websites" />
      ) : error ? (
        <ErrorState
          title="Couldn't load websites"
          message={error.message}
          onRetry={() => void refetch()}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          emptyTitle="No websites yet"
          emptyDescription="Publisher websites will appear here once they are added."
        />
      )}
    </WorkspaceGuard>
  );
}
