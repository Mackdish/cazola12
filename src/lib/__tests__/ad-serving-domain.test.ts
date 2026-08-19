import { describe, expect, it } from "vitest";

import { EMPTY_TARGETING } from "@/lib/advertiser-domain";
import {
  candidateIsEligible,
  classifyUserAgent,
  formatMatches,
  isSafeDestination,
  scoreCandidate,
  selectAd,
  valuePerImpression,
  zoneIsServeable,
  type ServingCandidate,
  type ZoneContext,
} from "@/lib/ad-serving-domain";

const NOW = new Date("2026-03-10T12:00:00Z"); // a Tuesday

const zone: ZoneContext = {
  zoneId: "zone-1",
  zoneStatus: "active",
  zoneFormat: "300x250",
  websiteId: "site-1",
  websiteStatus: "active",
  websiteApproval: "approved",
  websiteVerification: "verified",
  websiteCategory: "technology",
  publisherId: "pub-1",
  publisherStatus: "active",
  publisherApproval: "approved",
};

function candidate(overrides: Partial<ServingCandidate> = {}): ServingCandidate {
  return {
    adId: "ad-1",
    adName: "Ad One",
    adFormat: "300x250",
    adStatus: "active",
    adApproval: "approved",
    destinationUrl: "https://example.com/landing",
    mediaAssetId: "asset-1",
    campaignId: "camp-1",
    campaignStatus: "active",
    campaignApproval: "approved",
    bidType: "cpm",
    bidAmount: 5,
    totalBudget: 1000,
    spentAmount: 0,
    priority: 5,
    startDate: "2026-03-01",
    endDate: "2026-03-31",
    targeting: { ...EMPTY_TARGETING },
    ...overrides,
  };
}

const ctx = {
  now: NOW,
  signals: { device: "desktop" as const, weekday: "tue" as const, hour: 12 },
};

describe("zone gate", () => {
  it("opens for an approved, verified, active zone", () => {
    expect(zoneIsServeable(zone).eligible).toBe(true);
  });

  it("blocks unverified websites", () => {
    const verdict = zoneIsServeable({ ...zone, websiteVerification: "pending" });
    expect(verdict).toEqual({ eligible: false, reason: "website_unverified" });
  });

  it("blocks unapproved websites and suspended zones", () => {
    expect(zoneIsServeable({ ...zone, websiteApproval: "pending" })).toEqual({
      eligible: false,
      reason: "website_unapproved",
    });
    expect(zoneIsServeable({ ...zone, zoneStatus: "suspended" })).toEqual({
      eligible: false,
      reason: "zone_inactive",
    });
  });
});

describe("candidate eligibility", () => {
  it("accepts a healthy candidate", () => {
    expect(candidateIsEligible(candidate(), zone, ctx).eligible).toBe(true);
  });

  it("rejects paused campaigns", () => {
    expect(candidateIsEligible(candidate({ campaignStatus: "paused" }), zone, ctx)).toEqual({
      eligible: false,
      reason: "campaign_not_active",
    });
  });

  it("rejects expired and not-yet-started campaigns", () => {
    expect(candidateIsEligible(candidate({ endDate: "2026-03-09" }), zone, ctx)).toEqual({
      eligible: false,
      reason: "campaign_ended",
    });
    expect(candidateIsEligible(candidate({ startDate: "2026-03-11" }), zone, ctx)).toEqual({
      eligible: false,
      reason: "campaign_not_started",
    });
  });

  it("rejects exhausted budgets", () => {
    expect(candidateIsEligible(candidate({ spentAmount: 1000 }), zone, ctx)).toEqual({
      eligible: false,
      reason: "budget_exhausted",
    });
  });

  it("rejects unapproved or disabled ads and missing creatives", () => {
    expect(candidateIsEligible(candidate({ adApproval: "pending" }), zone, ctx)).toEqual({
      eligible: false,
      reason: "ad_not_approved",
    });
    expect(candidateIsEligible(candidate({ adStatus: "suspended" }), zone, ctx)).toEqual({
      eligible: false,
      reason: "ad_not_active",
    });
    expect(candidateIsEligible(candidate({ mediaAssetId: null }), zone, ctx)).toEqual({
      eligible: false,
      reason: "no_creative",
    });
  });

  it("rejects a mismatched format", () => {
    expect(candidateIsEligible(candidate({ adFormat: "728x90" }), zone, ctx)).toEqual({
      eligible: false,
      reason: "format_mismatch",
    });
  });

  it("rejects targeting misses", () => {
    const targeted = candidate({ targeting: { ...EMPTY_TARGETING, devices: ["mobile"] } });
    expect(candidateIsEligible(targeted, zone, ctx)).toEqual({
      eligible: false,
      reason: "targeting_mismatch",
    });
  });
});

describe("format matching", () => {
  it("allows exact matches and responsive on either side", () => {
    expect(formatMatches("300x250", "300x250")).toBe(true);
    expect(formatMatches("responsive", "728x90")).toBe(true);
    expect(formatMatches("728x90", "responsive")).toBe(true);
    expect(formatMatches("728x90", "300x250")).toBe(false);
  });
});

describe("selection", () => {
  it("is deterministic and picks the highest value", () => {
    const cheap = candidate({ adId: "ad-cheap", bidAmount: 2 });
    const rich = candidate({ adId: "ad-rich", bidAmount: 8 });
    for (let i = 0; i < 5; i += 1) {
      expect(selectAd([cheap, rich], zone, ctx).winner?.adId).toBe("ad-rich");
      expect(selectAd([rich, cheap], zone, ctx).winner?.adId).toBe("ad-rich");
    }
  });

  it("breaks ties on ad id, never randomly", () => {
    const a = candidate({ adId: "aaa" });
    const b = candidate({ adId: "bbb" });
    expect(selectAd([b, a], zone, ctx).winner?.adId).toBe("aaa");
  });

  it("prefers higher priority at equal bids", () => {
    const low = candidate({ adId: "ad-low", priority: 2 });
    const high = candidate({ adId: "ad-high", priority: 9 });
    expect(scoreCandidate(high, zone)).toBeGreaterThan(scoreCandidate(low, zone));
  });

  it("prefers an exact format over a responsive fallback", () => {
    const exact = candidate({ adId: "exact" });
    const fallback = candidate({ adId: "fallback", adFormat: "responsive" });
    expect(scoreCandidate(exact, zone)).toBeGreaterThan(scoreCandidate(fallback, zone));
  });

  it("de-paces campaigns that have nearly spent their budget", () => {
    const fresh = candidate({ adId: "fresh" });
    const spent = candidate({ adId: "spent", spentAmount: 990 });
    expect(scoreCandidate(fresh, zone)).toBeGreaterThan(scoreCandidate(spent, zone));
  });

  it("returns no winner when nothing is eligible", () => {
    expect(selectAd([candidate({ campaignStatus: "draft" })], zone, ctx).winner).toBeNull();
  });

  it("puts cpc and cpm bids on the same scale", () => {
    expect(valuePerImpression({ bidType: "cpm", bidAmount: 10 })).toBeCloseTo(0.01);
    expect(valuePerImpression({ bidType: "cpc", bidAmount: 1 })).toBeCloseTo(0.01);
  });
});

describe("request classification", () => {
  it("detects mobile, tablet and desktop", () => {
    expect(classifyUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile/15E148").device).toBe(
      "mobile",
    );
    expect(classifyUserAgent("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)").device).toBe(
      "tablet",
    );
    expect(classifyUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64) Chrome/120").device).toBe(
      "desktop",
    );
  });

  it("classifies os and browser, defaulting to other", () => {
    const chrome = classifyUserAgent("Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537");
    expect(chrome.os).toBe("windows");
    expect(chrome.browser).toBe("chrome");
    expect(classifyUserAgent(null)).toEqual({ device: "desktop", os: "other", browser: "other" });
  });
});

describe("redirect safety", () => {
  it("only allows http and https destinations", () => {
    expect(isSafeDestination("https://example.com")).toBe(true);
    expect(isSafeDestination("http://example.com")).toBe(true);
    expect(isSafeDestination("javascript:alert(1)")).toBe(false);
    expect(isSafeDestination("/relative")).toBe(false);
  });
});
