import { describe, expect, it, vi } from "vitest";

const { mockGet, mockIncr, mockExpire } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockIncr: vi.fn(),
  mockExpire: vi.fn(),
}));

vi.mock("@/lib/redis.server", () => ({
  redis: {
    get: mockGet,
    incr: mockIncr,
    expire: mockExpire,
  },
}));

import { checkFrequencyCap, recordFrequencyCap } from "@/lib/frequency-cap.server";

describe("frequency cap", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockIncr.mockReset();
    mockExpire.mockReset();
  });

  it("does not consume a cap while checking eligibility", async () => {
    mockGet.mockResolvedValue("2");
    const result = await checkFrequencyCap("sess-1", "camp-1", { impressions: 5, periodHours: 24 });
    expect(result).toEqual({ capped: false, count: 2 });
    expect(mockGet).toHaveBeenCalledWith("fcap:sess-1:camp-1");
    expect(mockIncr).not.toHaveBeenCalled();
  });

  it("blocks when the stored count has reached the cap", async () => {
    mockGet.mockResolvedValue("5");
    const result = await checkFrequencyCap("sess-1", "camp-1", { impressions: 5, periodHours: 24 });
    expect(result).toEqual({ capped: true, count: 5 });
  });

  it("records only after a winning impression", async () => {
    mockIncr.mockResolvedValue(1);
    const result = await recordFrequencyCap("sess-1", "camp-1", { impressions: 5, periodHours: 24 });
    expect(result).toBe(1);
    expect(mockIncr).toHaveBeenCalledWith("fcap:sess-1:camp-1");
    expect(mockExpire).toHaveBeenCalledWith("fcap:sess-1:camp-1", 86400);
  });

  it("does nothing when no cap is configured", async () => {
    expect(await checkFrequencyCap("sess-1", "camp-1", null)).toEqual({ capped: false, count: 0 });
    expect(await recordFrequencyCap("sess-1", "camp-1", null)).toBe(0);
    expect(mockGet).not.toHaveBeenCalled();
    expect(mockIncr).not.toHaveBeenCalled();
  });
});
