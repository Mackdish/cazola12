import { createFileRoute } from "@tanstack/react-router";

import { DataTable, type DataTableColumn } from "@/components/patterns/data-table";
import { MetricCard } from "@/components/patterns/metric-card";
import { PageHeader } from "@/components/patterns/page-header";
import { StatusBadge } from "@/components/patterns/status-badge";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import { useAdvertiserOrg, useCampaignSpend, useWalletTransactions } from "@/hooks/use-billing";
import { useBillingSettings } from "@/hooks/use-billing";
import {
  eventLabel,
  formatMoney,
  formatPreciseMoney,
  signedTransactionAmount,
  sumAmounts,
  transactionLabel,
  type BillingEventType,
  type WalletTransactionType,
} from "@/lib/billing-domain";

export const Route = createFileRoute("/_authenticated/advertiser/transactions")({
  head: () => ({
    meta: [
      { title: "Transactions — Advertiser — TradeMall" },
      { name: "description", content: "Every deposit and spend event on your account." },
      { property: "og:title", content: "Transactions — Advertiser — TradeMall" },
      { property: "og:description", content: "Every deposit and spend event on your account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

type TxnRow = {
  id: string;
  type: WalletTransactionType;
  amount: number | string;
  balance_after: number | string;
  description: string | null;
  created_at: string;
};

type SpendRow = {
  id: string;
  event_type: BillingEventType;
  amount: number | string;
  publisher_amount: number | string;
  platform_amount: number | string;
  created_at: string;
  campaignName: string;
};

function Page() {
  const { organizationId } = useAdvertiserOrg();
  const billing = useBillingSettings();
  const transactions = useWalletTransactions(organizationId);
  const spend = useCampaignSpend(organizationId);

  const txnRows = (transactions.data ?? []) as TxnRow[];
  const spendRows = (spend.data ?? []) as SpendRow[];
  const currency = billing.data?.currency ?? "USD";

  const txnColumns: DataTableColumn<TxnRow>[] = [
    { id: "date", header: "Date", cell: (row) => new Date(row.created_at).toLocaleString() },
    {
      id: "type",
      header: "Type",
      cell: (row) => (
        <StatusBadge tone={row.type === "spend" ? "neutral" : "info"}>
          {transactionLabel(row.type)}
        </StatusBadge>
      ),
    },
    { id: "note", header: "Note", cell: (row) => row.description ?? "—" },
    {
      id: "amount",
      header: "Amount",
      align: "right",
      cell: (row) => signedTransactionAmount(row.type, row.amount),
    },
    {
      id: "balance",
      header: "Balance after",
      align: "right",
      cell: (row) => formatMoney(row.balance_after, currency),
    },
  ];

  const spendColumns: DataTableColumn<SpendRow>[] = [
    { id: "date", header: "Date", cell: (row) => new Date(row.created_at).toLocaleString() },
    { id: "campaign", header: "Campaign", cell: (row) => row.campaignName },
    { id: "event", header: "Event", cell: (row) => eventLabel(row.event_type) },
    {
      id: "charged",
      header: "Charged",
      align: "right",
      cell: (row) => formatPreciseMoney(row.amount, currency),
    },
    {
      id: "publisher",
      header: "Publisher share",
      align: "right",
      cell: (row) => formatPreciseMoney(row.publisher_amount, currency),
    },
  ];

  return (
    <WorkspaceGuard workspace="advertiser">
      <PageHeader
        eyebrow="Advertiser"
        title="Transactions"
        description="An immutable record of every deposit, refund and billed ad event on your account."
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Total charged"
          value={formatMoney(sumAmounts(spendRows.map((row) => row.amount)), currency)}
          hint={`${spendRows.length} billed event${spendRows.length === 1 ? "" : "s"}`}
        />
        <MetricCard
          label="Billed clicks"
          value={String(spendRows.filter((row) => row.event_type === "click").length)}
          hint="CPC campaigns"
        />
        <MetricCard
          label="Billed impressions"
          value={String(spendRows.filter((row) => row.event_type === "impression").length)}
          hint="CPM campaigns"
        />
      </div>

      <section className="mt-8 space-y-3">
        <h2 className="text-sm font-semibold">Wallet transactions</h2>
        <DataTable
          columns={txnColumns}
          rows={txnRows}
          rowKey={(row) => row.id}
          isLoading={transactions.isLoading}
          error={transactions.error ? transactions.error.message : null}
          emptyTitle="No transactions yet"
          emptyDescription="Deposits and ad-event charges will appear here."
          caption="Wallet transactions"
        />
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-sm font-semibold">Spending history</h2>
        <DataTable
          columns={spendColumns}
          rows={spendRows}
          rowKey={(row) => row.id}
          isLoading={spend.isLoading}
          error={spend.error ? spend.error.message : null}
          emptyTitle="No spend yet"
          emptyDescription="Once your ads deliver, each billed impression or click shows up here."
          caption="Campaign spend"
        />
      </section>
    </WorkspaceGuard>
  );
}
