/**
 * Server-only billing, earnings and payout service.
 *
 * Every balance change goes through a SECURITY DEFINER database function that
 * locks the wallet row, so concurrent ad events can never oversell a balance or
 * double-charge a request. Nothing here writes to a financial table directly.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import {
  amount,
  isPayoutOpen,
  sumAmounts,
  summariseEarnings,
  type EarningsSummary,
  type PayoutStatus,
} from "@/lib/billing-domain";
import { checkAdminRateLimit } from "@/lib/rate-limit.server";
import { getSupportedCurrencies as getSupportedCurrenciesFromConfig } from "@/lib/payment-config.server";

type Client = SupabaseClient<Database>;
export type Ctx = { supabase: Client; userId: string };

export class BillingError extends Error {}

function fail(message: string): never {
  throw new BillingError(message);
}

/** Maps raw Postgres exceptions to messages a user can act on. */
function translate(message: string, fallback: string): never {
  const map: Array<[RegExp, string]> = [
    [/forbidden/i, "You don't have permission to perform this financial operation."],
    [/invalid_amount/i, "Enter an amount between $0.01 and $1,000,000."],
    [/invalid_input/i, "Choose a payout method and enter a destination."],
    [/missing_idempotency_key/i, "The request was missing its safety key. Please try again."],
    [/no_publisher_profile/i, "Complete your publisher profile before requesting a payout."],
    [/payout_in_progress/i, "You already have a payout in progress."],
    [/no_available_earnings/i, "You have no available earnings to pay out yet."],
    [/below_minimum_payout/i, "Your available earnings are below the payout minimum."],
    [/invalid_transition/i, "That payout can't move to this status."],
    [
      /payment_reference_required/i,
      "Add the payment reference before marking this payout as paid.",
    ],
    [
      /earning_already_paid/i,
      "This event's earning has already been paid out and can't be refunded.",
    ],
    [/unknown_payout/i, "That payout no longer exists."],
    [/unknown_spend/i, "That charge no longer exists."],
    [/no_wallet/i, "That organization has no wallet yet."],
    [/immutable/i, "Financial records can't be edited."],
  ];
  for (const [pattern, friendly] of map) if (pattern.test(message)) fail(friendly);
  fail(fallback);
}

async function requireStaff(ctx: Ctx): Promise<void> {
  const { data, error } = await ctx.supabase.rpc("is_platform_admin", { _user_id: ctx.userId });
  if (error || !data) fail("You don't have permission to do that.");
}

// ------------------------------------------------------------------ settings

export async function getBillingSettings(ctx: Ctx) {
  const { data, error } = await ctx.supabase.from("platform_settings").select("*").maybeSingle();
  if (error) fail("We couldn't load the billing settings.");
  const r = data as any;
  return {
    publisherRevenueShare: amount(r?.publisher_revenue_share ?? 0.4),
    earningsHoldDays: r?.earnings_hold_days ?? 7,
    minimumPayoutAmount: amount(r?.minimum_payout_amount ?? 0),
    campaignMinimumBudget: amount(r?.campaign_minimum_budget ?? 300),
    minimumDailyBudget: amount(r?.minimum_daily_budget ?? 100),
    startingCpc: amount(r?.starting_cpc ?? 5),
    currency: r?.currency ?? "KES",
    maximumBidAmount: amount(r?.maximum_bid_amount ?? 10000),
    maximumCampaignBudget: amount(r?.maximum_campaign_budget ?? 100_000_000),
    maximumDailyBudget: amount(r?.maximum_daily_budget ?? 100_000_000),
    assumedCtr: amount(r?.assumed_ctr ?? 0.01),
    defaultBidAmount: amount(r?.default_bid_amount ?? 5),
    defaultTotalBudget: amount(r?.default_total_budget ?? 300),
  };
}

export async function saveBillingSettings(
  ctx: Ctx,
  input: { publisherRevenueShare: number; earningsHoldDays: number; minimumPayoutAmount: number },
) {
  const { data, error } = await ctx.supabase.rpc("update_platform_billing_settings", {
    _publisher_revenue_share: input.publisherRevenueShare,
    _earnings_hold_days: input.earningsHoldDays,
    _minimum_payout_amount: input.minimumPayoutAmount,
  });
  if (error) translate(error.message, "We couldn't update the billing settings.");
  const row = Array.isArray(data) ? data[0]! : data!;

  const { logAuditEvent } = await import("@/lib/audit-log.server");
  await logAuditEvent(ctx, {
    action: "settings.billing.update",
    targetType: "platform_settings",
    targetId: "platform_settings",
    metadata: {
      publisherRevenueShare: input.publisherRevenueShare,
      earningsHoldDays: input.earningsHoldDays,
      minimumPayoutAmount: input.minimumPayoutAmount,
    },
  });

  return {
    publisherRevenueShare: amount(row.publisher_revenue_share),
    earningsHoldDays: row.earnings_hold_days,
    minimumPayoutAmount: amount(row.minimum_payout_amount),
  };
}

// -------------------------------------------------------------------- wallet

export async function getWallet(ctx: Ctx, organizationId: string, currency = "KES") {
  await logWalletSchema(ctx);

  const payload = {
    _organization_id: organizationId,
    _currency: currency,
    _country_code: "KE",
  };

  const { data, error } = await ctx.supabase.rpc("ensure_wallet_for_currency" as never, payload as never);

  if (error) {
    console.error("[WALLET RPC ERROR]", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      organizationId,
      currency,
      payload,
    });
    translate(error.message, "We couldn't load your wallet.");
  }

  const row = (Array.isArray(data) ? data[0] : data) as any;
  console.log("[WALLET RPC RESPONSE]", { data, row, organizationId, currency });

  if (!row?.id) {
    console.error("[WALLET RPC NO ROW]", { data, organizationId, currency, payload });
    fail("We couldn't load your wallet.");
  }

  return {
    id: row.id,
    organizationId: row.organization_id,
    currency: row.currency,
    countryCode: row.country_code,
    balance: amount(row.balance_amount),
    lifetimeDeposited: amount(row.lifetime_deposited),
    lifetimeSpent: amount(row.lifetime_spent),
    lowBalanceThreshold: amount(row.low_balance_threshold),
  };
}

let loggedSchema = false;
async function logWalletSchema(ctx: Ctx) {
  if (loggedSchema) return;
  loggedSchema = true;
  try {
    const { data, error } = await (ctx.supabase as any)
      .from("information_schema.columns")
      .select("column_name, data_type, is_nullable")
      .eq("table_schema", "public")
      .eq("table_name", "wallets")
      .order("ordinal_position");

    console.log("[WALLET SCHEMA]", { data, error });
  } catch (e) {
    console.error("[WALLET SCHEMA ERROR]", e);
  }
}

export async function getWallets(ctx: Ctx, organizationId: string) {
  const { data, error } = await ctx.supabase.rpc("get_user_wallets" as never, {
    _organization_id: organizationId,
  } as never);
  if (error) fail("We couldn't load your wallets.");
  const rows = (Array.isArray(data) ? data : data ? [data] : []) as any[];
  return rows.map((row) => ({
    id: row.id,
    currency: row.currency,
    countryCode: row.country_code,
    balance: amount(row.balance_amount),
    lifetimeDeposited: amount(row.lifetime_deposited),
    lifetimeSpent: amount(row.lifetime_spent),
  }));
}

export async function getSupportedCurrencies(ctx: Ctx) {
  return getSupportedCurrenciesFromConfig(ctx.supabase);
}

export async function listWalletTransactions(
  ctx: Ctx,
  organizationId: string,
  options?: { currency?: string; limit?: number },
) {
  const limit = options?.limit ?? 100;
  const currency = options?.currency;

  let query = (ctx.supabase as any)
    .from("wallet_transactions")
    .select(
      "id, type, amount, balance_after, reference_type, reference_id, description, created_at, currency",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (currency) {
    query = query.eq("currency", currency);
  }

  const { data, error } = await query;

  if (error) fail("We couldn't load your transactions.");
  return (data ?? []).map((row: any) => ({
    id: row.id,
    type: row.type,
    amount: amount(row.amount),
    balanceAfter: amount(row.balance_after),
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    description: row.description,
    currency: row.currency,
    createdAt: row.created_at,
  }));
}

export async function depositToWallet(
  ctx: Ctx,
  input: {
    organizationId: string;
    amount: number;
    currency?: string;
    idempotencyKey: string;
    description?: string | null;
  },
) {
  const currency = input.currency ?? "KES";
  const { data, error } = await ctx.supabase.rpc("deposit_to_wallet_for_currency" as never, {
    _organization_id: input.organizationId,
    _amount: input.amount,
    _currency: currency,
    _idempotency_key: input.idempotencyKey,
    ...(input.description ? { _description: input.description } : {}),
  } as never);
  if (error) translate(error.message, "We couldn't add funds to your wallet.");
  const result = (data ?? {}) as { ok?: boolean; duplicate?: boolean; balance?: number | string; currency?: string };
  return {
    ok: result.ok !== false,
    duplicate: result.duplicate === true,
    balance: amount(result.balance),
    currency: result.currency ?? currency,
  };
}

// --------------------------------------------------------- advertiser spend

export async function listCampaignSpend(ctx: Ctx, organizationId: string, limit = 100) {
  const { data, error } = await ctx.supabase
    .from("campaign_spend")
    .select(
      "id, event_type, amount, publisher_amount, platform_amount, created_at, campaigns(name)",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) fail("We couldn't load your spending history.");
  return (data ?? []).map((row) => {
    const { campaigns, ...spend } = row as typeof row & { campaigns: { name: string } | null };
    return { ...spend, campaignName: campaigns?.name ?? "Campaign" };
  });
}

// ---------------------------------------------------------------- earnings

export type EarningsPage = {
  summary: EarningsSummary;
  recent: Array<{
    id: string;
    event_type: Database["public"]["Enums"]["billing_event_type"];
    status: Database["public"]["Enums"]["earning_status"];
    gross_amount: number | string;
    publisher_amount: number | string;
    platform_amount: number | string;
    revenue_share: number | string;
    available_at: string;
    created_at: string;
    websiteName: string;
    zoneName: string;
  }>;
  revenueShare: number;
  holdDays: number;
};

export async function getPublisherEarnings(
  ctx: Ctx,
  organizationId: string,
): Promise<EarningsPage> {
  // Mature pending → available before reading, so the dashboard never shows a
  // stale "pending" balance whose hold period has already elapsed.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await (supabaseAdmin as unknown as Client).rpc("mature_publisher_earnings", {
    _organization_id: organizationId,
  });

  const [{ data: all, error: allError }, { data: recent, error: recentError }, settings] =
    await Promise.all([
      ctx.supabase
        .from("publisher_earnings")
        .select("status, publisher_amount, platform_amount, gross_amount")
        .eq("organization_id", organizationId),
      ctx.supabase
        .from("publisher_earnings")
        .select(
          "id, event_type, status, gross_amount, publisher_amount, platform_amount, revenue_share, available_at, created_at, websites(name), ad_zones(name)",
        )
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(50),
      getBillingSettings(ctx),
    ]);
  if (allError || recentError) fail("We couldn't load your earnings.");

  return {
    summary: summariseEarnings(all ?? []),
    recent: (recent ?? []).map((row) => {
      const { websites, ad_zones, ...earning } = row as typeof row & {
        websites: { name: string } | null;
        ad_zones: { name: string } | null;
      };
      return {
        ...earning,
        websiteName: websites?.name ?? "—",
        zoneName: ad_zones?.name ?? "—",
      };
    }),
    revenueShare: settings.publisherRevenueShare,
    holdDays: settings.earningsHoldDays,
  };
}

// ----------------------------------------------------------------- payouts

export async function listPayouts(ctx: Ctx, organizationId: string) {
  const { data, error } = await ctx.supabase
    .from("payouts")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (error) fail("We couldn't load your payouts.");
  return data ?? [];
}

export async function requestPayout(
  ctx: Ctx,
  input: { organizationId: string; method: string; destination: string },
) {
  const { data, error } = await ctx.supabase.rpc("request_payout", {
    _organization_id: input.organizationId,
    _method: input.method,
    _destination: input.destination,
  });
  if (error) translate(error.message, "We couldn't submit your payout request.");
  return Array.isArray(data) ? data[0]! : data!;
}

export async function adminListPayouts(ctx: Ctx) {
  await requireStaff(ctx);
  const { data, error } = await ctx.supabase
    .from("payouts")
    .select("*, publishers(business_name, contact_email), organizations(name)")
    .order("created_at", { ascending: false });
  if (error) fail("We couldn't load payouts.");
  return (data ?? []).map((row) => {
    const { publishers, organizations, ...payout } = row as typeof row & {
      publishers: { business_name: string; contact_email: string } | null;
      organizations: { name: string } | null;
    };
    return {
      ...payout,
      publisherName: publishers?.business_name ?? organizations?.name ?? "Publisher",
      publisherEmail: publishers?.contact_email ?? null,
      organizationName: organizations?.name ?? "—",
    };
  });
}

export async function adminReviewPayout(
  ctx: Ctx,
  input: {
    payoutId: string;
    status: PayoutStatus;
    reason?: string | null;
    paymentReference?: string | null;
  },
) {
  await requireStaff(ctx);
  await checkAdminRateLimit(ctx.supabase as never, ctx.userId);
  const { data, error } = await ctx.supabase.rpc("review_payout", {
    _payout_id: input.payoutId,
    _status: input.status,
    ...(input.reason ? { _reason: input.reason } : {}),
    ...(input.paymentReference ? { _payment_reference: input.paymentReference } : {}),
  });
  if (error) translate(error.message, "We couldn't update that payout.");
  const result = Array.isArray(data) ? data[0]! : data!;

  const { logAuditEvent } = await import("@/lib/audit-log.server");
  await logAuditEvent(ctx, {
    action: `payout.${input.status}`,
    targetType: "payout",
    targetId: input.payoutId,
    metadata: { reason: input.reason ?? null, paymentReference: input.paymentReference ?? null },
  });

  return result;
}

// ------------------------------------------------------- admin ledger view

export async function adminGetLedger(ctx: Ctx) {
  await requireStaff(ctx);

  const [transactions, spend, earnings, payouts] = await Promise.all([
    ctx.supabase
      .from("wallet_transactions")
      .select("id, type, amount, balance_after, description, created_at, organizations(name)")
      .order("created_at", { ascending: false })
      .limit(150),
    ctx.supabase
      .from("campaign_spend")
      .select("amount, publisher_amount, platform_amount")
      .limit(500),
    ctx.supabase
      .from("publisher_earnings")
      .select("status, publisher_amount, platform_amount, gross_amount")
      .limit(500),
    ctx.supabase
      .from("payouts")
      .select("status, amount")
      .limit(500),
  ]);

  if (transactions.error || spend.error || earnings.error || payouts.error) {
    fail("We couldn't load the ledger.");
  }

  const spendRows = spend.data ?? [];
  const payoutRows = payouts.data ?? [];

  return {
    transactions: (transactions.data ?? []).map((row) => {
      const { organizations, ...txn } = row as typeof row & {
        organizations: { name: string } | null;
      };
      return { ...txn, organizationName: organizations?.name ?? "—" };
    }),
    totals: {
      grossSpend: sumAmounts(spendRows.map((row) => row.amount)),
      publisherShare: sumAmounts(spendRows.map((row) => row.publisher_amount)),
      platformRevenue: sumAmounts(spendRows.map((row) => row.platform_amount)),
      chargedEvents: spendRows.length,
      deposits: sumAmounts(
        (transactions.data ?? []).filter((row) => row.type === "deposit").map((row) => row.amount),
      ),
      payoutsPaid: sumAmounts(
        payoutRows.filter((row) => row.status === "paid").map((row) => row.amount),
      ),
      payoutsOpen: sumAmounts(
        payoutRows.filter((row) => isPayoutOpen(row.status)).map((row) => row.amount),
      ),
    },
    earnings: summariseEarnings(earnings.data ?? []),
  };
}

export async function adminRefundSpend(
  ctx: Ctx,
  input: { campaignSpendId: string; reason?: string | null },
) {
  await requireStaff(ctx);
  await checkAdminRateLimit(ctx.supabase as never, ctx.userId);
  const { data, error } = await ctx.supabase.rpc("refund_campaign_spend", {
    _campaign_spend_id: input.campaignSpendId,
    ...(input.reason ? { _reason: input.reason } : {}),
  });
  if (error) translate(error.message, "We couldn't refund that charge.");
  const result = (data ?? {}) as { ok?: boolean; duplicate?: boolean; amount?: number | string };

  const { logAuditEvent } = await import("@/lib/audit-log.server");
  await logAuditEvent(ctx, {
    action: "campaign_spend.refund",
    targetType: "campaign_spend",
    targetId: input.campaignSpendId,
    metadata: { reason: input.reason ?? null, amount: result.amount },
  });

  return {
    ok: result.ok !== false,
    duplicate: result.duplicate === true,
    amount: amount(result.amount),
  };
}

export async function adminListWalletTransactions(
  ctx: Ctx,
  filters: { organizationId?: string; type?: string; search?: string; page?: number; pageSize?: number } = {},
) {
  await requireStaff(ctx);
  let query = ctx.supabase
    .from("wallet_transactions")
    .select("*, organizations(name)", { count: "exact" })
    .order("created_at", { ascending: false });

  if (filters.organizationId) query = query.eq("organization_id", filters.organizationId);
  if (filters.type && filters.type !== "all")
    query = query.eq("type", filters.type as "deposit" | "spend" | "refund" | "adjustment");
  if (filters.search) {
    const term = `%${filters.search}%`;
    query = query.or(`description.ilike.${term},reference_id.ilike.${term}`);
  }

  const pageSize = Math.max(1, filters.pageSize ?? 20);
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const [dataRes, countRes] = await Promise.all([
    (query as any).range(from, to),
    (query as any).select("*", { count: "exact", head: true }),
  ]);

  if (dataRes.error) fail("We couldn't load wallet transactions.");
  return {
    transactions: (dataRes.data ?? []).map((row: any) => {
      const { organizations, ...txn } = row as typeof row & {
        organizations: { name: string } | null;
      };
      return { ...txn, organizationName: organizations?.name ?? "—" };
    }),
    total: countRes.count ?? 0,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil((countRes.count ?? 0) / pageSize)),
  };
}

export async function adminGetWallet(ctx: Ctx, organizationId: string) {
  await requireStaff(ctx);
  const { data, error } = await ctx.supabase
    .from("wallets")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) fail("We couldn't load that wallet.");
  if (!data) fail("That organization has no wallet.");
  return {
    id: data.id,
    organizationId: data.organization_id,
    currency: data.currency,
    balance: amount(data.balance_amount),
    lifetimeDeposited: amount(data.lifetime_deposited),
    lifetimeSpent: amount(data.lifetime_spent),
    lowBalanceThreshold: amount(data.low_balance_threshold),
  };
}

export async function adminAdjustWallet(
  ctx: Ctx,
  input: { walletId: string; amount: number; reason: string },
) {
  await requireStaff(ctx);
  await checkAdminRateLimit(ctx.supabase as never, ctx.userId);
  const wallet = await ctx.supabase
    .from("wallets")
    .select("organization_id")
    .eq("id", input.walletId)
    .maybeSingle();
  if (wallet.error || !wallet.data) fail("That wallet doesn't exist.");

  const { data, error } = await ctx.supabase.rpc("deposit_to_wallet", {
    _organization_id: wallet.data.organization_id,
    _amount: input.amount,
    _idempotency_key: `admin-adjust-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    _description: `Admin adjustment: ${input.reason}`,
  } as never);
  if (error) translate(error.message, "We couldn't adjust that wallet.");
  const result = Array.isArray(data) ? data[0]! : data!;

  const { logAuditEvent } = await import("@/lib/audit-log.server");
  await logAuditEvent(ctx, {
    action: "wallet.adjust",
    targetType: "wallet",
    targetId: input.walletId,
    metadata: { amount: input.amount, reason: input.reason },
  });

  return result;
}

export async function adminListDeposits(
  ctx: Ctx,
  filters: { organizationId?: string; page?: number; pageSize?: number } = {},
) {
  await requireStaff(ctx);
  let query = ctx.supabase
    .from("wallet_transactions")
    .select("*, organizations(name)", { count: "exact" })
    .eq("type", "deposit")
    .order("created_at", { ascending: false });

  if (filters.organizationId) query = query.eq("organization_id", filters.organizationId);

  const pageSize = Math.max(1, filters.pageSize ?? 20);
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const [dataRes, countRes] = await Promise.all([
    (query as any).range(from, to),
    (query as any).select("*", { count: "exact", head: true }),
  ]);

  if (dataRes.error) fail("We couldn't load deposits.");
  return {
    deposits: (dataRes.data ?? []).map((row: any) => {
      const { organizations, ...txn } = row as typeof row & {
        organizations: { name: string } | null;
      };
      return { ...txn, organizationName: organizations?.name ?? "—" };
    }),
    total: countRes.count ?? 0,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil((countRes.count ?? 0) / pageSize)),
  };
}
