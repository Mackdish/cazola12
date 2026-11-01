import { beforeEach, describe, expect, it, vi } from "vitest";

import { findReconciliationProblems, type ReconciliationDay } from "@/lib/billing-retry.server";
import { pickZonesByFormat, summarize } from "@/lib/serve-health.server";

const day = (over: Partial<ReconciliationDay> = {}): ReconciliationDay => ({
  day: "2026-11-01",
  impressions: 10,
  clicks: 1,
  spend_rows: 10,
  spend_total: 5,
  wallet_debit_total: 5,
  publisher_gross_total: 5,
  wallet_diff: 0,
  publisher_diff: 0,
  unbilled_events: 0,
  ...over,
});

describe("findReconciliationProblems", () => {
  it("accepts days where every ledger agrees", () => {
    expect(findReconciliationProblems([day(), day({ day: "2026-10-31" })])).toEqual([]);
  });
  it("ignores rounding noise", () => {
    expect(findReconciliationProblems([day({ wallet_diff: 0.0004 })])).toEqual([]);
  });
  it("flags a wallet mismatch, a publisher mismatch and unbilled events", () => {
    const bad = [
      day({ wallet_diff: 2 }),
      day({ publisher_diff: -1.5 }),
      day({ unbilled_events: 3 }),
    ];
    expect(findReconciliationProblems(bad)).toHaveLength(3);
  });
});

describe("synthetic check helpers", () => {
  it("picks one zone per format and caps the count", () => {
    const zones = [
      { format: "300x250", id: 1 },
      { format: "300x250", id: 2 },
      { format: "728x90", id: 3 },
      { format: "responsive", id: 4 },
    ];
    expect(pickZonesByFormat(zones, 2).map((z) => z.id)).toEqual([1, 3]);
  });
  const z = (outcome: "ad" | "house_ad" | "no_ad" | "error") => ({
    zone: "z",
    format: "f",
    outcome,
    ms: 1,
  });
  it("is failing when the signing secret is bad, whatever the zones return", () => {
    expect(summarize("missing", [z("ad")])).toBe("failing");
    expect(summarize("too_short", [z("ad")])).toBe("failing");
  });
  it("classifies healthy, degraded, failing and idle", () => {
    expect(summarize("ok", [z("ad"), z("ad")])).toBe("healthy");
    expect(summarize("ok", [z("ad"), z("house_ad")])).toBe("degraded");
    expect(summarize("ok", [z("house_ad"), z("no_ad")])).toBe("failing");
    expect(summarize("ok", [z("ad"), z("error")])).toBe("failing");
    expect(summarize("ok", [])).toBe("idle");
  });
});

describe("retryUnbilledEvents", () => {
  const rows = ["charged", "dup", "paused", "boom"].map((id, i) => ({
    event_type: "impression" as const,
    request_id: id,
    campaign_id: `c${i}`,
    ad_id: "a",
    publisher_id: "p",
    website_id: "w",
    ad_zone_id: "z",
  }));
  const attempts: Array<Record<string, unknown>> = [];

  beforeEach(() => {
    vi.resetModules();
    attempts.length = 0;
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.doMock("@/integrations/supabase/client.server", () => ({
      supabaseAdmin: {
        rpc: async (name: string, args: Record<string, unknown>) => {
          if (name === "find_unbilled_events") return { data: rows, error: null };
          if (name === "record_billing_retry") {
            attempts.push(args);
            return { data: null, error: null };
          }
          return { data: null, error: { message: "unknown" } };
        },
      },
    }));
    const reasons: Record<string, string> = {
      charged: "charged",
      dup: "duplicate",
      paused: "campaign_inactive",
      boom: "error",
    };
    vi.doMock("@/lib/billing-charge.server", () => ({
      chargeAdEvent: async (i: { requestId: string }) => ({
        ok: reasons[i.requestId] === "charged",
        reason: reasons[i.requestId],
        amount: 0,
        publisherAmount: 0,
        platformAmount: 0,
      }),
    }));
  });

  it("bills what it can and records an attempt only for events that stay unbilled", async () => {
    const { retryUnbilledEvents } = await import("@/lib/billing-retry.server");
    const r = await retryUnbilledEvents(10);
    expect(r).toEqual({ scanned: 4, charged: 1, settled: 1, skipped: 1, failed: 1 });
    expect(attempts.map((a) => a["_request_id"])).toEqual(["paused", "boom"]);
  });

  it("does nothing (and does not throw) when the migration is not applied", async () => {
    vi.doMock("@/integrations/supabase/client.server", () => ({
      supabaseAdmin: { rpc: async () => ({ data: null, error: { message: "function not found" } }) },
    }));
    const { retryUnbilledEvents } = await import("@/lib/billing-retry.server");
    expect((await retryUnbilledEvents()).scanned).toBe(0);
  });
});
