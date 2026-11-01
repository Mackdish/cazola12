import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// The referral tables/functions are newer than the generated database types, so these
// calls go through a loosely-typed client. All access control lives in the database
// (row-level security + permission checks inside each function), not in this file.
type Db = { rpc: (name: string, args?: Record<string, unknown>) => any; from: (table: string) => any };

const orgInput = z.object({ organizationId: z.string().uuid() });

function toFriendlyError(error: { message?: string } | null | undefined, fallback: string): never {
  const message = error?.message ?? "";
  if (message.includes("forbidden")) throw new Error("You don't have access to these referrals.");
  if (message.includes("referral_not_available_for_organization")) {
    throw new Error("Referrals are only available to advertiser and publisher accounts.");
  }
  throw new Error(fallback);
}

export type ReferralSettingsView = {
  enabled: boolean;
  commissionPercent: number;
  windowMonths: number;
  advertiserMilestone: number;
  publisherMilestone: number;
};

export type ReferralOverview = {
  code: string;
  settings: ReferralSettingsView;
  summary: {
    referrals: { total: number; pending: number; qualified: number; void: number };
    commissions: { pending: number; available: number; paid: number };
  };
  referrals: {
    id: string;
    status: "pending" | "qualified" | "void";
    createdAt: string;
    qualifiedAt: string | null;
    maskedName: string;
    kind: string;
    earned: number;
    pending: number;
  }[];
  commissions: {
    id: string;
    amount: number;
    status: "pending" | "available" | "paid" | "void";
    sourceRole: "advertiser" | "publisher";
    createdAt: string;
    availableAt: string;
    paidAt: string | null;
  }[];
};

function mapSettings(row: Record<string, unknown> | null | undefined): ReferralSettingsView {
  return {
    enabled: Boolean(row?.["enabled"]),
    commissionPercent: Number(row?.["commission_percent"] ?? 10),
    windowMonths: Number(row?.["commission_window_months"] ?? 12),
    advertiserMilestone: Number(row?.["advertiser_milestone_amount"] ?? 1000),
    publisherMilestone: Number(row?.["publisher_milestone_amount"] ?? 500),
  };
}

/** Everything the "Refer & Earn" page needs for one organization (advertiser or publisher). */
export const fetchReferralOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => orgInput.parse(data))
  .handler(async ({ data, context }): Promise<ReferralOverview> => {
    const db = context.supabase as unknown as Db;
    const org = data.organizationId;

    const codeResult = await db.rpc("get_or_create_referral_code", { _organization_id: org });
    if (codeResult.error) toFriendlyError(codeResult.error, "We couldn't load your referral code.");

    const [settings, summary, list, commissions] = await Promise.all([
      db.from("referral_settings").select("*").maybeSingle(),
      db.rpc("get_referral_summary", { _organization_id: org }),
      db.rpc("get_referral_list", { _organization_id: org, _limit: 100 }),
      db
        .from("referral_commissions")
        .select("id, amount, status, source_role, created_at, available_at, paid_at")
        .eq("referrer_organization_id", org)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    for (const result of [summary, list, commissions]) {
      if (result.error) toFriendlyError(result.error, "We couldn't load your referral activity.");
    }

    const s = (summary.data ?? {}) as {
      referrals?: Record<string, number>;
      commissions?: Record<string, number>;
    };
    return {
      code: codeResult.data as string,
      settings: mapSettings(settings.data),
      summary: {
        referrals: {
          total: Number(s.referrals?.["total"] ?? 0),
          pending: Number(s.referrals?.["pending"] ?? 0),
          qualified: Number(s.referrals?.["qualified"] ?? 0),
          void: Number(s.referrals?.["void"] ?? 0),
        },
        commissions: {
          pending: Number(s.commissions?.["pending"] ?? 0),
          available: Number(s.commissions?.["available"] ?? 0),
          paid: Number(s.commissions?.["paid"] ?? 0),
        },
      },
      referrals: ((list.data ?? []) as Record<string, unknown>[]).map((row) => ({
        id: String(row["id"]),
        status: row["status"] as ReferralOverview["referrals"][number]["status"],
        createdAt: String(row["created_at"]),
        qualifiedAt: (row["qualified_at"] as string | null) ?? null,
        maskedName: String(row["masked_name"] ?? "New member"),
        kind: String(row["kind"] ?? "member"),
        earned: Number(row["earned"] ?? 0),
        pending: Number(row["pending"] ?? 0),
      })),
      commissions: ((commissions.data ?? []) as Record<string, unknown>[]).map((row) => ({
        id: String(row["id"]),
        amount: Number(row["amount"] ?? 0),
        status: row["status"] as ReferralOverview["commissions"][number]["status"],
        sourceRole: row["source_role"] as "advertiser" | "publisher",
        createdAt: String(row["created_at"]),
        availableAt: String(row["available_at"]),
        paidAt: (row["paid_at"] as string | null) ?? null,
      })),
    };
  });

/** Called once after sign-in with a code remembered from a referral link. */
export const applyReferralCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ code: z.string().trim().min(4).max(20) }).parse(data))
  .handler(async ({ data, context }): Promise<{ ok: boolean; reason?: string }> => {
    const db = context.supabase as unknown as Db;
    const { data: result, error } = await db.rpc("apply_referral", { _code: data.code });
    if (error) return { ok: false, reason: "error" };
    const row = (result ?? {}) as { ok?: boolean; reason?: string };
    return row.ok ? { ok: true } : { ok: false, ...(row.reason ? { reason: row.reason } : {}) };
  });

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
async function assertPlatformAdmin(context: { supabase: unknown; userId: string }) {
  const db = context.supabase as Db;
  const { data, error } = await db.rpc("is_platform_admin", { _user_id: context.userId });
  if (error || !data) throw new Error("This area requires administrator access.");
}

async function audit(
  context: { supabase: unknown; userId: string },
  input: { action: string; targetId: string; label: string; metadata?: Record<string, unknown> },
) {
  try {
    const { logAuditEvent } = await import("@/lib/audit-log.server");
    await logAuditEvent(context as never, {
      action: input.action,
      targetType: "referral_program",
      targetId: input.targetId,
      targetLabel: input.label,
      ...(input.metadata ? { metadata: input.metadata } : {}),
    });
  } catch {
    // an audit hiccup must never block the admin action itself
  }
}

export type AdminReferralOverview = {
  settings: ReferralSettingsView;
  stats: {
    referralsTotal: number;
    referralsPending: number;
    referralsQualified: number;
    referralsVoid: number;
    commissionPending: number;
    commissionAvailable: number;
    commissionPaid: number;
  };
  referrals: {
    id: string;
    status: "pending" | "qualified" | "void";
    createdAt: string;
    qualifiedAt: string | null;
    voidReason: string | null;
    referrerName: string;
    referrerType: string;
    referredName: string | null;
    referredType: string | null;
    earned: number;
    pending: number;
  }[];
};

export const adminFetchReferralOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminReferralOverview> => {
    await assertPlatformAdmin(context);
    const db = context.supabase as unknown as Db;
    const [settings, overview] = await Promise.all([
      db.from("referral_settings").select("*").maybeSingle(),
      db.rpc("admin_referral_overview", { _limit: 200 }),
    ]);
    if (overview.error) toFriendlyError(overview.error, "We couldn't load referral data.");
    const o = (overview.data ?? {}) as { stats?: Record<string, number>; referrals?: Record<string, unknown>[] };
    const st = o.stats ?? {};
    return {
      settings: mapSettings(settings.data),
      stats: {
        referralsTotal: Number(st["referrals_total"] ?? 0),
        referralsPending: Number(st["referrals_pending"] ?? 0),
        referralsQualified: Number(st["referrals_qualified"] ?? 0),
        referralsVoid: Number(st["referrals_void"] ?? 0),
        commissionPending: Number(st["commission_pending"] ?? 0),
        commissionAvailable: Number(st["commission_available"] ?? 0),
        commissionPaid: Number(st["commission_paid"] ?? 0),
      },
      referrals: (o.referrals ?? []).map((row) => ({
        id: String(row["id"]),
        status: row["status"] as AdminReferralOverview["referrals"][number]["status"],
        createdAt: String(row["created_at"]),
        qualifiedAt: (row["qualified_at"] as string | null) ?? null,
        voidReason: (row["void_reason"] as string | null) ?? null,
        referrerName: String(row["referrer_name"] ?? "—"),
        referrerType: String(row["referrer_type"] ?? ""),
        referredName: (row["referred_name"] as string | null) ?? null,
        referredType: (row["referred_type"] as string | null) ?? null,
        earned: Number(row["earned"] ?? 0),
        pending: Number(row["pending"] ?? 0),
      })),
    };
  });

const settingsInput = z.object({
  enabled: z.boolean(),
  commissionPercent: z.number().min(0).max(40),
  windowMonths: z.number().int().min(0).max(120),
  advertiserMilestone: z.number().min(0).max(100_000_000),
  publisherMilestone: z.number().min(0).max(100_000_000),
});

export type ReferralSettingsInput = z.infer<typeof settingsInput>;

export const adminUpdateReferralSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => settingsInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as Db;
    const { error } = await db
      .from("referral_settings")
      .update({
        enabled: data.enabled,
        commission_percent: data.commissionPercent,
        commission_window_months: data.windowMonths,
        advertiser_milestone_amount: data.advertiserMilestone,
        publisher_milestone_amount: data.publisherMilestone,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", true);
    if (error) throw new Error("We couldn't save the referral settings.");
    await audit(context, {
      action: "referral.settings_updated",
      targetId: "settings",
      label: data.enabled ? "Referral program settings (enabled)" : "Referral program settings (paused)",
      metadata: { ...data },
    });
    return { ok: true };
  });

export const adminVoidReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ referralId: z.string().uuid(), reason: z.string().trim().max(500).optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context);
    const db = context.supabase as unknown as Db;
    const { error } = await db.rpc("admin_void_referral", {
      _referral_id: data.referralId,
      _reason: data.reason ?? null,
    });
    if (error) toFriendlyError(error, "We couldn't cancel that referral.");
    await audit(context, {
      action: "referral.voided",
      targetId: data.referralId,
      label: "Referral cancelled",
      metadata: { reason: data.reason ?? null },
    });
    return { ok: true };
  });

export type ReferralProcessResult = {
  enabled: boolean;
  skipped: boolean;
  accrued: number;
  qualified: number;
  released: number;
  voided: number;
  walletsCredited: number;
};

/** Runs the accrual/qualify/release/pay cycle now (it also runs automatically every 5 minutes). */
export const adminProcessReferrals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ReferralProcessResult> => {
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as unknown as Db).rpc("process_referrals");
    if (error) throw new Error("We couldn't process referrals right now.");
    const row = (data ?? {}) as Record<string, unknown>;
    return {
      enabled: row["enabled"] !== false,
      skipped: row["skipped"] === true,
      accrued: Number(row["accrued"] ?? 0),
      qualified: Number(row["qualified"] ?? 0),
      released: Number(row["released"] ?? 0),
      voided: Number(row["voided"] ?? 0),
      walletsCredited: Number(row["wallets_credited"] ?? 0),
    };
  });
