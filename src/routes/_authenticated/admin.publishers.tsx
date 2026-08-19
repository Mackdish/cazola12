import { createFileRoute } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable, type DataTableColumn } from "@/components/patterns/data-table";
import { ErrorState, LoadingState } from "@/components/patterns/states";
import { StatusBadge } from "@/components/patterns/status-badge";
import { AdminReviewDialog } from "@/components/admin/admin-review-dialog";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import { useAdminPublishers } from "@/hooks/use-publisher";
import { approvalLabel, approvalTone, type Publisher } from "@/lib/publisher-domain";

export const Route = createFileRoute("/_authenticated/admin/publishers")({
  head: () => ({
    meta: [
      { title: "Publishers — Platform Admin — TradeMall" },
      {
        name: "description",
        content: "Supply-side organizations and the inventory they bring to the network.",
      },
      { property: "og:title", content: "Publishers — Platform Admin — TradeMall" },
      {
        property: "og:description",
        content: "Supply-side organizations and the inventory they bring to the network.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPublishersPage,
});

function AdminPublishersPage() {
  const { data: publishers, isLoading, error, refetch } = useAdminPublishers();

  const rows: Array<
    Publisher & {
      organization: { id: string; name: string; slug: string; status: string };
      websiteCount: number;
      verifiedWebsiteCount: number;
    }
  > =
    (publishers ?? []).map((publisher) => {
      const organization = (publisher as typeof publisher & { organizations: unknown })
        .organizations as {
        id: string;
        name: string;
        slug: string;
        status: string;
      };
      const websites =
        (publisher as typeof publisher & { websites: Array<Record<string, unknown>> }).websites ??
        [];
      return {
        ...publisher,
        organization,
        websiteCount: websites.length,
        verifiedWebsiteCount: websites.filter(
          (website) => website.verification_status === "verified",
        ).length,
      };
    }) ?? [];

  const columns: DataTableColumn<(typeof rows)[number]>[] = [
    { id: "business", header: "Business", cell: (row) => row.business_name },
    { id: "org", header: "Organization", cell: (row) => row.organization.name },
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
      id: "status",
      header: "Status",
      cell: (row) => <StatusBadge tone={statusTone(row.status)}>{row.status}</StatusBadge>,
    },
    {
      id: "websites",
      header: "Websites",
      cell: (row) => (
        <span className="text-numeric">
          {row.verifiedWebsiteCount} / {row.websiteCount}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (row) => (
        <AdminReviewDialog
          target="publisher"
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
        title="Publishers"
        description="Supply-side organizations and the inventory they bring to the network."
      />

      {isLoading ? (
        <LoadingState rows={4} label="Loading publishers" />
      ) : error ? (
        <ErrorState
          title="Couldn't load publishers"
          message={error.message}
          onRetry={() => void refetch()}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          emptyTitle="No publishers yet"
          emptyDescription="Publisher organizations will appear here once they apply."
        />
      )}
    </WorkspaceGuard>
  );
}

function statusTone(status: string) {
  if (status === "active") return "active";
  if (status === "pending") return "pending";
  if (status === "suspended") return "suspended";
  return "neutral";
}
