import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable, type DataTableColumn } from "@/components/patterns/data-table";
import { ErrorState, LoadingState } from "@/components/patterns/states";
import { StatusBadge } from "@/components/patterns/status-badge";
import { MetricCard } from "@/components/patterns/metric-card";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import { useAdReports } from "@/hooks/use-publisher";
import { ShieldAlert } from "lucide-react";
import type { AdReport } from "@/lib/ad-reports.service.server";

export const Route = createFileRoute("/_authenticated/admin/ad-safety")({
  head: () => ({
    meta: [
      { title: "Ad Safety — Platform Admin — TradeMall" },
      {
        name: "description",
        content: "Monitor ad safety signals, reported ads, and suspicious patterns.",
      },
      { property: "og:title", content: "Ad Safety — Platform Admin — TradeMall" },
      {
        property: "og:description",
        content: "Monitor ad safety signals, reported ads, and suspicious patterns.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminAdSafetyPage,
});

type AdReportRow = AdReport & {
  ad?: { name: string; destination_url: string } | null;
  campaign?: { name: string } | null;
  advertiser?: { business_name: string } | null;
  website?: { domain: string; name: string } | null;
};

function AdminAdSafetyPage() {
  const allReportsQuery = useAdReports();

  const reports = (allReportsQuery.data ?? []) as AdReport[];

  const suspicious = reports.filter((r) =>
    ["malicious", "inappropriate", "misleading"].includes(r.reason),
  );
  const malicious = reports.filter((r) => r.reason === "malicious");
  const inappropriate = reports.filter((r) => r.reason === "inappropriate");
  const pending = reports.filter((r) => r.status === "pending");

  const metrics = useMemo(
    () => [
      {
        label: "Total Reports",
        value: reports.length,
        hint: `${pending.length} pending review`,
      },
      {
        label: "Suspicious",
        value: suspicious.length,
        hint: "Malicious, inappropriate, or misleading",
      },
      {
        label: "Malicious",
        value: malicious.length,
        hint: "Highest priority",
        icon: <ShieldAlert className="size-4 text-destructive" />,
      },
      {
        label: "Inappropriate",
        value: inappropriate.length,
        hint: "Requires content review",
      },
    ],
    [reports.length, suspicious.length, malicious.length, inappropriate.length, pending.length],
  );

  const buildRows = (items: AdReport[]): AdReportRow[] =>
    items.map((report) => ({
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
  ];

  return (
    <WorkspaceGuard workspace="admin">
      <PageHeader
        eyebrow="Platform Admin"
        title="Ad Safety"
        description="Monitor ad safety signals, reported ads, and suspicious patterns."
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            hint={metric.hint}
            icon={metric.icon}
          />
        ))}
      </div>

      <Tabs defaultValue="suspicious" className="mt-6">
        <TabsList>
          <TabsTrigger value="suspicious">Suspicious</TabsTrigger>
          <TabsTrigger value="malicious">Malicious</TabsTrigger>
          <TabsTrigger value="inappropriate">Inappropriate</TabsTrigger>
          <TabsTrigger value="all">All Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="suspicious" className="mt-4">
          {allReportsQuery.isLoading ? (
            <LoadingState rows={4} label="Loading reports" />
          ) : allReportsQuery.error ? (
            <ErrorState
              title="Couldn't load reports"
              message={allReportsQuery.error.message}
              onRetry={() => void allReportsQuery.refetch()}
            />
          ) : (
            <DataTable
              columns={columns}
              rows={buildRows(suspicious)}
              rowKey={(row) => row.id}
              emptyTitle="No suspicious reports"
              emptyDescription="Suspicious ad reports will appear here."
            />
          )}
        </TabsContent>

        <TabsContent value="malicious" className="mt-4">
          {allReportsQuery.isLoading ? (
            <LoadingState rows={4} label="Loading reports" />
          ) : allReportsQuery.error ? (
            <ErrorState
              title="Couldn't load reports"
              message={allReportsQuery.error.message}
              onRetry={() => void allReportsQuery.refetch()}
            />
          ) : (
            <DataTable
              columns={columns}
              rows={buildRows(malicious)}
              rowKey={(row) => row.id}
              emptyTitle="No malicious reports"
              emptyDescription="Malicious ad reports will appear here."
            />
          )}
        </TabsContent>

        <TabsContent value="inappropriate" className="mt-4">
          {allReportsQuery.isLoading ? (
            <LoadingState rows={4} label="Loading reports" />
          ) : allReportsQuery.error ? (
            <ErrorState
              title="Couldn't load reports"
              message={allReportsQuery.error.message}
              onRetry={() => void allReportsQuery.refetch()}
            />
          ) : (
            <DataTable
              columns={columns}
              rows={buildRows(inappropriate)}
              rowKey={(row) => row.id}
              emptyTitle="No inappropriate reports"
              emptyDescription="Inappropriate ad reports will appear here."
            />
          )}
        </TabsContent>

        <TabsContent value="all" className="mt-4">
          {allReportsQuery.isLoading ? (
            <LoadingState rows={4} label="Loading reports" />
          ) : allReportsQuery.error ? (
            <ErrorState
              title="Couldn't load reports"
              message={allReportsQuery.error.message}
              onRetry={() => void allReportsQuery.refetch()}
            />
          ) : (
            <DataTable
              columns={columns}
              rows={buildRows(reports)}
              rowKey={(row) => row.id}
              emptyTitle="No ad reports yet"
              emptyDescription="Ad reports will appear here when publishers flag ads."
            />
          )}
        </TabsContent>
      </Tabs>
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
