/**
 * Pure billing/earnings domain logic.
 *
 * No database, no network — everything here is deterministic and unit tested.
 * Money is handled in minor-unit-safe integers internally (see `toCents`) so a
 * long list of 4-decimal amounts never drifts through float addition.
 */
import type { Database } from "@/integrations/supabase/types";
import type { StatusTone } from "@/components/patterns/status-badge";

export type WalletTransactionType = Database["public"]["Enums"]["wallet_transaction_type"];
export type BillingEventType = Database["public"]["Enums"]["billing_event_type"];
export type EarningStatus = Database["public"]["Enums"]["earning_status"];
export type PayoutStatus = Database["public"]["Enums"]["payout_status"];

/** Charge reasons returned by `charge_campaign_event`. */
export type ChargeReason =
  | "charged"
  | "duplicate"
  | "not_billable"
  | "campaign_inactive"
  | "unknown_campaign"
  | "budget_exhausted"
  | "insufficient_funds"
  | "no_wallet"
  | "invalid_request"
  | "error";

export type ChargeResult = {
  ok: boolean;
  reason: ChargeReason;
  amount: number;
  publisherAmount: number;
  platformAmount: number;
};

// -------------------------------------------------------------------- money

/** Amounts arrive from Postgres numeric as strings; normalise to a number. */
export function amount(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Integer 1/10000 units — the same scale as the numeric(14,4) columns. */
export function toUnits(value: number | string | null | undefined): number {
  return Math.round(amount(value) * 10_000);
}

export function fromUnits(units: number): number {
  return units / 10_000;
}

/** Exact summation of a list of numeric amounts. */
export function sumAmounts(values: Array<number | string | null | undefined>): number {
  return fromUnits(values.reduce<number>((total, value) => total + toUnits(value), 0));
}

export function formatMoney(
  value: number | string | null | undefined,
  currency = "USD",
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount(value));
}

/** Sub-cent amounts (a single CPM impression) need more precision to be useful. */
export function formatPreciseMoney(
  value: number | string | null | undefined,
  currency = "USD",
): string {
  const numeric = amount(value);
  if (numeric !== 0 && Math.abs(numeric) < 0.01) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(numeric);
  }
  return formatMoney(numeric, currency);
}

export function formatPercent(share: number | string | null | undefined): string {
  return `${Math.round(amount(share) * 1000) / 10}%`;
}

// ---------------------------------------------------------------- splitting

export type RevenueSplit = { publisherAmount: number; platformAmount: number };

/**
 * Configurable split. The publisher share is rounded and the platform takes
 * the remainder, so the two parts always add back up to the gross amount.
 */
export function splitRevenue(gross: number | string, publisherShare: number): RevenueSplit {
  const grossUnits = toUnits(gross);
  const clamped = Math.min(Math.max(publisherShare, 0), 1);
  const publisherUnits = Math.round(grossUnits * clamped);
  return {
    publisherAmount: fromUnits(publisherUnits),
    platformAmount: fromUnits(grossUnits - publisherUnits),
  };
}

/** What a single billable event costs the advertiser. */
export function eventCharge(
  bidType: Database["public"]["Enums"]["bid_type"],
  bidAmount: number | string,
  event: BillingEventType,
): number {
  if (bidType === "cpc" && event === "click") return fromUnits(toUnits(bidAmount));
  if (bidType === "cpm" && event === "impression")
    return fromUnits(Math.round(toUnits(bidAmount) / 1000));
  return 0;
}

// ------------------------------------------------------------------ summary

export type EarningRow = {
  status: EarningStatus;
  publisher_amount: number | string;
  platform_amount: number | string;
  gross_amount: number | string;
};

export type EarningsSummary = {
  totalEarned: number;
  pending: number;
  available: number;
  paid: number;
  reversed: number;
  grossServed: number;
  platformRevenue: number;
};

/**
 * `totalEarned` deliberately excludes reversed earnings — a refunded event was
 * never really earned, and showing it would never reconcile with payouts.
 */
export function summariseEarnings(rows: EarningRow[]): EarningsSummary {
  const by = (status: EarningStatus) =>
    sumAmounts(rows.filter((row) => row.status === status).map((row) => row.publisher_amount));

  const pending = by("pending");
  const available = by("available");
  const paid = by("paid");
  const reversed = by("reversed");

  return {
    pending,
    available,
    paid,
    reversed,
    totalEarned: sumAmounts([pending, available, paid]),
    grossServed: sumAmounts(
      rows.filter((row) => row.status !== "reversed").map((row) => row.gross_amount),
    ),
    platformRevenue: sumAmounts(
      rows.filter((row) => row.status !== "reversed").map((row) => row.platform_amount),
    ),
  };
}

/** Payout eligibility mirrors the database checks so the UI can explain itself. */
export function payoutBlocker(input: {
  available: number;
  minimumPayout: number;
  hasOpenPayout: boolean;
  canManage: boolean;
}): string | null {
  if (!input.canManage) return "Only organization owners and admins can request a payout.";
  if (input.hasOpenPayout) return "You already have a payout in progress.";
  if (input.available <= 0) return "You have no available earnings yet.";
  if (input.available < input.minimumPayout) {
    return `Available earnings must reach ${formatMoney(input.minimumPayout)} before you can request a payout.`;
  }
  return null;
}

export function canRequestPayout(input: Parameters<typeof payoutBlocker>[0]): boolean {
  return payoutBlocker(input) === null;
}

/** Allowed payout transitions, enforced again in the database. */
export function nextPayoutStatuses(status: PayoutStatus): PayoutStatus[] {
  if (status === "pending") return ["approved", "rejected"];
  if (status === "approved") return ["paid", "rejected"];
  return [];
}

export function isPayoutOpen(status: PayoutStatus): boolean {
  return status === "pending" || status === "approved";
}

// ------------------------------------------------------------------- labels

export function transactionLabel(type: WalletTransactionType): string {
  const labels: Record<WalletTransactionType, string> = {
    deposit: "Deposit",
    spend: "Spend",
    refund: "Refund",
    adjustment: "Adjustment",
  };
  return labels[type];
}

/** Deposits and refunds add to the balance; spend and adjustments subtract. */
export function transactionDirection(type: WalletTransactionType): "credit" | "debit" {
  return type === "deposit" || type === "refund" ? "credit" : "debit";
}

export function signedTransactionAmount(
  type: WalletTransactionType,
  value: number | string,
): string {
  const prefix = transactionDirection(type) === "credit" ? "+" : "−";
  return `${prefix}${formatPreciseMoney(value)}`;
}

export function earningStatusTone(status: EarningStatus): StatusTone {
  const tones: Record<EarningStatus, StatusTone> = {
    pending: "pending",
    available: "info",
    paid: "active",
    reversed: "suspended",
  };
  return tones[status];
}

export function payoutStatusTone(status: PayoutStatus): StatusTone {
  const tones: Record<PayoutStatus, StatusTone> = {
    pending: "pending",
    approved: "info",
    paid: "active",
    rejected: "suspended",
  };
  return tones[status];
}

export function eventLabel(event: BillingEventType): string {
  return event === "click" ? "Click" : "Impression";
}

export const PAYOUT_METHODS = ["bank_transfer", "paypal", "wise"] as const;
export type PayoutMethod = (typeof PAYOUT_METHODS)[number];

export function payoutMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    bank_transfer: "Bank transfer",
    paypal: "PayPal",
    wise: "Wise",
  };
  return labels[method] ?? method;
}

/** Human-readable explanation for a non-charge, used by diagnostics and logs. */
export function chargeReasonLabel(reason: ChargeReason): string {
  const labels: Record<ChargeReason, string> = {
    charged: "Charged",
    duplicate: "Already charged for this request",
    not_billable: "Event type doesn't match the campaign bid model",
    campaign_inactive: "Campaign is not approved and active",
    unknown_campaign: "Campaign no longer exists",
    budget_exhausted: "Campaign budget is exhausted",
    insufficient_funds: "Advertiser wallet balance is too low",
    no_wallet: "Advertiser has no wallet",
    invalid_request: "Invalid billing request",
    error: "Billing failed",
  };
  return labels[reason];
}
