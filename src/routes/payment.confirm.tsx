import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicLayout } from "@/components/layout/public-layout";
import {
  usePaymentStatus,
  useConfirmPayment,
  usePublicPaymentStatus,
  usePublicConfirmPayment,
} from "@/hooks/use-billing";
import { formatMoney } from "@/lib/billing-domain";

const searchSchema = z.object({ reference: z.string().optional() });

export const Route = createFileRoute("/payment/confirm")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Payment confirmation — TradeMall" },
      {
        name: "description",
        content: "Confirming your TradeMall wallet deposit with our payment provider.",
      },
      { property: "og:title", content: "Payment confirmation — TradeMall" },
      {
        property: "og:description",
        content: "Confirming your TradeMall wallet deposit with our payment provider.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

const MAX_VERIFICATION_ATTEMPTS = 3;
const VERIFICATION_RETRY_DELAY_MS = 5000;

function Page() {
  const { reference } = Route.useSearch();
  const status = usePublicPaymentStatus(reference ?? null);
  const confirm = usePublicConfirmPayment();
  const confirmedRef = useRef<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);

  const payment = status.data as
    | { status?: string; amount?: number | string; currency?: string; reference?: string }
    | undefined;
  const state = verificationStatus ?? payment?.status ?? "pending";
  const isPending = state === "pending" || state === "processing";

  useEffect(() => {
    confirmedRef.current = null;
    setVerificationStatus(null);
    setAttemptCount(0);
  }, [reference]);

  useEffect(() => {
    if (!reference || !isPending) return;
    if (confirmedRef.current === reference) return;
    if (confirm.isPending) return;
    if (attemptCount >= MAX_VERIFICATION_ATTEMPTS) return;

    confirmedRef.current = reference;

    console.log("[payment][confirm][CALL]", {
      reference,
      paymentStatus: payment?.status,
      attempt: attemptCount + 1,
    });

    confirm.mutate(reference, {
      onSuccess: (data) => {
        console.log("[payment][confirm][RESULT]", {
          reference,
          status: data?.status,
          verifiedAmount: data?.amount,
          verifiedCurrency: data?.currency,
          attempt: attemptCount + 1,
        });

        if (data?.status && data.status !== "pending") {
          setVerificationStatus(data.status);
        } else if (data?.status === "pending" && attemptCount + 1 < MAX_VERIFICATION_ATTEMPTS) {
          setTimeout(() => {
            confirmedRef.current = null;
            setAttemptCount((c) => c + 1);
          }, VERIFICATION_RETRY_DELAY_MS);
        }
      },
      onError: (error) => {
        console.log("[payment][confirm][ERROR]", {
          reference,
          error: error instanceof Error ? error.message : String(error),
          attempt: attemptCount + 1,
        });
        confirmedRef.current = null;
        if (attemptCount + 1 < MAX_VERIFICATION_ATTEMPTS) {
          setTimeout(() => {
            setAttemptCount((c) => c + 1);
          }, VERIFICATION_RETRY_DELAY_MS);
        }
      },
    });
  }, [reference, isPending, confirm.isPending, payment?.status, attemptCount]);

  const done = state === "completed";
  const failed = state === "failed" || state === "cancelled";
  const verificationError = [
    "verification_failed",
    "authentication_failed",
    "provider_forbidden",
    "payment_not_found",
    "rate_limited",
    "provider_unavailable",
    "provider_request_error",
  ].includes(state);

  const errorTitle =
    state === "authentication_failed"
      ? "Payment provider authentication failed"
      : state === "provider_forbidden"
        ? "Payment provider access denied"
        : state === "payment_not_found"
          ? "Payment not found"
          : state === "rate_limited"
            ? "Too many verification attempts"
            : state === "provider_unavailable"
              ? "Payment provider unavailable"
              : state === "verification_failed"
                ? "Payment verification failed"
                : "Payment not completed";

  const errorDescription =
    state === "authentication_failed"
      ? "We could not authenticate with the payment provider. Please contact support or try again later."
      : state === "provider_forbidden"
        ? "The payment provider denied access. Please contact support."
        : state === "payment_not_found"
          ? "We could not find this payment with the provider. Please check the reference or contact support."
          : state === "rate_limited"
            ? "We are being rate-limited by the payment provider. Please wait a moment and try again."
            : state === "provider_unavailable"
              ? "The payment provider is temporarily unavailable. Please try again in a few moments."
              : state === "verification_failed"
                ? "We could not verify the payment with the provider. This may be a temporary issue — please try again or contact support."
                : "The payment was cancelled or declined. You can try again from your wallet.";

  return (
    <PublicLayout>
      <div className="mx-auto flex min-h-[60vh] w-full max-w-xl items-center px-4 py-16">
        <Card className="w-full">
          <CardHeader className="items-center text-center">
            <span className="mb-2 inline-flex size-12 items-center justify-center rounded-full bg-muted">
              {done ? (
                <CheckCircle2 className="size-6 text-primary" />
              ) : failed || verificationError ? (
                <XCircle className="size-6 text-destructive" />
              ) : (
                <Clock className="size-6 text-muted-foreground" />
              )}
            </span>
            <CardTitle>
              {done
                ? "Payment received"
                : failed || verificationError
                  ? errorTitle
                  : "Confirming your payment"}
            </CardTitle>
            <CardDescription>
              {!reference
                ? "No payment reference was provided."
                : done
                  ? "Your wallet has been credited."
                  : failed || verificationError
                    ? errorDescription
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
              {!done && !failed && !verificationError && (
                <Button
                  variant="outline"
                  onClick={() => {
                    confirmedRef.current = null;
                    setVerificationStatus(null);
                    setAttemptCount(0);
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
