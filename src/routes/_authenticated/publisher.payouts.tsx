import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/patterns/data-table";
import { MetricCard } from "@/components/patterns/metric-card";
import { PageHeader } from "@/components/patterns/page-header";
import { StatusBadge } from "@/components/patterns/status-badge";
import { LoadingState } from "@/components/patterns/states";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import {
  useBillingSettings,
  usePayouts,
  usePublisherEarnings,
  useRequestPayout,
} from "@/hooks/use-billing";
import { usePublisherOrg } from "@/hooks/use-publisher";
import {
  PAYOUT_METHODS,
  formatMoney,
  isPayoutOpen,
  payoutBlocker,
  payoutMethodLabel,
  payoutStatusTone,
  type PayoutMethod,
  type PayoutStatus,
} from "@/lib/billing-domain";

export const Route = createFileRoute("/_authenticated/publisher/payouts")({
  head: () => ({
    meta: [
      { title: "Payouts — Publisher — TradeMall" },
      { name: "description", content: "Payout methods, requests and settlement history." },
      { property: "og:title", content: "Payouts — Publisher — TradeMall" },
      { property: "og:description", content: "Payout methods, requests and settlement history." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

type PayoutRow = {
  id: string;
  amount: number | string;
  status: PayoutStatus;
  method: string;
  destination: string;
  payment_reference: string | null;
  rejection_reason: string | null;
  created_at: string;
  paid_at: string | null;
};

function Page() {
  const { organizationId, role } = usePublisherOrg();
  const earnings = usePublisherEarnings(organizationId);
  const payouts = usePayouts(organizationId);
  const settings = useBillingSettings();
  const request = useRequestPayout(organizationId);

  const [method, setMethod] = useState<PayoutMethod>("bank_transfer");
  const [destination, setDestination] = useState("");

  const rows = (payouts.data ?? []) as PayoutRow[];
  const available = earnings.data?.summary.available ?? 0;
  const canManage = role === "owner" || role === "admin";
  const currency = settings.data?.currency ?? "USD";
  const blocker = payoutBlocker({
    available,
    minimumPayout: settings.data?.minimumPayoutAmount ?? 0,
    hasOpenPayout: rows.some((row) => isPayoutOpen(row.status)),
    canManage,
  });

  const columns: DataTableColumn<PayoutRow>[] = [
    { id: "date", header: "Requested", cell: (row) => new Date(row.created_at).toLocaleString() },
    { id: "amount", header: "Amount", align: "right", cell: (row) => formatMoney(row.amount) },
    { id: "method", header: "Method", cell: (row) => payoutMethodLabel(row.method) },
    { id: "destination", header: "Destination", cell: (row) => row.destination },
    {
      id: "status",
      header: "Status",
      cell: (row) => <StatusBadge tone={payoutStatusTone(row.status)}>{row.status}</StatusBadge>,
    },
    {
      id: "detail",
      header: "Detail",
      cell: (row) =>
        row.status === "rejected"
          ? (row.rejection_reason ?? "Rejected")
          : row.status === "paid"
            ? `Ref ${row.payment_reference ?? "—"}`
            : "Awaiting review",
    },
  ];

  function submit() {
    if (destination.trim().length < 4) {
      toast.error("Enter the account or email that should receive the payment.");
      return;
    }
    request.mutate(
      { method, destination: destination.trim() },
      {
        onSuccess: (payout) => {
          setDestination("");
          toast.success(`Payout of ${formatMoney(payout.amount)} requested.`);
        },
        onError: (error: Error) => toast.error(error.message),
      },
    );
  }

  if (earnings.isLoading || payouts.isLoading) {
    return (
      <WorkspaceGuard workspace="publisher">
        <LoadingState rows={4} label="Loading payouts" />
      </WorkspaceGuard>
    );
  }

  return (
    <WorkspaceGuard workspace="publisher">
      <PageHeader
        eyebrow="Publisher"
        title="Payouts"
        description="Request a payout of your available earnings. A platform admin reviews every request before it is paid."
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Available to pay out"
          value={formatMoney(available, currency)}
          hint="Outside the hold period"
        />
        <MetricCard
          label="Payout minimum"
          value={formatMoney(settings.data?.minimumPayoutAmount ?? 0, currency)}
          hint="Set by the platform"
        />
        <MetricCard
          label="Paid to date"
          value={formatMoney(earnings.data?.summary.paid ?? 0, currency)}
          hint={`${rows.filter((row) => row.status === "paid").length} settled payout(s)`}
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Request a payout</CardTitle>
          <CardDescription>
            A request bundles all of your available earnings. Those earnings are held against the
            request until it is paid or rejected.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-48 space-y-1.5">
              <Label htmlFor="payout-method">Method</Label>
              <Select value={method} onValueChange={(next) => setMethod(next as PayoutMethod)}>
                <SelectTrigger id="payout-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYOUT_METHODS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {payoutMethodLabel(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-72 space-y-1.5">
              <Label htmlFor="payout-destination">Destination</Label>
              <Input
                id="payout-destination"
                placeholder="IBAN, PayPal email or Wise handle"
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
                disabled={Boolean(blocker)}
              />
            </div>
            <Button onClick={submit} disabled={Boolean(blocker) || request.isPending}>
              {request.isPending ? "Submitting…" : `Request ${formatMoney(available, currency)}`}
            </Button>
          </div>
          {blocker ? <p className="mt-3 text-xs text-muted-foreground">{blocker}</p> : null}
        </CardContent>
      </Card>

      <section className="mt-8 space-y-3">
        <h2 className="text-sm font-semibold">Payout history</h2>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          error={payouts.error ? payouts.error.message : null}
          emptyTitle="No payouts yet"
          emptyDescription="Once you have available earnings, request your first payout above."
          caption="Payout history"
        />
      </section>
    </WorkspaceGuard>
  );
}
