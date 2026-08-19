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
import { useAdReports, useReviewAdReport } from "@/hooks/use-publisher";
import { toFriendlyError } from "@/lib/errors";
import type { AdReport } from "@/lib/ad-reports.service.server";
import type { Ad } from "@/lib/advertiser-domain";

export const Route = createFileRoute("/_authenticated/admin/ad-reports")({
  head: () => ({
    meta: [
      { title: "Ad Reports — Platform Admin — TradeMall" },
      {
        name: "description",
        content: "Review and resolve ad reports submitted by publishers.",
      },
      { property: "og:title", content: "Ad Reports — Platform Admin — TradeMall" },
      {
        property: "og:description",
        content: "Review and resolve ad reports submitted by publishers.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminAdReportsPage,
});

type AdReportRow = AdReport & {
  ad?: Pick<Ad, "name" | "destination_url"> | null;
  campaign?: { name: string } | null;
  advertiser?: { business_name: string } | null;
  website?: { domain: string; name: string } | null;
};

type ReviewDialogState = {
  open: boolean;
  reportId: string;
  status: "pending" | "reviewed" | "resolved" | "dismissed";
  adminNotes: string;
};

function AdminAdReportsPage() {
  const reportsQuery = useAdReports();
  const reviewReport = useReviewAdReport();
  const [reviewDialog, setReviewDialog] = useState<ReviewDialogState>({
    open: false,
    reportId: "",
    status: "reviewed",
    adminNotes: "",
  });

  const reports = (reportsQuery.data ?? []) as AdReport[];

  const rows: AdReportRow[] = reports.map((report) => ({
    ...report,
    ad: (report as any).ads ?? null,
    campaign: (report as any).campaigns ?? null,
    advertiser: (report as any).advertisers ?? null,
    website: (report as any).websites ?? null,
  }));

  const columns: DataTableColumn<AdReportRow>[] = [
    {
      id: "ad",
      header: "Ad",
      cell: (row) => (
        <div className="min-w-0">
          <p className="font-medium truncate">{row.ad?.name ?? "—"}</p>
          <p className="text-xs text-muted-foreground truncate">
            {row.ad?.destination_url ?? ""}
          </p>
        </div>
      ),
    },
    {
      id: "campaign",
      header: "Campaign",
      cell: (row) => <span className="text-sm">{row.campaign?.name ?? "—"}</span>,
    },
    {
      id: "advertiser",
      header: "Advertiser",
      cell: (row) => (
        <span className="text-sm">{row.advertiser?.business_name ?? "—"}</span>
      ),
    },
    {
      id: "website",
      header: "Website",
      cell: (row) => (
        <span className="text-sm">{row.website?.domain ?? "—"}</span>
      ),
    },
    {
      id: "reason",
      header: "Reason",
      cell: (row) => (
        <StatusBadge tone={reasonTone(row.reason)}>{row.reason}</StatusBadge>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => (
        <StatusBadge tone={statusTone(row.status)}>{row.status}</StatusBadge>
      ),
    },
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
              reportId: row.id,
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
    if (!reviewDialog.reportId) return;
    try {
      const input: { reportId: string; status?: string; adminNotes?: string } = {
        reportId: reviewDialog.reportId,
        status: reviewDialog.status,
      };
      if (reviewDialog.adminNotes.trim()) {
        input.adminNotes = reviewDialog.adminNotes.trim();
      }
      await reviewReport.mutateAsync(input);
      toast.success("Report review saved.");
      setReviewDialog({ ...reviewDialog, open: false });
      void reportsQuery.refetch();
    } catch (error) {
      const friendly = toFriendlyError(error, "We couldn't save that review");
      toast.error(friendly.message);
    }
  }

  return (
    <WorkspaceGuard workspace="admin">
      <PageHeader
        eyebrow="Platform Admin"
        title="Ad Reports"
        description="Review and resolve ad reports submitted by publishers."
      />

      {reportsQuery.isLoading ? (
        <LoadingState rows={4} label="Loading ad reports" />
      ) : reportsQuery.error ? (
        <ErrorState
          title="Couldn't load ad reports"
          message={reportsQuery.error.message}
          onRetry={() => void reportsQuery.refetch()}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          emptyTitle="No ad reports yet"
          emptyDescription="Ad reports will appear here when publishers flag ads."
        />
      )}

      <Dialog
        open={reviewDialog.open}
        onOpenChange={(open) => setReviewDialog({ ...reviewDialog, open })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Review Ad Report</DialogTitle>
            <DialogDescription>
              Update the report status and add admin notes.
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
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="reviewed">Reviewed</SelectItem>
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
              disabled={reviewReport.isPending}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleReview()} disabled={reviewReport.isPending}>
              {reviewReport.isPending ? "Saving..." : "Save Review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkspaceGuard>
  );
}

function reasonTone(reason: string) {
  if (reason === "malicious" || reason === "inappropriate") return "suspended";
  if (reason === "misleading" || reason === "repetitive") return "pending";
  return "info";
}

function statusTone(status: string) {
  if (status === "resolved" || status === "reviewed") return "active";
  if (status === "dismissed") return "suspended";
  return "pending";
}
