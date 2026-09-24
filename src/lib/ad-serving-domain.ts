/**
 * Ad serving domain logic — pure, dependency-free, unit-testable.
 *
 * Everything that decides *whether* an ad may serve and *which* ad wins lives
 * here. The database layer only fetches rows; this module makes the decisions.
 * A future real-time auction replaces `selectAd` alone: the eligibility gate
 * and the candidate shape stay the same.
 */
import type { Database } from "@/integrations/supabase/types";
import {
  targetingMatches,
  type RequestSignals,
  type TargetingRules,
  type Weekday,
} from "@/lib/advertiser-domain";

type Enums = Database["public"]["Enums"];
export type AdFormat = Enums["ad_format"];
export type DeviceType = Enums["device_type"];
export type OsType = Enums["os_type"];
export type BrowserType = Enums["browser_type"];

// ------------------------------------------------------------------- formats

export const FORMAT_SIZES: Record<AdFormat, { width: number | null; height: number | null }> = {
  "300x250": { width: 300, height: 250 },
  "336x280": { width: 336, height: 280 },
  "728x90": { width: 728, height: 90 },
  "970x250": { width: 970, height: 250 },
  "320x50": { width: 320, height: 50 },
  "320x100": { width: 320, height: 100 },
  responsive: { width: null, height: null },
};

/** A zone accepts an ad when the formats are identical, or either side is responsive. */
export function formatMatches(zoneFormat: AdFormat, adFormat: AdFormat): boolean {
  return zoneFormat === adFormat || zoneFormat === "responsive" || adFormat === "responsive";
}

// ------------------------------------------------------------------ contexts

export type ZoneContext = {
  zoneId: string;
  zoneStatus: Enums["entity_status"];
  zoneFormat: AdFormat;
  websiteId: string;
  websiteStatus: Enums["entity_status"];
  websiteApproval: Enums["approval_status"];
  websiteVerification: Enums["verification_status"];
  websiteCategory: Enums["website_category"];
  websiteDomain: string;
  publisherId: string;
  publisherStatus: Enums["entity_status"];
  publisherApproval: Enums["approval_status"];
};

export type ServingCandidate = {
  adId: string;
  adName: string;
  adFormat: AdFormat;
  adStatus: Enums["entity_status"];
  adApproval: Enums["approval_status"];
  destinationUrl: string;
  mediaAssetId: string | null;
  campaignId: string;
  campaignStatus: Enums["campaign_status"];
  campaignApproval: Enums["approval_status"];
  bidType: Enums["bid_type"];
  bidAmount: number;
  totalBudget: number;
  spentAmount: number;
  priority: number;
  startDate: string | null;
  endDate: string | null;
  /** Advertiser organization that funds this campaign (billing gate). */
  organizationId?: string;
  targeting: TargetingRules;
  frequencyCap?: { impressions: number; periodHours: number } | null;
};

export type ServingContext = {
  /** UTC instant of the request. */
  now: Date;
  signals: RequestSignals;
};

// -------------------------------------------------------------- eligibility

export type IneligibleReason =
  | "zone_inactive"
  | "website_unapproved"
  | "website_unverified"
  | "website_inactive"
  | "publisher_unapproved"
  | "publisher_inactive"
  | "campaign_not_approved"
  | "campaign_not_active"
  | "campaign_not_started"
  | "campaign_ended"
  | "budget_exhausted"
  | "insufficient_funds"
  | "bid_amount_zero"
  | "ad_not_approved"
  | "ad_not_active"
  | "no_creative"
  | "format_mismatch"
  | "targeting_mismatch"
  | "frequency_capped";

export type EligibilityVerdict = { eligible: true } | { eligible: false; reason: IneligibleReason };

const OK: EligibilityVerdict = { eligible: true };
const no = (reason: IneligibleReason): EligibilityVerdict => ({ eligible: false, reason });

/** Supply-side gate. Evaluated once per request, before any candidate is scored. */
export function zoneIsServeable(zone: ZoneContext): EligibilityVerdict {
  if (zone.zoneStatus !== "active") return no("zone_inactive");
  if (zone.websiteStatus !== "active") return no("website_inactive");
  if (zone.websiteApproval !== "approved") return no("website_unapproved");
  if (zone.websiteVerification !== "verified") return no("website_unverified");
  if (zone.publisherStatus !== "active") return no("publisher_inactive");
  if (zone.publisherApproval !== "approved") return no("publisher_unapproved");
  return OK;
}

/** Days are compared as calendar dates (YYYY-MM-DD) in UTC, matching how they are stored. */
function utcDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function remainingBudget(
  candidate: Pick<ServingCandidate, "totalBudget" | "spentAmount">,
): number {
  return Math.max(0, Number(candidate.totalBudget) - Number(candidate.spentAmount));
}

/** Demand-side gate for a single candidate ad in a given zone. */
export function candidateIsEligible(
  candidate: ServingCandidate,
  zone: ZoneContext,
  ctx: ServingContext,
): EligibilityVerdict {
  if (candidate.campaignApproval !== "approved") return no("campaign_not_approved");
  if (candidate.campaignStatus !== "active" && candidate.campaignStatus !== "approved") {
    return no("campaign_not_active");
  }
  if (candidate.bidAmount <= 0) return no("bid_amount_zero");
  const today = utcDate(ctx.now);
  if (candidate.startDate && candidate.startDate > today) return no("campaign_not_started");
  if (candidate.endDate && candidate.endDate < today) return no("campaign_ended");
  if (remainingBudget(candidate) <= 0) return no("budget_exhausted");
  if (candidate.adApproval !== "approved") return no("ad_not_approved");
  if (candidate.adStatus !== "active") return no("ad_not_active");
  if (!candidate.mediaAssetId) return no("no_creative");
  if (!formatMatches(zone.zoneFormat, candidate.adFormat)) return no("format_mismatch");
  if (!targetingMatches(candidate.targeting, ctx.signals, ctx.now)) return no("targeting_mismatch");
  return OK;
}

// ---------------------------------------------------------------- selection

/** Assumed click-through rate used to put CPC bids on the same scale as CPM. */
export const ASSUMED_CTR = 0.01;

/** Value of one impression, in currency units, for either bid model. */
export function valuePerImpression(
  candidate: Pick<ServingCandidate, "bidType" | "bidAmount">,
  assumedCtr = 0.01,
): number {
  const bid = Number(candidate.bidAmount) || 0;
  return candidate.bidType === "cpm" ? bid / 1000 : bid * assumedCtr;
}

/**
 * Deterministic weighted score. Higher wins; no randomness anywhere.
 *
 * score = impression value
 *       × priority weight (priority 5 is neutral)
 *       × pacing weight (campaigns with budget left outrank nearly-spent ones)
 *       × format weight (an exact size beats a responsive fallback)
 */
export function scoreCandidate(candidate: ServingCandidate, zone: ZoneContext, assumedCtr = 0.01): number {
  const value = valuePerImpression(candidate, assumedCtr);
  const priorityWeight = Math.min(10, Math.max(1, candidate.priority)) / 5;
  const total = Number(candidate.totalBudget) || 0;
  const pacing = total > 0 ? 0.5 + 0.5 * Math.min(1, remainingBudget(candidate) / total) : 0.5;
  const formatWeight = zone.zoneFormat === candidate.adFormat ? 1 : 0.85;
  return value * priorityWeight * pacing * formatWeight;
}

export type SelectionResult = {
  winner: ServingCandidate | null;
  scores: Array<{ adId: string; score: number }>;
};

/**
 * Picks the highest scoring eligible candidate. Ties break on ad id so the same
 * request always yields the same ad — swap this function for an auction later.
 */
export function rankCandidates(
  candidates: ServingCandidate[],
  zone: ZoneContext,
  ctx: ServingContext,
  assumedCtr = 0.01,
): Array<{ candidate: ServingCandidate; score: number }> {
  return candidates
    .filter((candidate) => candidateIsEligible(candidate, zone, ctx).eligible)
    .map((candidate) => ({ candidate, score: scoreCandidate(candidate, zone, assumedCtr) }))
    .sort((a, b) => b.score - a.score || a.candidate.adId.localeCompare(b.candidate.adId));
}

export function selectAd(
  candidates: ServingCandidate[],
  zone: ZoneContext,
  ctx: ServingContext,
  assumedCtr = 0.01,
): SelectionResult {
  const scored = rankCandidates(candidates, zone, ctx, assumedCtr);

  return {
    winner: scored[0]?.candidate ?? null,
    scores: scored.map((entry) => ({ adId: entry.candidate.adId, score: entry.score })),
  };
}

// ------------------------------------------------------- request signals

export function weekdayOf(now: Date): Weekday {
  const order: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return order[now.getUTCDay()] as Weekday;
}

/** Minimal, allocation-light user-agent classification. Unknown → "other". */
export function classifyUserAgent(userAgent: string | null | undefined): {
  device: DeviceType;
  os: OsType;
  browser: BrowserType;
} {
  const ua = (userAgent ?? "").toLowerCase();

  const isTablet = ua.includes("ipad") || (ua.includes("android") && !ua.includes("mobile"));
  const isMobile =
    !isTablet && (ua.includes("mobile") || ua.includes("iphone") || ua.includes("android"));
  const device: DeviceType = isTablet ? "tablet" : isMobile ? "mobile" : "desktop";

  let os: OsType = "other";
  if (ua.includes("windows")) os = "windows";
  else if (ua.includes("android")) os = "android";
  else if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ios")) os = "ios";
  else if (ua.includes("mac os")) os = "macos";
  else if (ua.includes("linux")) os = "linux";

  let browser: BrowserType = "other";
  if (ua.includes("edg/")) browser = "edge";
  else if (ua.includes("opr/") || ua.includes("opera")) browser = "opera";
  else if (ua.includes("firefox")) browser = "firefox";
  else if (ua.includes("chrome") || ua.includes("crios")) browser = "chrome";
  else if (ua.includes("safari")) browser = "safari";

  return { device, os, browser };
}

/** Country codes arrive from the edge as ISO-3166 alpha-2, or not at all. */
export function normalizeCountry(value: string | null | undefined): string | null {
  if (!value) return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

/** Only absolute http(s) destinations may ever be redirected to. */
export function isSafeDestination(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const hostname = parsed.hostname;
    if (!hostname || hostname === "localhost") return false;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      const parts = hostname.split(".").map(Number);
      const [a, b] = parts;
      if (a === 10) return false;
      if (a === 172 && typeof b === "number" && b >= 16 && b <= 31) return false;
      if (a === 192 && b === 168) return false;
      if (a === 127) return false;
      if (a === 169 && b === 254) return false;
      if (a === 100 && typeof b === "number" && b >= 64 && b <= 127) return false;
      if (a === 0) return false;
    }
    if (hostname.toLowerCase() === "localhost" || hostname.toLowerCase().endsWith(".local"))
      return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Privacy-conscious request identifier for frequency capping.
 *
 * Combines ip + userAgent + classified device/os/browser into a stable
 * short-lived session ID. The resulting identifier is hashed and is not
 * reversible, and it rotates naturally as the Redis TTL expires.
 */
export function deriveSessionId(input: {
  ipAddress: string | null | undefined;
  userAgent: string | null | undefined;
  device: DeviceType | undefined;
  os: OsType | undefined;
  browser: BrowserType | undefined;
}): string {
  const seed = `${input.ipAddress ?? "no-ip"}|${input.userAgent ?? ""}|${input.device ?? ""}|${input.os ?? ""}|${input.browser ?? ""}`;
  let hash = 5381;
  for (let i = 0; i < seed.length; i += 1) {
    hash = ((hash << 5) + hash) ^ seed.charCodeAt(i);
  }
  return `sess:${Math.abs(hash) >>> 0}`;
}
