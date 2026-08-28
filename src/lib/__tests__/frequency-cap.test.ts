import { describe, expect, it, vi } from "vitest";

const { mockIncr, mockExpire } = vi.hoisted(() => ({
  mockIncr: vi.fn(),
  mockExpire: vi.fn(),
}));

vi.mock("@/lib/redis.server", () => ({
  redis: {
    incr: mockIncr,
    expire: mockExpire,
  },
}));

import { checkFrequencyCap } from "@/lib/frequency-cap.server";

describe("checkFrequencyCap", () => {
  beforeEach(() => {
    mockIncr.mockReset();
    mockExpire.mockReset();
  });

  it("allows all impressions when cap is null", async () => {
    const result = await checkFrequencyCap("sess-1", "camp-1", null);
    expect(result).toEqual({ capped: false, count: 0 });
    expect(mockIncr).not.toHaveBeenCalled();
  });

  it("allows impressions when under the cap", async () => {
    mockIncr.mockResolvedValue(2);
    const result = await checkFrequencyCap("sess-1", "camp-1", { impressions: 5, periodHours: 24 });
    expect(result).toEqual({ capped: false, count: 2 });
    expect(mockIncr).toHaveBeenCalledWith("fcap:sess-1:camp-1");
    expect(mockExpire).not.toHaveBeenCalled();
  });

  it("blocks impressions when the cap is exceeded", async () => {
    mockIncr.mockResolvedValue(6);
    const result = await checkFrequencyCap("sess-1", "camp-1", { impressions: 5, periodHours: 24 });
    expect(result).toEqual({ capped: true, count: 6 });
    expect(mockIncr).toHaveBeenCalledWith("fcap:sess-1:camp-1");
  });

  it("blocks impressions when the cap is exceeded", async () => {
    mockIncr.mockResolvedValue(6);
    const result = await checkFrequencyCap("sess-1", "camp-1", { impressions: 5, periodHours: 24 });
    expect(result).toEqual({ capped: true, count: 6 });
  });

  it("sets TTL on first impression", async () => {
    mockIncr.mockResolvedValue(1);
    const result = await checkFrequencyCap("sess-1", "camp-1", { impressions: 5, periodHours: 24 });
    expect(result).toEqual({ capped: false, count: 1 });
    expect(mockExpire).toHaveBeenCalledWith("fcap:sess-1:camp-1", 86400);
  });

  it("does not set TTL on subsequent impressions", async () => {
    mockIncr.mockResolvedValue(2);
    const result = await checkFrequencyCap("sess-1", "camp-1", { impressions: 5, periodHours: 24 });
    expect(result).toEqual({ capped: false, count: 2 });
    expect(mockExpire).not.toHaveBeenCalled();
  });

  it("is a no-op when redis is unavailable", async () => {
    const { redis } = await import("@/lib/redis.server");
    const original = redis;
    vi.spyOn(await import("@/lib/redis.server"), "redis", "get").mockReturnValue(null);
    const result = await checkFrequencyCap("sess-1", "camp-1", { impressions: 5, periodHours: 24 });
    expect(result).toEqual({ capped: false, count: 0 });
    vi.spyOn(await import("@/lib/redis.server"), "redis", "get").mockReturnValue(original);
  });
});
