/**
 * Serving diagnostics for the in-app sandbox.
 *
 * Runs the exact same eligibility + selection code the live endpoint uses, but
 * returns *why* each candidate passed or failed. Access is restricted to
 * platform staff and members of the zone's own organization — the public
 * endpoint never exposes any of this.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { parseSchedule, type RequestSignals } from "@/lib/advertiser-domain";
import {
  candidateIsEligible,
  classifyUserAgent,
  scoreCandidate,
  selectAd,
  weekdayOf,
  zoneIsServeable,
  type DeviceType,
  type IneligibleReason,
} from "@/lib/ad-serving-domain";
import { loadCandidates, loadZoneContext } from "@/lib/ad-serving.server";

type Ctx = { supabase: SupabaseClient<Database>; userId: string };

export class DiagnosticsError extends Error {}

export type ZoneOption = {
  zoneKey: string;
  zoneName: string;
  format: string;
  websiteDomain: string;
  websiteApproval: string;
  websiteVerification: string;
  zoneStatus: string;
};

/** Zones the signed-in user can test: their own, or all of them for staff. */
export async function listSandboxZones(ctx: Ctx): Promise<ZoneOption[]> {
  const { data, error } = await ctx.supabase
    .from("ad_zones")
    .select(
      `zone_key, name, format, status, websites!inner(domain, approval_status, verification_status)`,
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new DiagnosticsError("We couldn't load your ad zones.");

  return (data ?? []).map((row) => {
    const website = row.websites as unknown as {
      domain: string;
      approval_status: string;
      verification_status: string;
    };
    return {
      zoneKey: row.zone_key,
      zoneName: row.name,
      format: row.format,
      zoneStatus: row.status,
      websiteDomain: website.domain,
      websiteApproval: website.approval_status,
      websiteVerification: website.verification_status,
    };
  });
}

export type ZoneDiagnostics = {
  zone: {
    zoneKey: string;
    format: string;
    status: string;
    websiteApproval: string;
    websiteVerification: string;
    websiteCategory: string;
    serveable: boolean;
    blockedBy: string | null;
  };
  signals: {
    device: DeviceType;
    os: string;
    browser: string;
    country: string | null;
    weekday: string;
    hour: number;
  };
  candidates: Array<{
    adId: string;
    adName: string;
    adFormat: string;
    verdict: "eligible" | IneligibleReason;
    score: number | null;
    winner: boolean;
  }>;
};

export async function diagnoseZone(
  ctx: Ctx,
  input: { zoneKey: string; device?: DeviceType | undefined; country?: string | undefined },
): Promise<ZoneDiagnostics> {
  const zone = await loadZoneContext(input.zoneKey);
  if (!zone) throw new DiagnosticsError("That zone key doesn't exist.");

  const staff = await ctx.supabase.rpc("is_platform_staff", { _user_id: ctx.userId });
  if (!staff.data) {
    const owned = await ctx.supabase
      .from("ad_zones")
      .select("id")
      .eq("id", zone.zoneId)
      .maybeSingle();
    if (!owned.data) throw new DiagnosticsError("You don't have access to that zone.");
  }

  const now = new Date();
  const agent = classifyUserAgent(null);
  const device = input.device ?? agent.device;
  const signals: RequestSignals = {
    device,
    os: agent.os,
    browser: agent.browser,
    websiteCategory: zone.websiteCategory,
    weekday: weekdayOf(now),
    hour: now.getUTCHours(),
    ...(input.country ? { country: input.country } : {}),
  };

  const gate = zoneIsServeable(zone);
  const candidates = await loadCandidates(zone);
  const winnerId = gate.eligible
    ? (selectAd(candidates, zone, { now, signals }).winner?.adId ?? null)
    : null;

  return {
    zone: {
      zoneKey: input.zoneKey,
      format: zone.zoneFormat,
      status: zone.zoneStatus,
      websiteApproval: zone.websiteApproval,
      websiteVerification: zone.websiteVerification,
      websiteCategory: zone.websiteCategory,
      serveable: gate.eligible,
      blockedBy: gate.eligible ? null : gate.reason,
    },
    signals: {
      device,
      os: agent.os,
      browser: agent.browser,
      country: input.country ?? null,
      weekday: signals.weekday ?? "",
      hour: signals.hour ?? 0,
    },
    candidates: candidates
      .map((candidate) => {
        const verdict = candidateIsEligible(candidate, zone, { now, signals });
        return {
          adId: candidate.adId,
          adName: candidate.adName,
          adFormat: candidate.adFormat,
          verdict: verdict.eligible ? ("eligible" as const) : verdict.reason,
          score: verdict.eligible ? Number(scoreCandidate(candidate, zone).toFixed(6)) : null,
          winner: candidate.adId === winnerId,
        };
      })
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1)),
  };
}

/** `parseSchedule` is re-exported for tests that build targeting fixtures. */
export { parseSchedule };
