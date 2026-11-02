/**
 * Plain-language delivery status. Pure, shared by server and UI.
 *
 * The serving engine rejects a campaign for one of a fixed set of reasons. This
 * module mirrors the same checks, in the same order, against data a campaign
 * owner is already allowed to see, and says what to do about each one. The
 * checks that depend on the other side of the marketplace (is there a live zone
 * of the right size and country?) cannot be answered from here and are not
 * guessed at.
 */

export const REASON_COPY: Record<string, string> = {
  zone_inactive: "Ad zone is suspended",
  website_inactive: "Website is not active",
  website_unapproved: "Website is not approved",
  website_unverified: "Website ownership is not verified",
  publisher_inactive: "Publisher account is not active",
  publisher_unapproved: "Publisher is not approved",
  campaign_not_approved: "Campaign is not approved",
  campaign_not_active: "Campaign is paused, draft or completed",
  campaign_not_started: "Campaign has not started yet",
  campaign_ended: "Campaign has expired",
  budget_exhausted: "Campaign budget is spent",
  daily_budget_exhausted: "Today's daily budget is spent",
  insufficient_funds: "Advertiser wallet has no balance",
  bid_amount_zero: "Bid amount is zero",
  ad_not_approved: "Advertisement is not approved",
  ad_not_active: "Advertisement is disabled",
  no_creative: "Advertisement has no creative",
  format_mismatch: "Creative format doesn't fit this zone",
  targeting_mismatch: "Targeting rules exclude this request",
  frequency_capped: "Visitor has already seen this ad enough times",
  eligible: "Eligible",
  unknown_zone: "Zone key not recognised",
  zone_unavailable: "Zone or website is not cleared to serve",
  no_ad: "No eligible advertisement",
};

export type Severity = "blocker" | "warning" | "info";

export type ServingIssue = {
  code: string;
  severity: Severity;
  title: string;
  advice: string;
  /** Where in the product the fix lives. */
  fix?: "wallet" | "campaign" | "ads" | "creatives" | "targeting";
};

export type ServingStatus = {
  state: "serving" | "blocked" | "waiting";
  headline: string;
  issues: ServingIssue[];
};

export type ServingStatusInput = {
  campaign: {
    status: string;
    approval_status: string;
    pause_reason?: string | null;
    bid_type?: string | null;
    bid_amount?: number | string | null;
    total_budget?: number | string | null;
    spent_amount?: number | string | null;
    daily_budget?: number | string | null;
    start_date?: string | null;
    end_date?: string | null;
  };
  ads: Array<{
    id: string;
    name?: string;
    status: string;
    approval_status: string;
    media_asset_id?: string | null;
  }>;
  mediaAssets: Array<{ id: string; status: string }>;
  targeting?: {
    countries?: string[] | null;
    counties?: string[] | null;
    cities?: string[] | null;
    devices?: string[] | null;
    website_categories?: string[] | null;
  } | null;
  /** KES wallet balance; null when it could not be read (never guessed). */
  walletBalance: number | null;
  /** Spend so far today in UTC; null when unknown. */
  spentToday: number | null;
  /** Injected for tests. */
  today?: string;
};

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export function campaignServingStatus(input: ServingStatusInput): ServingStatus {
  const { campaign: c, ads, mediaAssets, targeting } = input;
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const issues: ServingIssue[] = [];
  const add = (issue: ServingIssue) => issues.push(issue);
  let scheduled = false;

  // Mirrors candidateIsEligible() and the billing gate, in the same order.
  if (c.approval_status === "pending") {
    add({
      code: "campaign_pending_review",
      severity: "blocker",
      title: "Waiting for review",
      advice: "Our team has not approved this campaign yet. It starts serving as soon as it is approved.",
    });
  } else if (c.approval_status !== "approved") {
    add({
      code: "campaign_not_approved",
      severity: "blocker",
      title: "Campaign was not approved",
      advice: "Read the review feedback above, fix the issue and submit the campaign again.",
      fix: "campaign",
    });
  }

  if (c.status === "paused") {
    if (c.pause_reason === "insufficient_funds") {
      add({
        code: "paused_insufficient_funds",
        severity: "blocker",
        title: "Paused: wallet ran out of money",
        advice: "Add funds to your wallet. The campaign resumes automatically once the balance is back.",
        fix: "wallet",
      });
    } else if (c.pause_reason === "budget_exhausted") {
      add({
        code: "paused_budget_exhausted",
        severity: "blocker",
        title: "Paused: total budget spent",
        advice: "Raise the total budget to continue. The campaign resumes automatically.",
        fix: "campaign",
      });
    } else {
      add({
        code: "paused",
        severity: "blocker",
        title: "Campaign is paused",
        advice: "Resume the campaign from the buttons at the top of this page.",
        fix: "campaign",
      });
    }
  } else if (c.status !== "active" && c.status !== "approved" && c.approval_status === "approved") {
    add({
      code: "not_active",
      severity: "blocker",
      title: `Campaign status is "${c.status}"`,
      advice: "Only active campaigns serve ads. Move it to active from the buttons at the top.",
      fix: "campaign",
    });
  }

  if (num(c.bid_amount) <= 0) {
    add({
      code: "bid_zero",
      severity: "blocker",
      title: "Bid amount is zero",
      advice: "Set a bid above zero. A zero bid can never win an auction or be charged.",
      fix: "campaign",
    });
  }

  if (c.start_date && c.start_date > today) {
    scheduled = true;
    add({
      code: "not_started",
      severity: "info",
      title: `Starts on ${c.start_date}`,
      advice: "The campaign is scheduled and will begin serving on its start date.",
    });
  }
  if (c.end_date && c.end_date < today) {
    add({
      code: "ended",
      severity: "blocker",
      title: `Ended on ${c.end_date}`,
      advice: "Move the end date forward to serve again.",
      fix: "campaign",
    });
  }

  const remaining = num(c.total_budget) - num(c.spent_amount);
  if (remaining <= 0) {
    add({
      code: "budget_spent",
      severity: "blocker",
      title: "Total budget is spent",
      advice: "Raise the total budget to continue.",
      fix: "campaign",
    });
  }
  const daily = num(c.daily_budget);
  if (daily > 0 && input.spentToday !== null && input.spentToday >= daily) {
    add({
      code: "daily_budget_spent",
      severity: "warning",
      title: "Today's daily budget is spent",
      advice: "Serving resumes at midnight UTC (3 AM Nairobi time), or raise the daily budget.",
      fix: "campaign",
    });
  }

  if (input.walletBalance !== null && input.walletBalance <= 0) {
    add({
      code: "wallet_empty",
      severity: "blocker",
      title: "Your KES wallet has no balance",
      advice: "Ads are only served when the wallet has funds, because every impression or click is charged to it. USD balances are not used.",
      fix: "wallet",
    });
  }

  // Ads.
  if (ads.length === 0) {
    add({
      code: "no_ads",
      severity: "blocker",
      title: "This campaign has no ads",
      advice: "Add at least one ad with a creative.",
      fix: "ads",
    });
  } else {
    const readyAssets = new Set(mediaAssets.filter((m) => m.status === "ready").map((m) => m.id));
    const live = ads.filter((a) => a.status === "active" && a.approval_status === "approved");
    const servable = live.filter((a) => a.media_asset_id && readyAssets.has(a.media_asset_id));

    if (servable.length === 0) {
      if (ads.every((a) => a.approval_status === "pending")) {
        add({
          code: "ads_pending",
          severity: "blocker",
          title: "Your ads are waiting for review",
          advice: "They start serving once approved.",
          fix: "ads",
        });
      } else if (ads.some((a) => a.approval_status === "rejected") && live.length === 0) {
        add({
          code: "ads_rejected",
          severity: "blocker",
          title: "All your ads were rejected or are disabled",
          advice: "Edit the ads to meet the guidelines, or add new ones.",
          fix: "ads",
        });
      } else if (live.length === 0) {
        add({
          code: "ads_disabled",
          severity: "blocker",
          title: "No ad is both approved and active",
          advice: "Activate an approved ad from the Ads tab.",
          fix: "ads",
        });
      } else {
        add({
          code: "creative_not_ready",
          severity: "blocker",
          title: "No approved ad has a ready creative",
          advice: "The image is missing or still processing. Re-upload it from the Creatives page and attach it to the ad.",
          fix: "creatives",
        });
      }
    } else if (servable.length < ads.length) {
      add({
        code: "some_ads_blocked",
        severity: "info",
        title: `${servable.length} of ${ads.length} ads can serve`,
        advice: "The others are pending, disabled, rejected or missing a ready creative.",
        fix: "ads",
      });
    }
  }

  // Reach hints. These never block; they explain a trickle of delivery.
  if (targeting) {
    const narrow: string[] = [];
    if (targeting.countries?.length) narrow.push("country");
    if (targeting.counties?.length || targeting.cities?.length) narrow.push("location");
    if (targeting.devices?.length) narrow.push("device");
    if (targeting.website_categories?.length) narrow.push("website category");
    if (narrow.length > 0) {
      add({
        code: "narrow_targeting",
        severity: "info",
        title: `Targeting is limited by ${narrow.join(", ")}`,
        advice: "Ads only serve on matching pages and visitors. If delivery is low, widen the targeting.",
        fix: "targeting",
      });
    }
  }

  const blockers = issues.filter((i) => i.severity === "blocker");
  const warnings = issues.filter((i) => i.severity === "warning");

  if (scheduled && blockers.length === 0) {
    return { state: "waiting", headline: "Scheduled to start", issues };
  }
  if (blockers.length > 0) {
    return {
      state: "blocked",
      headline: blockers.length === 1 ? "Not serving: 1 thing to fix" : `Not serving: ${blockers.length} things to fix`,
      issues,
    };
  }
  return {
    state: "serving",
    headline: warnings.length > 0 ? "Serving, with a note" : "Ready to serve",
    issues,
  };
}

// ------------------------------------------------------------------ publisher

export type ZoneSummaryInput = {
  zone: { serveable: boolean; blockedBy: string | null; format: string };
  candidates: Array<{ verdict: string; winner: boolean }>;
};

export type ZoneSummary = {
  state: "serving" | "blocked" | "empty" | "unmatched";
  headline: string;
  detail: string;
  /** Why candidate ads were dropped, most common first. */
  reasons: Array<{ code: string; label: string; count: number }>;
  advice: string[];
};

const ZONE_BLOCK_ADVICE: Record<string, { headline: string; advice: string }> = {
  website_unverified: {
    headline: "Your website isn't verified yet",
    advice: "Finish domain verification on the Websites page. Ads never serve on an unverified site.",
  },
  website_unapproved: {
    headline: "Your website is waiting for approval",
    advice: "Ads start as soon as the site is approved. Nothing else is needed from you.",
  },
  website_inactive: {
    headline: "Your website is not active",
    advice: "Re-activate the website from the Websites page.",
  },
  zone_inactive: {
    headline: "This ad zone is switched off",
    advice: "Activate the zone on the Ad zones page.",
  },
  publisher_unapproved: {
    headline: "Your publisher account is waiting for approval",
    advice: "Ads start once the account is approved.",
  },
  publisher_inactive: {
    headline: "Your publisher account is not active",
    advice: "Contact support to restore the account.",
  },
};

/** Reasons that mean "the demand isn't there right now", not "something is misconfigured". */
const DEMAND_REASONS = new Set([
  "insufficient_funds",
  "budget_exhausted",
  "daily_budget_exhausted",
  "campaign_not_active",
  "campaign_not_approved",
  "campaign_not_started",
  "campaign_ended",
  "ad_not_approved",
  "ad_not_active",
  "no_creative",
  "bid_amount_zero",
]);

export function zoneServingSummary(input: ZoneSummaryInput): ZoneSummary {
  if (!input.zone.serveable) {
    const known = ZONE_BLOCK_ADVICE[input.zone.blockedBy ?? ""];
    return {
      state: "blocked",
      headline: known?.headline ?? "This zone isn't cleared to serve",
      detail: REASON_COPY[input.zone.blockedBy ?? ""] ?? "The zone or website is not cleared to serve.",
      reasons: [],
      advice: [known?.advice ?? "Check the website and zone status on the Websites and Ad zones pages."],
    };
  }

  const total = input.candidates.length;
  if (total === 0) {
    return {
      state: "empty",
      headline: "No advertisers are bidding on this size yet",
      detail: "Your setup is fine; there are simply no active ads for this format right now.",
      reasons: [],
      advice:
        input.zone.format === "responsive"
          ? ["Check back as more campaigns go live. Your placement needs no changes."]
          : [
              "A responsive zone accepts ads of every size, so it matches more advertisers than a fixed-size zone.",
            ],
    };
  }

  const eligible = input.candidates.filter((c) => c.verdict === "eligible").length;
  if (eligible > 0) {
    return {
      state: "serving",
      headline: eligible === 1 ? "1 ad can serve in this zone" : `${eligible} ads can serve in this zone`,
      detail: `${total - eligible} other ad${total - eligible === 1 ? " was" : "s were"} filtered out for this request.`,
      reasons: tally(input.candidates),
      advice: [],
    };
  }

  const reasons = tally(input.candidates);
  const top = reasons[0]?.code ?? "";
  const advice: string[] = [];
  if (reasons.some((r) => r.code === "format_mismatch") && input.zone.format !== "responsive") {
    advice.push("Several ads are a different size. A responsive zone accepts every size.");
  }
  if (reasons.some((r) => r.code === "targeting_mismatch")) {
    advice.push(
      "Some advertisers target other countries, devices or hours than this test request. Try a different device or country above; real visitors vary.",
    );
  }
  if (DEMAND_REASONS.has(top)) {
    advice.push("This is on the advertiser side (budget, review or paused campaigns). It clears up as campaigns are funded and approved.");
  }
  if (advice.length === 0) advice.push("Run the check again in a few minutes as campaigns change.");

  return {
    state: "unmatched",
    headline: "Ads exist, but none can serve this request",
    detail: `${total} ad${total === 1 ? "" : "s"} considered, none eligible. The most common reason: ${reasons[0]?.label ?? "unknown"}.`,
    reasons,
    advice,
  };
}

function tally(candidates: Array<{ verdict: string }>) {
  const counts = new Map<string, number>();
  for (const c of candidates) {
    if (c.verdict === "eligible") continue;
    counts.set(c.verdict, (counts.get(c.verdict) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([code, count]) => ({ code, label: REASON_COPY[code] ?? code, count }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
}
