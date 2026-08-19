import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicLayout } from "@/components/layout/public-layout";
import { usePaymentStatus, useConfirmPayment } from "@/hooks/use-billing";
import { formatMoney } from "@/lib/billing-domain";

const searchSchema = z.object({ reference: z.string().optional() });

export const Route = createFileRoute("/payment/confirm")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Payment confirmation — TradeMall" },
      { name: "description", content: "Confirming your TradeMall wallet deposit with our payment provider." },
      { property: "og:title", content: "Payment confirmation — TradeMall" },
      { property: "og:description", content: "Confirming your TradeMall wallet deposit with our payment provider." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

function Page() {
  const { reference } = Route.useSearch();
  const status = usePaymentStatus(reference ?? null);
  const confirm = useConfirmPayment();
  const attempted = useRef(false);

  const payment = status.data as
    | { status?: string; amount?: number | string; currency?: string; reference?: string }
    | undefined;
  const state = payment?.status ?? "pending";

  // Fallback path: the webhook may not have landed yet, so verify server-side.
  useEffect(() => {
    if (!reference || attempted.current) return;
    if (!payment) return;
    if (state !== "pending" && state !== "processing") return;
    attempted.current = true;
    confirm.mutate(reference, {
      onSettled: () => {
        void status.refetch();
      },
    });
  }, [reference, payment, state]);

  const done = state === "completed";
  const failed = state === "failed" || state === "cancelled";

  return (
    <PublicLayout>
      <div className="mx-auto flex min-h-[60vh] w-full max-w-xl items-center px-4 py-16">
        <Card className="w-full">
          <CardHeader className="items-center text-center">
            <span className="mb-2 inline-flex size-12 items-center justify-center rounded-full bg-muted">
              {done ? (
                <CheckCircle2 className="size-6 text-primary" />
              ) : failed ? (
                <XCircle className="size-6 text-destructive" />
              ) : (
                <Clock className="size-6 text-muted-foreground" />
              )}
            </span>
            <CardTitle>
              {done ? "Payment received" : failed ? "Payment not completed" : "Confirming your payment"}
            </CardTitle>
            <CardDescription>
              {!reference
                ? "No payment reference was provided."
                : done
                  ? "Your wallet has been credited."
                  : failed
                    ? "The payment was cancelled or declined. You can try again from your wallet."
                    : "We're checking with the payment provider. This usually takes a few seconds."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {reference && (
              <dl className="space-y-2">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Reference</dt>
                  <dd className="font-mono">{reference}</dd>
                </div>
                {payment?.amount !== undefined && payment?.currency && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Amount</dt>
                    <dd>{formatMoney(payment.amount, payment.currency)}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="capitalize">{state}</dd>
                </div>
              </dl>
            )}
            {status.error && (
              <p className="text-muted-foreground">
                We couldn't find this payment yet. Sign in and open your wallet to check its status.
              </p>
            )}
            <div className="flex gap-3 pt-2">
              <Button asChild className="flex-1">
                <Link to="/advertiser/wallet">Go to wallet</Link>
              </Button>
              {!done && !failed && (
                <Button
                  variant="outline"
                  onClick={() => {
                    attempted.current = false;
                    void status.refetch();
                  }}
                >
                  Refresh
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
}
