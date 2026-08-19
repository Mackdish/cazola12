import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { EmptyState, ErrorState, LoadingState } from "@/components/patterns/states";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import { useAdminLedger, useAdminWalletTransactions } from "@/hooks/use-billing";
import { useBillingSettings } from "@/hooks/use-billing";
import {
  formatMoney,
  formatPreciseMoney,
  sumAmounts,
  transactionDirection,
  transactionLabel,
  type WalletTransactionType,
} from "@/lib/billing-domain";

export const Route = createFileRoute("/_authenticated/admin/transactions")({
  head: () => ({
    meta: [
      { title: "Transactions — Platform Admin — TradeMall" },
      { name: "description", content: "Ledger of deposits, spend, revenue share and adjustments." },
      { property: "og:title", content: "Transactions — Platform Admin — TradeMall" },
      {
        property: "og:description",
        content: "Ledger of deposits, spend, revenue share and adjustments.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

type WalletRow = {
  id: string;
  type: WalletTransactionType;
  amount: number | string;
  balance_after: number | string;
  description: string | null;
  created_at: string;
  organizationName: string;
};

const PAGE_SIZE = 20;

function Page() {
  const billing = useBillingSettings();
  const ledger = useAdminLedger();
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [page, setPage] = useState(1);

  const txnQuery = useAdminWalletTransactions({
    ...(search ? { search } : {}),
    ...(type !== "all" ? { type } : {}),
    page,
    pageSize: PAGE_SIZE,
  });

  const rows: WalletRow[] = (txnQuery.data?.transactions ?? []) as WalletRow[];
  const total = txnQuery.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), pageCount);

  const totals = ledger.data?.totals;
  const grossBilled = totals?.grossSpend ?? 0;
  const currency = billing.data?.currency ?? "USD";
  const publisherEarnings = totals?.publisherShare ?? 0;
  const platformRevenue = totals?.platformRevenue ?? 0;

  const columns: DataTableColumn<WalletRow>[] = [
    {
      id: "date",
      header: "Date",
      cell: (row) => new Date(row.created_at).toLocaleString(),
    },
    {
      id: "organization",
      header: "Organization",
      cell: (row) => row.organizationName,
    },
    {
      id: "type",
      header: "Type",
      cell: (row) => (
        <span
          className={
            transactionDirection(row.type) === "credit"
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-rose-600 dark:text-rose-400"
          }
        >
          {transactionLabel(row.type)}
        </span>
      ),
    },
    {
      id: "amount",
      header: "Amount",
      align: "right",
      cell: (row) => (
        <span
          className={
            transactionDirection(row.type) === "credit"
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-rose-600 dark:text-rose-400"
          }
        >
          {transactionDirection(row.type) === "credit" ? "+" : "−"}
          {formatPreciseMoney(row.amount, currency)}
        </span>
      ),
    },
    {
      id: "balance",
      header: "Balance after",
      align: "right",
      cell: (row) => formatPreciseMoney(row.balance_after, currency),
    },
    {
      id: "reference",
      header: "Reference",
      cell: (row) => row.description ?? "—",
    },
  ];

  if (ledger.isLoading) {
    return (
      <WorkspaceGuard workspace="admin">
        <PageHeader
          eyebrow="Platform Admin"
          title="Transactions"
          description="Every billed ad event, with the advertiser charge split into publisher earnings and platform revenue."
        />
        <LoadingState rows={6} label="Loading transactions" />
      </WorkspaceGuard>
    );
  }

  const ledgerError = ledger.error?.message ?? null;
  const txnError = txnQuery.error?.message ?? null;
  const errorMessage = ledgerError || txnError;

  if (errorMessage) {
    return (
      <WorkspaceGuard workspace="admin">
        <PageHeader
          eyebrow="Platform Admin"
          title="Transactions"
          description="Every billed ad event, with the advertiser charge split into publisher earnings and platform revenue."
        />
        <ErrorState title="Couldn't load transactions" message={errorMessage} />
      </WorkspaceGuard>
    );
  }

  return (
    <WorkspaceGuard workspace="admin">
      <PageHeader
        eyebrow="Platform Admin"
        title="Transactions"
        description="Every billed ad event, with the advertiser charge split into publisher earnings and platform revenue."
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Gross billed"
          value={formatMoney(grossBilled, currency)}
          hint={`${totals?.chargedEvents ?? 0} event${(totals?.chargedEvents ?? 0) === 1 ? "" : "s"}`}
        />
        <MetricCard
          label="Publisher earnings"
          value={formatMoney(publisherEarnings, currency)}
          hint="Owed to supply"
        />
        <MetricCard
          label="Platform revenue"
          value={formatMoney(platformRevenue, currency)}
          hint="Retained margin"
        />
      </div>

      <section className="mt-8 space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Ledger</h2>
          <div className="ml-auto flex items-center gap-2">
            <Input
              placeholder="Search reference..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-48"
            />
            <Select
              value={type}
              onValueChange={(value) => {
                setType(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="deposit">Deposit</SelectItem>
                <SelectItem value="spend">Spend</SelectItem>
                <SelectItem value="refund">Refund</SelectItem>
                <SelectItem value="adjustment">Adjustment</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          isLoading={txnQuery.isLoading}
          error={txnError}
          emptyTitle="No transactions yet"
          emptyDescription="Charges appear here as soon as ads deliver against funded campaigns."
          caption="Platform ledger"
        />

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Page {safePage} of {pageCount}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={safePage <= 1 || txnQuery.isLoading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={safePage >= pageCount || txnQuery.isLoading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </section>
    </WorkspaceGuard>
  );
}
