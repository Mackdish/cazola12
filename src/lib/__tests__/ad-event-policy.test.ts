import { describe, expect, it } from "vitest";
import { shouldBillImpression, shouldFlushBufferedImpression } from "@/lib/ad-event-policy";

describe("ad event billing policy", () => {
  it("does not bill impressions blocked by fraud evaluation", () => {
    expect(shouldBillImpression("blocked", false)).toBe(false);
  });

  it("does not bill explicit bot impressions", () => {
    expect(shouldBillImpression("normal", true)).toBe(false);
    expect(shouldBillImpression("suspicious", true)).toBe(false);
  });

  it("allows non-blocked non-bot impressions to be billed", () => {
    expect(shouldBillImpression("normal", false)).toBe(true);
    expect(shouldBillImpression("suspicious", false)).toBe(true);
    expect(shouldBillImpression("review_required", false)).toBe(true);
  });

  it("only flushes the buffer when an impression row is not yet persisted", () => {
    expect(shouldFlushBufferedImpression(false, true)).toBe(true);
    expect(shouldFlushBufferedImpression(true, true)).toBe(false);
    expect(shouldFlushBufferedImpression(false, false)).toBe(false);
  });
});
