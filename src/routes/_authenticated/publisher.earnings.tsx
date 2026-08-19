import { createFileRoute, Link } from "@tanstack/react-router";
import { Banknote, Clock, Coins, PiggyBank } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/patterns/data-table";
import { MetricCard } from "@/components/patterns/metric-card";
import { PageHeader } from "@/components/patterns/page-header";
import { StatusBadge } from "@/components/patterns/status-badge";
import { LoadingState } from "@/components/patterns/states";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import { useBillingSettings, usePublisherEarnings } from "@/hooks/use-billing";
import { usePublisherOrg } from "@/hooks/use-publisher";
import {
  earningStatusTone,
  eventLabel,
  formatMoney,
  formatPercent,
  formatPreciseMoney,
  type BillingEventType,
  type EarningStatus,
} from "@/lib/billing-domain";

export const Route = createFileRoute("/_authenticated/publisher/earnings")({
  head: () => ({
    meta: [
      { title: "Earnings — Publisher — TradeMall" },
      { name: "description", content: "Revenue accrued per website, zone and day." },
      { property: "og:title", content: "Earnings — Publisher — TradeMall" },
      { property: "og:description", content: "Revenue accrued per website, zone and day." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

type EarningRow = {
  id: string;
  event_type: BillingEventType;
  status: EarningStatus;
  gross_amount: number | string;
  publisher_amount: number | string;
  revenue_share: number | string;
  created_at: string;
  websiteName: string;
  zoneName: string;
};

function Page() {
  const { organizationId } = usePublisherOrg();
  const earnings = usePublisherEarnings(organizationId);
  const billing = useBillingSettings();

  const summary = earnings.data?.summary;
  const rows = (earnings.data?.recent ?? []) as EarningRow[];
  const currency = billing.data?.currency ?? "USD";

  const columns: DataTableColumn<EarningRow>[] = [
    { id: "date", header: "Date", cell: (row) => new Date(row.created_at).toLocaleString() },
    { id: "website", header: "Website", cell: (row) => row.websiteName },
    { id: "zone", header: "Zone", cell: (row) => row.zoneName },
    { id: "event", header: "Event", cell: (row) => eventLabel(row.event_type) },
    {
      id: "gross",
      header: "Gross",
      align: "right",
      cell: (row) => formatPreciseMoney(row.gross_amount, currency),
    },
    {
      id: "yours",
      header: "Your share",
      align: "right",
      cell: (row) => (
        <span className="text-numeric">
          {formatPreciseMoney(row.publisher_amount, currency)}{" "}
          <span className="text-xs text-muted-foreground">
            ({formatPercent(row.revenue_share)})
          </span>
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => <StatusBadge tone={earningStatusTone(row.status)}>{row.status}</StatusBadge>,
    },
  ];

  if (earnings.isLoading) {
    return (
      <WorkspaceGuard workspace="publisher">
        <LoadingState rows={4} label="Loading earnings" />
      </WorkspaceGuard>
    );
  }

  return (
    <WorkspaceGuard workspace="publisher">
      <PageHeader
        eyebrow="Publisher"
        title="Earnings"
        description={
          earnings.data
            ? `You keep ${formatPercent(earnings.data.revenueShare)} of every billed ad event. Earnings become available ${earnings.data.holdDays} day${earnings.data.holdDays === 1 ? "" : "s"} after they are recorded.`
            : "Revenue accrued per website, zone and event."
        }
        actions={
          <Button asChild size="sm" variant="outline">
            <Link to="/publisher/payouts">Request a payout</Link>
          </Button>
        }
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total earnings"
          value={formatMoney(summary?.totalEarned ?? 0, currency)}
          hint="Excluding refunded events"
          icon={<Coins className="size-4" />}
        />
        <MetricCard
          label="Pending"
          value={formatMoney(summary?.pending ?? 0, currency)}
          hint="Still inside the hold period"
          icon={<Clock className="size-4" />}
        />
        <MetricCard
          label="Available"
          value={formatMoney(summary?.available ?? 0, currency)}
          hint="Ready to request as a payout"
          icon={<PiggyBank className="size-4" />}
        />
        <MetricCard
          label="Paid"
          value={formatMoney(summary?.paid ?? 0, currency)}
          hint="Settled through payouts"
          icon={<Banknote className="size-4" />}
        />
      </div>

      <section className="mt-8 space-y-3">
        <h2 className="text-sm font-semibold">Recent earnings</h2>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          error={earnings.error ? earnings.error.message : null}
          emptyTitle="No earnings yet"
          emptyDescription="Once your zones serve billable ads, each event's share appears here."
          caption="Recent publisher earnings"
        />
      </section>
    </WorkspaceGuard>
  );
}
