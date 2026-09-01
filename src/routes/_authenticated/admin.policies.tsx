import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable, type DataTableColumn } from "@/components/patterns/data-table";
import { ErrorState, LoadingState } from "@/components/patterns/states";
import { StatusBadge } from "@/components/patterns/status-badge";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import { useAdminPublishers, usePublisherPolicies } from "@/hooks/use-publisher";
import { violationSeverityLabel } from "@/lib/publisher-policy.domain";
import type { PublisherPolicy } from "@/lib/publisher-policy.service.server";
import type { Publisher } from "@/lib/publisher-domain";

export const Route = createFileRoute("/_authenticated/admin/policies")({
  head: () => ({
    meta: [
      { title: "Policy Center — Platform Admin — TradeMall" },
      {
        name: "description",
        content: "Publisher policies and compliance rules across the network.",
      },
      { property: "og:title", content: "Policy Center — Platform Admin — TradeMall" },
      {
        property: "og:description",
        content: "Publisher policies and compliance rules across the network.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPoliciesPage,
});

type PublisherRow = Publisher & {
  organization: { id: string; name: string; slug: string; status: string };
  websiteCount: number;
};

type DetailDialogState = {
  open: boolean;
  organizationId: string;
  organizationName: string;
};

function AdminPoliciesPage() {
  const publishersQuery = useAdminPublishers();
  const [detailDialog, setDetailDialog] = useState<DetailDialogState>({
    open: false,
    organizationId: "",
    organizationName: "",
  });

  const publishers = (publishersQuery.data ?? []).map((publisher) => {
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
    };
  });

  const rows: PublisherRow[] = publishers;

  const columns: DataTableColumn<PublisherRow>[] = [
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
      cell: (row) => <span className="text-numeric">{row.websiteCount}</span>,
    },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (row) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            setDetailDialog({
              open: true,
              organizationId: row.organization.id,
              organizationName: row.organization.name,
            })
          }
        >
          View Policies
        </Button>
      ),
    },
  ];

  return (
    <WorkspaceGuard workspace="admin">
      <PageHeader
        eyebrow="Platform Admin"
        title="Policy Center"
        description="Publisher policies and compliance rules across the network."
      />

      {publishersQuery.isLoading ? (
        <LoadingState rows={4} label="Loading publishers" />
      ) : publishersQuery.error ? (
        <ErrorState
          title="Couldn't load publishers"
          message={publishersQuery.error.message}
          onRetry={() => void publishersQuery.refetch()}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          emptyTitle="No publishers yet"
          emptyDescription="Publishers will appear here once they apply."
        />
      )}

      <Dialog
        open={detailDialog.open}
        onOpenChange={(open) => setDetailDialog({ ...detailDialog, open })}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Policies — {detailDialog.organizationName}</DialogTitle>
            <DialogDescription>
              Publisher policies and compliance rules for this organization.
            </DialogDescription>
          </DialogHeader>
          <PoliciesList organizationId={detailDialog.organizationId} />
        </DialogContent>
      </Dialog>
    </WorkspaceGuard>
  );
}

function PoliciesList({ organizationId }: { organizationId: string }) {
  const { data: policies, isLoading, error, refetch } = usePublisherPolicies(organizationId);

  if (isLoading) return <LoadingState rows={3} label="Loading policies" />;
  if (error) return <ErrorState title="Couldn't load policies" message={error.message} onRetry={() => void refetch()} />;
  if (!policies || policies.length === 0)
    return <p className="text-sm text-muted-foreground">No policies configured for this organization.</p>;

  return (
    <div className="space-y-2">
      {policies.map((policy) => (
        <div
          key={policy.id}
          className="rounded-md border border-border p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{policy.title}</p>
              <p className="text-xs text-muted-foreground">{policy.category}</p>
            </div>
            <StatusBadge tone={severityTone(policy.severity)}>
              {violationSeverityLabel(policy.severity)}
            </StatusBadge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{policy.description}</p>
          <div className="mt-2 flex items-center gap-2">
            <StatusBadge tone={policy.is_active ? "active" : "suspended"}>
              {policy.is_active ? "Active" : "Inactive"}
            </StatusBadge>
          </div>
        </div>
      ))}
    </div>
  );
}

function approvalTone(status: string) {
  if (status === "approved") return "active";
  if (status === "rejected") return "suspended";
  return "pending";
}

function approvalLabel(status: string) {
  return status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Pending review";
}

function statusTone(status: string) {
  if (status === "active") return "active";
  if (status === "pending") return "pending";
  if (status === "suspended") return "suspended";
  return "neutral";
}

function severityTone(severity: string) {
  if (severity === "critical") return "suspended";
  if (severity === "high") return "pending";
  if (severity === "medium") return "info";
  return "active";
}
