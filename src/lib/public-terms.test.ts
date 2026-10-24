import { describe, expect, it } from "vitest";

import { AD_FORMATS } from "@/lib/publisher-domain";
import {
  currentMinimumPayoutPhrase,
  describeMinimumPayout,
  equivalentCpm,
  estimateEarnings,
  formatSharePercent,
  normalizeShare,
} from "@/lib/public-terms";

describe("revenue share formatting", () => {
  it("treats fractions and whole percentages the same", () => {
    expect(normalizeShare(0.4)).toBe(0.4);
    expect(normalizeShare(40)).toBeCloseTo(0.4);
    expect(formatSharePercent(0.4)).toBe("40%");
    expect(formatSharePercent(40)).toBe("40%");
    expect(formatSharePercent(0.425)).toBe("42.5%");
  });

  it("never returns a negative or non-finite share", () => {
    expect(normalizeShare(-1)).toBe(0);
    expect(normalizeShare(Number.NaN)).toBe(0);
  });
});

describe("payout copy", () => {
  it("keeps the currency intact and handles no minimum", () => {
    expect(describeMinimumPayout(500, "KES")).toBe("KES 500");
    expect(describeMinimumPayout(0, "KES")).toBe("No minimum");
    expect(currentMinimumPayoutPhrase(500, "KES")).toBe("currently KES 500");
    expect(currentMinimumPayoutPhrase(0, "KES")).toBe("currently there is no minimum");
  });
});

describe("CPM equivalence", () => {
  it("matches the ad server's cpc * ctr per-impression scale", () => {
    // KES 5/click at 1% CTR => KES 0.05 per impression => KES 50 per 1,000.
    expect(equivalentCpm(5, 0.01)).toBeCloseTo(50);
  });
});

describe("earnings estimate range", () => {
  const range = estimateEarnings({
    monthlyPageviews: 20_000,
    assumedCtr: 0.01,
    cpc: 5,
    revenueShare: 0.4,
  });

  it("is ordered low < mid < high and the high case matches the old single estimate", () => {
    expect(range.map((r) => r.label)).toEqual(["Low", "Mid", "High"]);
    expect(range[0]!.earnings).toBeLessThan(range[1]!.earnings);
    expect(range[1]!.earnings).toBeLessThan(range[2]!.earnings);
    // 20,000 views * 1% CTR * KES 5 * 40% = KES 400
    expect(range[2]!.earnings).toBeCloseTo(400);
    expect(range[0]!.earnings).toBeCloseTo(80);
  });
});

describe("public format list", () => {
  it("only advertises formats the platform can serve", () => {
    const formats = AD_FORMATS.map((f) => f.format);
    expect(formats).not.toContain("skyscraper");
    expect(formats).not.toContain("interstitial");
    expect(formats).toContain("responsive");
  });
});
