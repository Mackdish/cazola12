import { describe, expect, it } from "vitest";

import { campaignServingStatus, type ServingStatusInput } from "@/lib/serving-status";

const healthy = (): ServingStatusInput => ({
  campaign: {
    status: "active",
    approval_status: "approved",
    pause_reason: null,
    bid_type: "cpm",
    bid_amount: 100,
    total_budget: 5000,
    spent_amount: 10,
    daily_budget: null,
    start_date: null,
    end_date: null,
  },
  ads: [{ id: "a1", status: "active", approval_status: "approved", media_asset_id: "m1" }],
  mediaAssets: [{ id: "m1", status: "ready" }],
  targeting: null,
  walletBalance: 500,
  spentToday: 0,
  today: "2026-11-02",
});

const codes = (i: ServingStatusInput) => campaignServingStatus(i).issues.map((x) => x.code);

describe("campaignServingStatus", () => {
  it("reports a healthy campaign as ready with no issues", () => {
    const s = campaignServingStatus(healthy());
    expect(s.state).toBe("serving");
    expect(s.issues).toEqual([]);
  });

  it("explains an empty or missing wallet", () => {
    const a = healthy();
    a.walletBalance = 0;
    expect(codes(a)).toEqual(["wallet_empty"]);
    expect(campaignServingStatus(a).state).toBe("blocked");
  });

  it("never claims anything when the wallet could not be read", () => {
    const a = healthy();
    a.walletBalance = null;
    expect(campaignServingStatus(a).state).toBe("serving");
  });

  it("distinguishes billing pauses from manual pauses", () => {
    const funds = healthy();
    funds.campaign.status = "paused";
    funds.campaign.pause_reason = "insufficient_funds";
    expect(codes(funds)).toContain("paused_insufficient_funds");

    const budget = healthy();
    budget.campaign.status = "paused";
    budget.campaign.pause_reason = "budget_exhausted";
    expect(codes(budget)).toContain("paused_budget_exhausted");

    const manual = healthy();
    manual.campaign.status = "paused";
    expect(codes(manual)).toContain("paused");
  });

  it("flags pending and rejected approval differently", () => {
    const p = healthy();
    p.campaign.approval_status = "pending";
    expect(codes(p)).toContain("campaign_pending_review");
    const r = healthy();
    r.campaign.approval_status = "rejected";
    expect(codes(r)).toContain("campaign_not_approved");
  });

  it("handles dates: future start is a wait, past end is a blocker", () => {
    const future = healthy();
    future.campaign.start_date = "2026-12-01";
    const f = campaignServingStatus(future);
    expect(f.state).toBe("waiting");

    const ended = healthy();
    ended.campaign.end_date = "2026-10-31";
    expect(codes(ended)).toContain("ended");
    expect(campaignServingStatus(ended).state).toBe("blocked");
  });

  it("treats a spent total budget as a blocker and a spent daily budget as a warning", () => {
    const total = healthy();
    total.campaign.spent_amount = 5000;
    expect(codes(total)).toContain("budget_spent");

    const daily = healthy();
    daily.campaign.daily_budget = 200;
    daily.spentToday = 200;
    const s = campaignServingStatus(daily);
    expect(s.issues.map((i) => i.code)).toEqual(["daily_budget_spent"]);
    expect(s.issues[0]?.severity).toBe("warning");
    expect(s.state).toBe("serving");
  });

  it("explains a zero bid", () => {
    const a = healthy();
    a.campaign.bid_amount = 0;
    expect(codes(a)).toContain("bid_zero");
  });

  it("explains each way the ads can fail", () => {
    const none = healthy();
    none.ads = [];
    expect(codes(none)).toEqual(["no_ads"]);

    const pending = healthy();
    pending.ads = [{ id: "a", status: "active", approval_status: "pending", media_asset_id: "m1" }];
    expect(codes(pending)).toEqual(["ads_pending"]);

    const rejected = healthy();
    rejected.ads = [{ id: "a", status: "active", approval_status: "rejected", media_asset_id: "m1" }];
    expect(codes(rejected)).toEqual(["ads_rejected"]);

    const disabled = healthy();
    disabled.ads = [{ id: "a", status: "suspended", approval_status: "approved", media_asset_id: "m1" }];
    expect(codes(disabled)).toEqual(["ads_disabled"]);

    const creative = healthy();
    creative.mediaAssets = [{ id: "m1", status: "processing" }];
    expect(codes(creative)).toEqual(["creative_not_ready"]);

    const noAsset = healthy();
    noAsset.ads = [{ id: "a", status: "active", approval_status: "approved", media_asset_id: null }];
    expect(codes(noAsset)).toEqual(["creative_not_ready"]);
  });

  it("notes when only some ads can serve, and when targeting is narrow, without blocking", () => {
    const a = healthy();
    a.ads.push({ id: "a2", status: "active", approval_status: "pending", media_asset_id: "m1" });
    a.targeting = { countries: ["KE"], devices: ["mobile"] };
    const s = campaignServingStatus(a);
    expect(s.state).toBe("serving");
    expect(s.issues.map((i) => i.code).sort()).toEqual(["narrow_targeting", "some_ads_blocked"]);
  });

  it("counts several blockers in the headline", () => {
    const a = healthy();
    a.walletBalance = 0;
    a.ads = [];
    expect(campaignServingStatus(a).headline).toBe("Not serving: 2 things to fix");
  });
});
