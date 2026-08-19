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
import { useAdminWebsites } from "@/hooks/use-publisher";
import { computeHealthScore } from "@/lib/publisher-policy.domain";
import type { WebsiteHealthCheck } from "@/lib/website-health.service.server";
import type { Website } from "@/lib/publisher-domain";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { fetchWebsiteHealthChecks } from "@/lib/publisher-ecosystem.functions";

export const Route = createFileRoute("/_authenticated/admin/health")({
  head: () => ({
    meta: [
      { title: "Website Health — Platform Admin — TradeMall" },
      {
        name: "description",
        content: "Website health checks and verification status across the network.",
      },
      { property: "og:title", content: "Website Health — Platform Admin — TradeMall" },
      {
        property: "og:description",
        content: "Website health checks and verification status across the network.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminHealthPage,
});

type HealthRow = Website & {
  latestChecks: WebsiteHealthCheck[];
  healthScore: number;
  publisher?: { business_name: string } | null;
};

type DetailDialogState = {
  open: boolean;
  websiteId: string;
  websiteName: string;
};

function AdminHealthPage() {
  const websitesQuery = useAdminWebsites();
  const fetchHealthFn = useServerFn(fetchWebsiteHealthChecks);
  const [detailDialog, setDetailDialog] = useState<DetailDialogState>({
    open: false,
    websiteId: "",
    websiteName: "",
  });

  const healthQuery = useQuery<WebsiteHealthCheck[]>({
    queryKey: ["admin", "health"],
    queryFn: () =>
      Promise.all(
        websitesQuery.data!.map((website) =>
          fetchHealthFn({ data: { websiteId: website.id } }),
        ),
      ).then((results) => results.flat()),
  });

  const websites = websitesQuery.data ?? [];
  const healthChecks = (healthQuery.data ?? []) as WebsiteHealthCheck[];

  const checksByWebsite = new Map<string, WebsiteHealthCheck[]>();
  for (const check of healthChecks) {
    const existing = checksByWebsite.get(check.website_id) ?? [];
    existing.push(check);
    checksByWebsite.set(check.website_id, existing);
  }

  const rows: HealthRow[] = websites.map((website) => {
    const checks = checksByWebsite.get(website.id) ?? [];
    const score = computeHealthScore(
      checks.map((c) => ({ passed: c.passed, score: c.score })),
    );
    const publisher = (website as typeof website & { publishers: { business_name: string } | null }).publishers;
    return { ...website, latestChecks: checks, healthScore: score, publisher };
  });

  const columns: DataTableColumn<HealthRow>[] = [
    { id: "name", header: "Website", cell: (row) => row.name },
    { id: "domain", header: "Domain", cell: (row) => row.domain },
    { id: "publisher", header: "Publisher", cell: (row) => row.publisher?.business_name ?? "—" },
    {
      id: "status",
      header: "Status",
      cell: (row) => (
        <StatusBadge tone={statusTone(row.status)}>{row.status}</StatusBadge>
      ),
    },
    {
      id: "verification",
      header: "Verification",
      cell: (row) => (
        <StatusBadge tone={verificationTone(row.verification_status)}>
          {row.verification_status}
        </StatusBadge>
      ),
    },
    {
      id: "score",
      header: "Health Score",
      cell: (row) => (
        <span className="text-numeric font-medium">{row.healthScore}/100</span>
      ),
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
              websiteId: row.id,
              websiteName: row.name,
            })
          }
        >
          View Checks
        </Button>
      ),
    },
  ];

  return (
    <WorkspaceGuard workspace="admin">
      <PageHeader
        eyebrow="Platform Admin"
        title="Website Health"
        description="Website health checks and verification status across the network."
      />

      {websitesQuery.isLoading ? (
        <LoadingState rows={4} label="Loading websites" />
      ) : healthQuery.error ? (
        <ErrorState
          title="Couldn't load health checks"
          message={healthQuery.error.message}
          onRetry={() => void healthQuery.refetch()}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          emptyTitle="No websites yet"
          emptyDescription="Websites will appear here once publishers add them."
        />
      )}

      <Dialog
        open={detailDialog.open}
        onOpenChange={(open) => setDetailDialog({ ...detailDialog, open })}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Health Checks — {detailDialog.websiteName}</DialogTitle>
            <DialogDescription>
              Latest health check results for this website.
            </DialogDescription>
          </DialogHeader>
          <HealthChecksList websiteId={detailDialog.websiteId} />
        </DialogContent>
      </Dialog>
    </WorkspaceGuard>
  );
}

function HealthChecksList({ websiteId }: { websiteId: string }) {
  const fetchHealthFn = useServerFn(fetchWebsiteHealthChecks);

  const { data: checks, isLoading, error } = useQuery({
    queryKey: ["publisher", "health-checks", websiteId],
    enabled: Boolean(websiteId),
    queryFn: async () => {
      return fetchHealthFn({ data: { websiteId } });
    },
  });

  if (isLoading) return <LoadingState rows={3} label="Loading health checks" />;
  if (error) return <ErrorState title="Couldn't load health checks" message={error.message} />;
  if (!checks || checks.length === 0)
    return <p className="text-sm text-muted-foreground">No health checks yet.</p>;

  return (
    <div className="space-y-2">
      {(checks as WebsiteHealthCheck[]).map((check) => (
        <div
          key={check.id}
          className="flex items-center justify-between rounded-md border border-border p-3"
        >
          <div>
            <p className="text-sm font-medium capitalize">
              {check.check_type.replace(/_/g, " ")}
            </p>
            <p className="text-xs text-muted-foreground">
              Score: {check.score} ·{" "}
              {new Date(check.checked_at).toLocaleString()}
            </p>
          </div>
          <StatusBadge tone={check.passed ? "active" : "suspended"}>
            {check.passed ? "Passed" : "Failed"}
          </StatusBadge>
        </div>
      ))}
    </div>
  );
}

function statusTone(status: string) {
  if (status === "active") return "active";
  if (status === "pending") return "pending";
  if (status === "suspended") return "suspended";
  return "neutral";
}

function verificationTone(status: string) {
  if (status === "verified") return "active";
  if (status === "failed") return "suspended";
  if (status === "pending") return "pending";
  return "neutral";
}
