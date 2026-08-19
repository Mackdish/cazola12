import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, type DataTableColumn } from "@/components/patterns/data-table";
import { MetricCard } from "@/components/patterns/metric-card";
import { PageHeader } from "@/components/patterns/page-header";
import { StatusBadge } from "@/components/patterns/status-badge";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import { useAdminPayouts, useBillingSettings, useDecidePayout } from "@/hooks/use-billing";
import {
  formatMoney,
  payoutMethodLabel,
  payoutStatusTone,
  sumAmounts,
  type PayoutStatus,
} from "@/lib/billing-domain";

export const Route = createFileRoute("/_authenticated/admin/payouts")({
  head: () => ({
    meta: [
      { title: "Payouts — Platform Admin — TradeMall" },
      {
        name: "description",
        content: "Publisher payout requests, approvals and settlement history.",
      },
      { property: "og:title", content: "Payouts — Platform Admin — TradeMall" },
      {
        property: "og:description",
        content: "Publisher payout requests, approvals and settlement history.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

type Row = {
  id: string;
  amount: number | string;
  status: PayoutStatus;
  method: string;
  destination: string;
  created_at: string;
  organizationName: string;
};

function Page() {
  const billing = useBillingSettings();
  const payouts = useAdminPayouts();
  const decide = useDecidePayout();
  const [reference, setReference] = useState<Record<string, string>>({});

  const rows = (payouts.data ?? []) as Row[];
  const pending = rows.filter((row) => row.status === "pending");
  const approved = rows.filter((row) => row.status === "approved");
  const currency = billing.data?.currency ?? "USD";

  function act(row: Row, status: PayoutStatus) {
    const ref = reference[row.id]?.trim() ?? "";
    if (status === "paid" && ref.length < 3) {
      toast.error("Enter the payment reference before marking this payout paid.");
      return;
    }
    decide.mutate(
      {
        payoutId: row.id,
        status,
        ...(status === "paid" ? { paymentReference: ref } : {}),
        ...(status === "rejected" ? { reason: "Rejected by platform review" } : {}),
      },
      {
        onSuccess: () => toast.success(`Payout marked ${status}.`),
        onError: (error: Error) => toast.error(error.message),
      },
    );
  }

  const columns: DataTableColumn<Row>[] = [
    {
      id: "date",
      header: "Requested",
      cell: (row) => new Date(row.created_at).toLocaleDateString(),
    },
    { id: "publisher", header: "Publisher", cell: (row) => row.organizationName },
    { id: "amount", header: "Amount", align: "right", cell: (row) => formatMoney(row.amount, currency) },
    {
      id: "method",
      header: "Destination",
      cell: (row) => `${payoutMethodLabel(row.method)} · ${row.destination}`,
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => <StatusBadge tone={payoutStatusTone(row.status)}>{row.status}</StatusBadge>,
    },
    {
      id: "actions",
      header: "Review",
      align: "right",
      cell: (row) => {
        if (row.status === "pending") {
          return (
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => act(row, "rejected")}
                disabled={decide.isPending}
              >
                Reject
              </Button>
              <Button size="sm" onClick={() => act(row, "approved")} disabled={decide.isPending}>
                Approve
              </Button>
            </div>
          );
        }
        if (row.status === "approved") {
          return (
            <div className="flex items-center justify-end gap-2">
              <Input
                className="h-8 w-40"
                placeholder="Payment reference"
                value={reference[row.id] ?? ""}
                onChange={(event) =>
                  setReference((prev) => ({ ...prev, [row.id]: event.target.value }))
                }
              />
              <Button size="sm" onClick={() => act(row, "paid")} disabled={decide.isPending}>
                Mark paid
              </Button>
            </div>
          );
        }
        return <span className="text-xs text-muted-foreground">Closed</span>;
      },
    },
  ];

  return (
    <WorkspaceGuard workspace="admin">
      <PageHeader
        eyebrow="Platform Admin"
        title="Payouts"
        description="Approve payout requests, then mark them paid only once the transfer is actually confirmed."
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Pending review"
          value={String(pending.length)}
          hint={formatMoney(sumAmounts(pending.map((row) => row.amount)), currency)}
        />
        <MetricCard
          label="Approved, awaiting transfer"
          value={String(approved.length)}
          hint={formatMoney(sumAmounts(approved.map((row) => row.amount)), currency)}
        />
        <MetricCard
          label="Paid to date"
          value={formatMoney(
            sumAmounts(rows.filter((row) => row.status === "paid").map((row) => row.amount)),
            currency,
          )}
          hint="Confirmed settlements"
        />
      </div>

      <section className="mt-8 space-y-3">
        <h2 className="text-sm font-semibold">All requests</h2>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          isLoading={payouts.isLoading}
          error={payouts.error ? payouts.error.message : null}
          emptyTitle="No payout requests"
          emptyDescription="Publisher payout requests will appear here for review."
          caption="Payout requests"
        />
      </section>
    </WorkspaceGuard>
  );
}
