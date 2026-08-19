import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ArrowDownToLine, Coins, Wallet } from "lucide-react";

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
import { LoadingState } from "@/components/patterns/states";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import {
  useAdvertiserOrg,
  useBillingSettings,
  useWallet,
  useWallets,
  useWalletTransactions,
  useInitiatePayment,
  usePaymentStatus,
  useSupportedCurrencies,
  usePaymentMethods,
} from "@/hooks/use-billing";
import {
  formatMoney,
  signedTransactionAmount,
  transactionLabel,
  type WalletTransactionType,
} from "@/lib/billing-domain";

export const Route = createFileRoute("/_authenticated/advertiser/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet — Advertiser — TradeMall" },
      { name: "description", content: "Prepaid balance, deposits and low-balance alerts." },
      { property: "og:title", content: "Wallet — Advertiser — TradeMall" },
      { property: "og:description", content: "Prepaid balance, deposits and low-balance alerts." },
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
  currency: string;
};

function Page() {
  const { organizationId, canManageFunds } = useAdvertiserOrg();
  const billing = useBillingSettings();
  const supportedCurrencies = useSupportedCurrencies();
  const allWallets = useWallets(organizationId);
  const [selectedCurrency, setSelectedCurrency] = useState("KES");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | undefined>();
  const [phoneNumber, setPhoneNumber] = useState("");
  const wallet = useWallet(organizationId, selectedCurrency);
  const transactions = useWalletTransactions(organizationId, { currency: selectedCurrency });
  const initiatePaymentMutation = useInitiatePayment(organizationId);
  const [paymentReference, setPaymentReference] = useState<string | null>(null);
  const paymentStatus = usePaymentStatus(paymentReference);

  const wallets = allWallets.data ?? [];
  const activeWallet = wallet.data;
  const currency = activeWallet?.currency ?? selectedCurrency;
  const currencyOptions = supportedCurrencies.data ?? [];
  const selectedCurrencyConfig = currencyOptions.find((c) => c.currencyCode === selectedCurrency);
  const currencySymbol = selectedCurrencyConfig?.symbol ?? activeWallet?.currency ?? selectedCurrency;
  const paymentMethods = usePaymentMethods(
    selectedCurrencyConfig?.countryCode ?? null,
    selectedCurrency,
  );
  const methodOptions = paymentMethods.data ?? [];
  const activeMethod = methodOptions.find((m) => m.id === selectedPaymentMethod) ?? methodOptions[0];
  // Only the KES M-PESA STK push needs a phone number up front; every other
  // currency collects payment details on the provider's hosted checkout page.
  const requiresPhone = selectedCurrency === "KES";


  const deposits = (transactions.data ?? []).filter((row: any) => row.type === "deposit") as TxnRow[];
  const balance = activeWallet?.balance ?? 0;
  const lowBalance = activeWallet
    ? balance < (activeWallet.lowBalanceThreshold ?? 0)
    : false;

  const columns: DataTableColumn<TxnRow>[] = [
    {
      id: "date",
      header: "Date",
      cell: (row) => (row.created_at ? new Date(row.created_at).toLocaleString() : "—"),
    },
    { id: "type", header: "Type", cell: (row) => transactionLabel(row.type) },
    { id: "currency", header: "Currency", cell: (row) => row.currency },
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

  useEffect(() => {
    if (paymentStatus.data?.status === "completed") {
      toast.success("Payment completed successfully!");
      void paymentStatus.refetch();
    } else if (paymentStatus.data?.status === "failed") {
      toast.error("Payment failed. Please try again.");
    }
  }, [paymentStatus.data?.status]);

  useEffect(() => {
    setPaymentReference(null);
    setSelectedPaymentMethod(undefined);
    setPhoneNumber("");
  }, [selectedCurrency]);

  function normalizeKePhone(raw: string): string | null {
    const digits = raw.replace(/\D/g, "");
    let msisdn = digits;
    if (msisdn.startsWith("0")) msisdn = `254${msisdn.slice(1)}`;
    else if (msisdn.startsWith("7") || msisdn.startsWith("1")) msisdn = `254${msisdn}`;
    else if (msisdn.startsWith("2540")) msisdn = `254${msisdn.slice(4)}`;
    return /^254(7|1)\d{8}$/.test(msisdn) ? msisdn : null;
  }

  async function handlePayment() {
    const parsed = Number((document.getElementById("deposit-amount") as HTMLInputElement)?.value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }

    const minimum = selectedCurrencyConfig?.minimumDeposit ?? 0;
    if (minimum && parsed < minimum) {
      toast.error(`Minimum deposit is ${currencySymbol} ${minimum.toLocaleString()}.`);
      return;
    }

    const decimals = selectedCurrencyConfig?.decimalPlaces ?? 2;
    let msisdn: string | null = null;
    if (requiresPhone) {
      msisdn = selectedCurrencyConfig?.countryCode === "KE" ? normalizeKePhone(phoneNumber) : phoneNumber.trim() || null;
      if (!msisdn) {
        toast.error("Enter a valid mobile money number, e.g. 0712345678.");
        return;
      }
    }

    try {
      const methodId = selectedPaymentMethod ?? activeMethod?.id;
      const result = await initiatePaymentMutation.mutateAsync({
        amount: decimals === 0 ? Math.round(parsed) : Math.round(parsed * 100) / 100,
        countryCode: selectedCurrencyConfig?.countryCode ?? "KE",
        currencyCode: selectedCurrency,
        ...(methodId ? { paymentMethodId: methodId } : {}),
        ...(msisdn ? { phoneNumber: msisdn } : {}),
      } as any);


      const paymentUrl = (result as any).paymentUrl;
      const reference = (result as any).reference;

      if (reference) {
        setPaymentReference(reference);
      }

      if (paymentUrl) {
        window.location.href = paymentUrl;
      } else {
        toast.info(
          selectedCurrency === "KES"
            ? "Check your phone for the M-PESA prompt and enter your PIN to complete."
            : "Payment started. We will confirm as soon as the provider responds.",
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Payment initialization failed.");
    }
  }


  if (allWallets.isLoading || wallet.isLoading || supportedCurrencies.isLoading) {
    return (
      <WorkspaceGuard workspace="advertiser">
        <LoadingState rows={4} label="Loading wallet" />
      </WorkspaceGuard>
    );
  }

  if (wallet.error) {
    console.error("[WALLET PAGE ERROR]", {
      message: wallet.error.message,
      name: wallet.error.name,
      stack: wallet.error.stack,
      selectedCurrency,
      organizationId,
      walletData: wallet.data,
    });
    return (
      <WorkspaceGuard workspace="advertiser">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Wallet</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              We couldn't load your {selectedCurrency} wallet. Please try again or contact support if the problem persists.
            </p>
          </CardContent>
        </Card>
      </WorkspaceGuard>
    );
  }

  return (
    <WorkspaceGuard workspace="advertiser">
      <PageHeader
        eyebrow="Advertiser"
        title="Wallet"
        description="Your prepaid balance funds every impression and click your campaigns win."
      />

      <div className="mt-6 flex items-center gap-3">
        <Label htmlFor="currency-select">Currency</Label>
        <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
          <SelectTrigger id="currency-select" className="w-56">
            <SelectValue placeholder="Select currency" />
          </SelectTrigger>
          <SelectContent>
            {currencyOptions.map((c) => (
              <SelectItem key={c.currencyCode} value={c.currencyCode}>
                {c.currencyCode} — {c.countryName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedCurrencyConfig && (
          <span className="text-sm text-muted-foreground">
            Min deposit: {selectedCurrencyConfig.symbol} {selectedCurrencyConfig.minimumDeposit.toLocaleString()}
          </span>
        )}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <MetricCard
          label={`Available balance (${currency})`}
          value={formatMoney(balance, currency)}
          hint={lowBalance ? "Below your low-balance threshold" : "Ready to spend"}
          icon={<Wallet className="size-4" />}
        />
        <MetricCard
          label="Lifetime deposited"
          value={formatMoney(activeWallet?.lifetimeDeposited ?? 0, currency)}
          hint={`${deposits.length} deposit${deposits.length === 1 ? "" : "s"}`}
          icon={<ArrowDownToLine className="size-4" />}
        />
        <MetricCard
          label="Lifetime spent"
          value={formatMoney(activeWallet?.lifetimeSpent ?? 0, currency)}
          hint="Charged by delivered ad events"
          icon={<Coins className="size-4" />}
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Add funds</CardTitle>
          <CardDescription>
            Deposits are recorded server-side and can never be edited afterwards. Balances are never
            modified from the browser.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-40 space-y-1.5">
              <Label htmlFor="deposit-amount">
                Amount ({currencySymbol})
              </Label>
              <Input
                id="deposit-amount"
                inputMode="decimal"
                defaultValue=""
                disabled={!canManageFunds}
              />
            </div>
            <div className="w-56 space-y-1.5">
              <Label htmlFor="payment-method">Payment method</Label>
              <Select
                value={selectedPaymentMethod ?? ""}
                onValueChange={setSelectedPaymentMethod}
                disabled={!canManageFunds || methodOptions.length === 0}
              >
                <SelectTrigger id="payment-method">
                  <SelectValue
                    placeholder={
                      paymentMethods.isLoading
                        ? "Loading…"
                        : methodOptions.length === 0
                          ? "None available"
                          : "Select method"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {methodOptions.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {requiresPhone ? (
              <div className="w-44 space-y-1.5">
                <Label htmlFor="phone-number">Phone number</Label>
                <Input
                  id="phone-number"
                  inputMode="tel"
                  placeholder="254700000000"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  disabled={!canManageFunds}
                />
              </div>
            ) : null}
            <Button
              onClick={handlePayment}
              disabled={!canManageFunds || initiatePaymentMutation.isPending}
            >
              {initiatePaymentMutation.isPending ? "Processing…" : "Add funds"}
            </Button>
          </div>

          {paymentStatus.data && (
            <p className="mt-2 text-sm text-muted-foreground">
              Payment status: {paymentStatus.data.status}
            </p>
          )}
          {!canManageFunds ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Only organization owners and admins can add funds.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <section className="mt-8 space-y-3">
        <h2 className="text-sm font-semibold">Transaction history</h2>
        <DataTable
          columns={columns}
          rows={deposits}
          rowKey={(row) => row.id}
          isLoading={transactions.isLoading}
          error={transactions.error ? transactions.error.message : null}
          emptyTitle="No transactions yet"
          emptyDescription="Add funds to start delivering campaigns."
          caption="Wallet transactions"
        />
      </section>
    </WorkspaceGuard>
  );
}
