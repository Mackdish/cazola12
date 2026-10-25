import { describe, expect, it } from "vitest";

import {
  autoAdsPlacementKeys,
  resolvePlacementOrigin,
  sanitizeExcludedPages,
} from "@/lib/auto-ads-domain";
import { AD_SDK_SOURCE } from "@/lib/ad-sdk-source";

const URL_ = "https://trademall.co.ke/api/public/placements";

describe("resolvePlacementOrigin", () => {
  it("uses the Origin header for cross-origin publisher pages", () => {
    expect(
      resolvePlacementOrigin({
        origin: "https://publisher.example",
        secFetchSite: "cross-site",
        referer: null,
        requestUrl: URL_,
      }),
    ).toEqual({ origin: "https://publisher.example", sameOrigin: false });
  });

  it("accepts a same-origin GET that has no Origin header (trademall.co.ke itself)", () => {
    expect(
      resolvePlacementOrigin({ origin: null, secFetchSite: "same-origin", referer: null, requestUrl: URL_ }),
    ).toEqual({ origin: "https://trademall.co.ke", sameOrigin: true });
  });

  it("falls back to a same-origin Referer for browsers without Sec-Fetch-Site", () => {
    expect(
      resolvePlacementOrigin({
        origin: null,
        secFetchSite: null,
        referer: "https://trademall.co.ke/blog/post",
        requestUrl: URL_,
      }),
    ).toEqual({ origin: "https://trademall.co.ke", sameOrigin: true });
  });

  it("does not let a request without Origin claim to be another site", () => {
    expect(
      resolvePlacementOrigin({
        origin: null,
        secFetchSite: "cross-site",
        referer: "https://evil.example/page",
        requestUrl: URL_,
      }),
    ).toBeNull();
    expect(
      resolvePlacementOrigin({ origin: null, secFetchSite: null, referer: null, requestUrl: URL_ }),
    ).toBeNull();
  });

  it("treats the opaque 'null' Origin as missing", () => {
    expect(
      resolvePlacementOrigin({ origin: "null", secFetchSite: "same-origin", referer: null, requestUrl: URL_ }),
    ).toEqual({ origin: "https://trademall.co.ke", sameOrigin: true });
  });
});

describe("autoAdsPlacementKeys", () => {
  it("is empty when Auto Ads is disabled", () => {
    expect(autoAdsPlacementKeys(false, {})).toEqual([]);
  });

  it("enables every automatic placement by default (null/undefined toggles stay on)", () => {
    const all = ["top_page", "article_top", "bottom_article", "mobile_sticky"];
    expect(autoAdsPlacementKeys(true, {})).toEqual(all);
    expect(
      autoAdsPlacementKeys(true, { banner_ads_enabled: null, responsive_ads_enabled: null, mobile_ads_enabled: null }),
    ).toEqual(all);
  });

  it("reads the snake_case row columns, so the switches actually work", () => {
    expect(autoAdsPlacementKeys(true, { mobile_ads_enabled: false })).toEqual([
      "top_page",
      "article_top",
      "bottom_article",
    ]);
    expect(autoAdsPlacementKeys(true, { banner_ads_enabled: false })).toEqual(["mobile_sticky"]);
    expect(autoAdsPlacementKeys(true, { responsive_ads_enabled: false })).toEqual(["mobile_sticky"]);
    expect(
      autoAdsPlacementKeys(true, { banner_ads_enabled: false, mobile_ads_enabled: false }),
    ).toEqual([]);
  });
});

describe("sanitizeExcludedPages", () => {
  it("returns [] for anything that is not an array", () => {
    expect(sanitizeExcludedPages(null)).toEqual([]);
    expect(sanitizeExcludedPages("/checkout")).toEqual([]);
    expect(sanitizeExcludedPages({})).toEqual([]);
  });

  it("normalizes to absolute, de-duplicated paths and drops junk", () => {
    expect(
      sanitizeExcludedPages([
        "/checkout",
        "account",
        "  /checkout  ",
        "",
        42,
        "https://trademall.co.ke/pricing?x=1#top",
        "/blog/?draft=1",
      ]),
    ).toEqual(["/checkout", "/account", "/pricing", "/blog/"]);
  });
});

describe("SDK excluded-pages matching", () => {
  // Evaluate the SDK's real skip() against a fake location.
  function skipFor(pathname: string, list: unknown): boolean {
    const match = AD_SDK_SOURCE.match(/function skip\(l\)\{[\s\S]*?return false\}/);
    expect(match).not.toBeNull();
    const fn = new Function("location", `${match![0]}; return skip;`)({ pathname }) as (l: unknown) => boolean;
    return fn(list);
  }

  it("excludes the page itself and everything beneath it", () => {
    expect(skipFor("/checkout", ["/checkout"])).toBe(true);
    expect(skipFor("/checkout/step-2", ["/checkout"])).toBe(true);
    expect(skipFor("/blog/", ["/blog/"])).toBe(true);
  });

  it("does not exclude look-alike paths", () => {
    expect(skipFor("/checkout-help", ["/checkout"])).toBe(false);
    expect(skipFor("/pricing", ["/checkout"])).toBe(false);
  });

  it("is a no-op for a missing, empty or malformed list", () => {
    expect(skipFor("/anything", undefined)).toBe(false);
    expect(skipFor("/anything", [])).toBe(false);
    expect(skipFor("/anything", [null, 5, ""])).toBe(false);
  });
});
