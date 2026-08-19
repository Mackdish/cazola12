import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable, type DataTableColumn } from "@/components/patterns/data-table";
import { ErrorState, LoadingState } from "@/components/patterns/states";
import { StatusBadge } from "@/components/patterns/status-badge";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import { useAdminWebsites, useUpdatePolicyViolation } from "@/hooks/use-publisher";
import { toFriendlyError } from "@/lib/errors";
import {
  violationSeverityLabel,
  violationStatusLabel,
} from "@/lib/publisher-policy.domain";
import type { PolicyViolation } from "@/lib/publisher-policy.service.server";
import type { Website } from "@/lib/publisher-domain";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { fetchWebsiteViolations } from "@/lib/publisher-ecosystem.functions";

export const Route = createFileRoute("/_authenticated/admin/violations")({
  head: () => ({
    meta: [
      { title: "Policy Violations — Platform Admin — TradeMall" },
      {
        name: "description",
        content: "Policy violations across all websites, with review actions.",
      },
      { property: "og:title", content: "Policy Violations — Platform Admin — TradeMall" },
      {
        property: "og:description",
        content: "Policy violations across all websites, with review actions.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminViolationsPage,
});

type ViolationRow = PolicyViolation & {
  website: Pick<Website, "id" | "domain" | "name"> | null;
  publisher: { id: string; business_name: string } | null;
};

type ReviewDialogState = {
  open: boolean;
  violationId: string;
  status: "open" | "in_review" | "resolved" | "dismissed";
  adminNotes: string;
};

function AdminViolationsPage() {
  const websitesQuery = useAdminWebsites();
  const fetchViolationsFn = useServerFn(fetchWebsiteViolations);
  const updateViolation = useUpdatePolicyViolation();
  const [reviewDialog, setReviewDialog] = useState<ReviewDialogState>({
    open: false,
    violationId: "",
    status: "in_review",
    adminNotes: "",
  });

  const violationsQuery = useQuery<PolicyViolation[]>({
    queryKey: ["admin", "violations"],
    queryFn: () =>
      Promise.all(
        websitesQuery.data!.map((website) =>
          fetchViolationsFn({ data: { websiteId: website.id } }),
        ),
      ).then((results) => results.flat()),
  });

  const websites = websitesQuery.data ?? [];
  const violations = (violationsQuery.data ?? []) as PolicyViolation[];

  const rows: ViolationRow[] = violations.map((violation) => {
    const website = websites.find((w) => w.id === violation.website_id) ?? null;
    const publisher = website?.publishers ?? null;
    return { ...violation, website, publisher };
  });

  const columns: DataTableColumn<ViolationRow>[] = [
    { id: "type", header: "Type", cell: (row) => row.violation_type },
    {
      id: "severity",
      header: "Severity",
      cell: (row) => (
        <StatusBadge tone={severityTone(row.severity)}>
          {violationSeverityLabel(row.severity)}
        </StatusBadge>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => (
        <StatusBadge tone={statusTone(row.status)}>
          {violationStatusLabel(row.status)}
        </StatusBadge>
      ),
    },
    { id: "domain", header: "Website", cell: (row) => row.website?.domain ?? "—" },
    { id: "publisher", header: "Publisher", cell: (row) => row.publisher?.business_name ?? "—" },
    {
      id: "created_at",
      header: "Created",
      cell: (row) => new Date(row.created_at).toLocaleString(),
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
            setReviewDialog({
              open: true,
              violationId: row.id,
              status: row.status,
              adminNotes: row.admin_notes ?? "",
            })
          }
        >
          Review
        </Button>
      ),
    },
  ];

  async function handleReview() {
    if (!reviewDialog.violationId) return;
    try {
      const input: { violationId: string; status?: string; adminNotes?: string } = {
        violationId: reviewDialog.violationId,
        status: reviewDialog.status,
      };
      if (reviewDialog.adminNotes.trim()) {
        input.adminNotes = reviewDialog.adminNotes.trim();
      }
      await updateViolation.mutateAsync(input);
      toast.success("Violation review saved.");
      setReviewDialog({ ...reviewDialog, open: false });
      void violationsQuery.refetch();
    } catch (error) {
      const friendly = toFriendlyError(error, "We couldn't save that review");
      toast.error(friendly.message);
    }
  }

  return (
    <WorkspaceGuard workspace="admin">
      <PageHeader
        eyebrow="Platform Admin"
        title="Policy Violations"
        description="Policy violations across all websites, with review actions."
      />

      {websitesQuery.isLoading ? (
        <LoadingState rows={4} label="Loading websites" />
      ) : violationsQuery.error ? (
        <ErrorState
          title="Couldn't load violations"
          message={violationsQuery.error.message}
          onRetry={() => void violationsQuery.refetch()}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          emptyTitle="No violations yet"
          emptyDescription="Policy violations will appear here when detected."
        />
      )}

      <Dialog
        open={reviewDialog.open}
        onOpenChange={(open) => setReviewDialog({ ...reviewDialog, open })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Review Violation</DialogTitle>
            <DialogDescription>
              Update the violation status and add admin notes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="review-status">Status</Label>
              <Select
                value={reviewDialog.status}
                onValueChange={(value) =>
                  setReviewDialog({
                    ...reviewDialog,
                    status: value as ReviewDialogState["status"],
                  })
                }
              >
                <SelectTrigger id="review-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_review">In Review</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="dismissed">Dismissed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="review-notes">Admin Notes</Label>
              <textarea
                id="review-notes"
                rows={3}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                placeholder="Add review notes..."
                value={reviewDialog.adminNotes}
                onChange={(e) =>
                  setReviewDialog({ ...reviewDialog, adminNotes: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setReviewDialog({ ...reviewDialog, open: false })}
              disabled={updateViolation.isPending}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleReview()} disabled={updateViolation.isPending}>
              {updateViolation.isPending ? "Saving..." : "Save Review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkspaceGuard>
  );
}

function severityTone(severity: string) {
  if (severity === "critical") return "suspended";
  if (severity === "high") return "pending";
  if (severity === "medium") return "info";
  return "active";
}

function statusTone(status: string) {
  if (status === "open") return "pending";
  if (status === "resolved") return "active";
  if (status === "dismissed") return "suspended";
  return "info";
}
