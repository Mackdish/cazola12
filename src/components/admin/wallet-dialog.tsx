import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LoadingState } from "@/components/patterns/states";
import { fetchAdminWallets } from "@/lib/billing.functions";
import { formatCurrency } from "@/lib/advertiser-domain";

type WalletRow = {
  id: string;
  currency: string;
  countryCode: string;
  balance: number;
  lifetimeDeposited: number;
  lifetimeSpent: number;
  lowBalanceThreshold: number;
};

export function WalletDialog({ organizationId, organizationName }: { organizationId: string; organizationName?: string }) {
  const [open, setOpen] = useState(false);
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError(null);
    void fetchAdminWallets({ data: { organizationId } })
      .then((data) => {
        if (active) {
          setWallets(data as WalletRow[]);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setLoading(false);
          setError(err instanceof Error ? err.message : "We couldn't load wallet balances.");
        }
      });
    return () => {
      active = false;
    };
  }, [open, organizationId]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Wallet className="mr-2 size-4" />
          Wallet
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Wallet balances</DialogTitle>
          <DialogDescription>
            {organizationName ?? "Organization"} wallet balances by currency.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <LoadingState rows={3} label="Loading wallets" />
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : wallets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No wallets found for this organization.</p>
        ) : (
          <div className="space-y-3">
            {wallets.map((wallet) => (
              <div
                key={wallet.id}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div>
                  <p className="text-sm font-medium">{wallet.currency}</p>
                  <p className="text-xs text-muted-foreground">{wallet.countryCode}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{formatCurrency(wallet.balance, wallet.currency)}</p>
                  <p className="text-xs text-muted-foreground">
                    Deposited: {formatCurrency(wallet.lifetimeDeposited, wallet.currency)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
