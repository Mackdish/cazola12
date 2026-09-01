import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable, type DataTableColumn } from "@/components/patterns/data-table";
import { ErrorState, LoadingState } from "@/components/patterns/states";
import { StatusBadge } from "@/components/patterns/status-badge";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import {
  useAuditLogs,
  useBlockIp,
  useBlockedIps,
  useBlockedIpHits,
  useBotScoreDistribution,
  useFraudEvents,
  useFlaggedEvents,
  useUnblockIp,
  useUpdateFraudEventStatus,
  type FraudEventFilters,
} from "@/hooks/use-fraud-center";
import { ShieldAlert } from "lucide-react";
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";

export const Route = createFileRoute("/_authenticated/admin/fraud")({
  head: () => ({
    meta: [
      { title: "Fraud Center — Platform Admin — TradeMall" },
      {
        name: "description",
        content: "Monitor and investigate fraud signals, blocked IPs, and platform audit logs.",
      },
      { property: "og:title", content: "Fraud Center — Platform Admin — TradeMall" },
      {
        property: "og:description",
        content: "Monitor and investigate fraud signals, blocked IPs, and platform audit logs.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminFraudPage,
});

type ReviewDialogState = {
  open: boolean;
  eventId: string;
  status: "open" | "reviewed" | "resolved" | "dismissed";
  reviewNotes: string;
};

type FraudFiltersState = {
  status?: string;
  severity?: string;
  eventType?: string;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
};

function AdminFraudPage() {
  const [fraudFilters, setFraudFilters] = useState<FraudFiltersState>({ page: 1, pageSize: 20 });
  const [blockIpOpen, setBlockIpOpen] = useState(false);
  const [blockIpAddress, setBlockIpAddress] = useState("");
  const [blockIpReason, setBlockIpReason] = useState("");
  const [blockIpDuration, setBlockIpDuration] = useState("24");
  const [reviewDialog, setReviewDialog] = useState<ReviewDialogState>({
    open: false,
    eventId: "",
    status: "reviewed",
    reviewNotes: "",
  });

  const fraudQuery = useFraudEvents(fraudFilters);
  const blockedIpsQuery = useBlockedIps();
  const auditQuery = useAuditLogs({ page: 1, pageSize: 20 });
  const blockIpMutation = useBlockIp();
  const unblockIpMutation = useUnblockIp();
  const reviewFraudEventMutation = useUpdateFraudEventStatus();
  const botScoreQuery = useBotScoreDistribution();
  const blockedIpHitsQuery = useBlockedIpHits();
  const flaggedEventsQuery = useFlaggedEvents({ page: 1, pageSize: 20 });

  const fraudEvents = fraudQuery.data?.events ?? [];
  const blockedIps = blockedIpsQuery.data ?? [];
  const auditLogs = auditQuery.data?.logs ?? [];
  const botScoreData = botScoreQuery.data ?? [];
  const blockedIpHits = blockedIpHitsQuery.data?.hits ?? [];
  const flaggedEvents = flaggedEventsQuery.data?.events ?? [];

  const fraudColumns: DataTableColumn<(typeof fraudEvents)[number]>[] = [
    { id: "event_type", header: "Type", cell: (row) => row.event_type },
    {
      id: "severity",
      header: "Severity",
      cell: (row) => <StatusBadge tone={severityTone(row.severity)}>{row.severity}</StatusBadge>,
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => <StatusBadge tone={statusTone(row.status)}>{row.status}</StatusBadge>,
    },
    { id: "score", header: "Score", cell: (row) => Number(row.score).toFixed(2) },
    { id: "ip_address", header: "IP", cell: (row) => row.ip_address ?? "—" },
    {
      id: "target_type",
      header: "Target",
      cell: (row) => `${row.target_type}:${(row.target_id ?? "—").slice(0, 8)}`,
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
              eventId: row.id,
              status: "reviewed",
              reviewNotes: "",
            })
          }
        >
          Review
        </Button>
      ),
    },
  ];

  const blockedIpColumns: DataTableColumn<(typeof blockedIps)[number]>[] = [
    { id: "ip_address", header: "IP Address", cell: (row) => row.ip_address },
    { id: "reason", header: "Reason", cell: (row) => row.reason },
    {
      id: "expires_at",
      header: "Expires",
      cell: (row) => (row.expires_at ? new Date(row.expires_at).toLocaleString() : "Never"),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (row) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            void unblockIpMutation
              .mutateAsync(row.ip_address)
              .then(() => toast.success("IP unblocked"));
          }}
          disabled={unblockIpMutation.isPending}
        >
          Unblock
        </Button>
      ),
    },
  ];

  const flaggedEventColumns: DataTableColumn<(typeof flaggedEvents)[number]>[] = [
    { id: "event_type", header: "Type", cell: (row) => row.event_type },
    { id: "ip_address", header: "IP", cell: (row) => row.ip_address ?? "—" },
    { id: "country", header: "Country", cell: (row) => row.country ?? "—" },
    { id: "bot_score", header: "Bot Score", cell: (row) => row.bot_score ?? "—" },
    { id: "publisher_id", header: "Publisher", cell: (row) => row.publisher_id?.slice(0, 8) ?? "—" },
    { id: "website_id", header: "Website", cell: (row) => row.website_id?.slice(0, 8) ?? "—" },
    { id: "ad_zone_id", header: "Zone", cell: (row) => row.ad_zone_id?.slice(0, 8) ?? "—" },
    {
      id: "created_at",
      header: "Timestamp",
      cell: (row) => new Date(row.created_at).toLocaleString(),
    },
  ];

  const blockedIpHitColumns: DataTableColumn<(typeof blockedIpHits)[number]>[] = [
    { id: "ip_address", header: "IP", cell: (row) => row.actor_id ?? "—" },
    { id: "target_id", header: "Zone", cell: (row) => row.target_id ?? "—" },
    {
      id: "created_at",
      header: "Timestamp",
      cell: (row) => new Date(row.created_at).toLocaleString(),
    },
    {
      id: "signals",
      header: "Event",
      cell: (row) => {
        const signals = row.signals as Record<string, unknown> | null;
        return signals?.event ?? "—";
      },
    },
  ];

  const auditColumns: DataTableColumn<(typeof auditLogs)[number]>[] = [
    { id: "action", header: "Action", cell: (row) => row.action },
    { id: "actor_email", header: "Actor", cell: (row) => row.actor_email },
    { id: "target_type", header: "Target", cell: (row) => row.target_type },
    { id: "target_id", header: "Target ID", cell: (row) => row.target_id.slice(0, 8) },
    {
      id: "created_at",
      header: "Timestamp",
      cell: (row) => new Date(row.created_at).toLocaleString(),
    },
  ];

  async function handleBlockIp() {
    if (!blockIpAddress.trim() || !blockIpReason.trim()) {
      toast.error("IP address and reason are required.");
      return;
    }
    try {
      await blockIpMutation.mutateAsync({
        ipAddress: blockIpAddress.trim(),
        reason: blockIpReason.trim(),
        durationHours: Number(blockIpDuration),
      });
      toast.success("IP blocked successfully.");
      setBlockIpOpen(false);
      setBlockIpAddress("");
      setBlockIpReason("");
      setBlockIpDuration("24");
    } catch {
      toast.error("Failed to block IP.");
    }
  }

  async function handleReviewFraudEvent() {
    if (!reviewDialog.eventId) return;
    try {
      await reviewFraudEventMutation.mutateAsync({
        eventId: reviewDialog.eventId,
        status: reviewDialog.status,
        ...(reviewDialog.reviewNotes ? { reviewNotes: reviewDialog.reviewNotes } : {}),
      });
      toast.success("Fraud event reviewed.");
      setReviewDialog({ open: false, eventId: "", status: "reviewed", reviewNotes: "" });
    } catch {
      toast.error("Failed to update fraud event.");
    }
  }

  return (
    <WorkspaceGuard workspace="admin">
      <PageHeader
        eyebrow="Platform Admin"
        title="Fraud Center"
        description="Monitor fraud signals, manage blocked IPs, and review audit logs."
      />

      <div className="mt-6 rounded-lg border bg-card p-4">
        <h3 className="mb-4 text-sm font-medium">Bot Score Distribution</h3>
        {botScoreQuery.isLoading ? (
          <LoadingState rows={3} label="Loading bot score data" />
        ) : botScoreQuery.error ? (
          <ErrorState title="Couldn't load bot scores" message={botScoreQuery.error.message} />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={botScoreData}>
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Bar dataKey="count" fill="var(--color-primary)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <Tabs defaultValue="events" className="mt-6">
        <TabsList>
          <TabsTrigger value="events">Fraud Events</TabsTrigger>
          <TabsTrigger value="flagged">Flagged Events</TabsTrigger>
          <TabsTrigger value="blocked-hits">Blocked IP Hits</TabsTrigger>
          <TabsTrigger value="blocked">Blocked IPs</TabsTrigger>
          <TabsTrigger value="audit">Audit Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="mt-4 space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="status-filter">Status</Label>
              <Input
                id="status-filter"
                value={fraudFilters.status ?? ""}
                onChange={(e) =>
                  setFraudFilters({
                    ...fraudFilters,
                    ...(e.target.value ? { status: e.target.value } : {}),
                    page: 1,
                  })
                }
                placeholder="All"
                className="w-32"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="severity-filter">Severity</Label>
              <Input
                id="severity-filter"
                value={fraudFilters.severity ?? ""}
                onChange={(e) =>
                  setFraudFilters({
                    ...fraudFilters,
                    ...(e.target.value ? { severity: e.target.value } : {}),
                    page: 1,
                  })
                }
                placeholder="All"
                className="w-32"
              />
            </div>
          </div>

          {fraudQuery.isLoading ? (
            <LoadingState rows={5} label="Loading fraud events" />
          ) : fraudQuery.error ? (
            <ErrorState title="Couldn't load fraud events" message={fraudQuery.error.message} />
          ) : (
            <DataTable
              columns={fraudColumns}
              rows={fraudEvents}
              rowKey={(row) => row.id}
              emptyTitle="No fraud events"
              emptyDescription="Fraud signals will appear here when detected."
            />
          )}
        </TabsContent>

        <TabsContent value="flagged" className="mt-4 space-y-4">
          {flaggedEventsQuery.isLoading ? (
            <LoadingState rows={5} label="Loading flagged events" />
          ) : flaggedEventsQuery.error ? (
            <ErrorState title="Couldn't load flagged events" message={flaggedEventsQuery.error.message} />
          ) : (
            <DataTable
              columns={flaggedEventColumns}
              rows={flaggedEvents}
              rowKey={(row) => `${row.event_type}-${row.id}`}
              emptyTitle="No flagged events"
              emptyDescription="Events flagged as likely bots will appear here."
            />
          )}
        </TabsContent>

        <TabsContent value="blocked-hits" className="mt-4 space-y-4">
          {blockedIpHitsQuery.isLoading ? (
            <LoadingState rows={5} label="Loading blocked IP hits" />
          ) : blockedIpHitsQuery.error ? (
            <ErrorState title="Couldn't load blocked IP hits" message={blockedIpHitsQuery.error.message} />
          ) : (
            <DataTable
              columns={blockedIpHitColumns}
              rows={blockedIpHits}
              rowKey={(row) => row.id}
              emptyTitle="No blocked IP hits"
              emptyDescription="Blocked IP no-fill events will appear here."
            />
          )}
        </TabsContent>

        <TabsContent value="blocked" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setBlockIpOpen(true)}>
              <ShieldAlert className="mr-2 size-4" />
              Block IP
            </Button>
          </div>

          {blockedIpsQuery.isLoading ? (
            <LoadingState rows={3} label="Loading blocked IPs" />
          ) : (
            <DataTable
              columns={blockedIpColumns}
              rows={blockedIps}
              rowKey={(row) => row.id}
              emptyTitle="No blocked IPs"
              emptyDescription="Blocked IPs will appear here."
            />
          )}
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          {auditQuery.isLoading ? (
            <LoadingState rows={5} label="Loading audit logs" />
          ) : (
            <DataTable
              columns={auditColumns}
              rows={auditLogs}
              rowKey={(row) => row.id}
              emptyTitle="No audit logs"
              emptyDescription="Administrative actions will appear here."
            />
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={blockIpOpen} onOpenChange={setBlockIpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block IP Address</DialogTitle>
            <DialogDescription>
              Block an IP address from accessing the ad network.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="block-ip">IP Address</Label>
              <Input
                id="block-ip"
                value={blockIpAddress}
                onChange={(e) => setBlockIpAddress(e.target.value)}
                placeholder="192.168.1.1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="block-reason">Reason</Label>
              <Input
                id="block-reason"
                value={blockIpReason}
                onChange={(e) => setBlockIpReason(e.target.value)}
                placeholder="Fraudulent activity"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="block-duration">Duration (hours)</Label>
              <Input
                id="block-duration"
                type="number"
                value={blockIpDuration}
                onChange={(e) => setBlockIpDuration(e.target.value)}
                min="1"
                max="720"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setBlockIpOpen(false)}
              disabled={blockIpMutation.isPending}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleBlockIp()} disabled={blockIpMutation.isPending}>
              Block IP
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={reviewDialog.open}
        onOpenChange={(open) => setReviewDialog({ ...reviewDialog, open })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Fraud Event</DialogTitle>
            <DialogDescription>Mark this fraud event as reviewed and add notes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="review-status">Status</Label>
              <select
                id="review-status"
                value={reviewDialog.status}
                onChange={(e) =>
                  setReviewDialog({
                    ...reviewDialog,
                    status: e.target.value as ReviewDialogState["status"],
                  })
                }
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              >
                <option value="reviewed">Reviewed</option>
                <option value="resolved">Resolved</option>
                <option value="dismissed">Dismissed</option>
                <option value="open">Reopen</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="review-notes">Notes</Label>
              <textarea
                id="review-notes"
                rows={3}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                placeholder="Add review notes..."
                value={reviewDialog.reviewNotes}
                onChange={(e) => setReviewDialog({ ...reviewDialog, reviewNotes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setReviewDialog({ ...reviewDialog, open: false })}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleReviewFraudEvent()}>Save Review</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkspaceGuard>
  );
}

function severityTone(severity: string) {
  if (severity === "blocked") return "suspended";
  if (severity === "suspicious" || severity === "review_required") return "pending";
  return "active";
}

function statusTone(status: string) {
  if (status === "open") return "pending";
  if (status === "blocked") return "suspended";
  if (status === "reviewed" || status === "resolved") return "active";
  return "neutral";
}
