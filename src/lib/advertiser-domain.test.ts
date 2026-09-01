import { describe, expect, it } from "vitest";

import {
  allowedTransitions,
  assertTransition,
  canTransition,
  creativeStoragePath,
  EMPTY_TARGETING,
  filterSortPaginateCampaigns,
  normalizeDestinationUrl,
  organizationFromStoragePath,
  parseSchedule,
  targetingMatches,
  validateCreativeAgainstFormat,
  validateCreativeFile,
  type Campaign,
} from "@/lib/advertiser-domain";
import { readImageMetadata } from "@/lib/image-metadata";

describe("campaign lifecycle", () => {
  it("allows draft → pending review by the advertiser", () => {
    expect(canTransition("draft", "pending_review", "advertiser")).toBe(true);
  });

  it("does not let advertisers approve their own campaign", () => {
    expect(canTransition("pending_review", "approved", "advertiser")).toBe(false);
    expect(canTransition("pending_review", "approved", "admin")).toBe(true);
  });

  it("blocks jumping straight from draft to active", () => {
    expect(canTransition("draft", "active", "advertiser")).toBe(false);
    expect(() => assertTransition("draft", "active", "advertiser")).toThrow();
  });

  it("supports pause and reactivate for admins", () => {
    expect(canTransition("active", "paused", "admin")).toBe(true);
    expect(canTransition("paused", "active", "admin")).toBe(true);
  });

  it("treats completed as terminal", () => {
    expect(allowedTransitions("completed", "advertiser")).toEqual([]);
    expect(allowedTransitions("completed", "admin")).toEqual([]);
  });

  it("lets a rejected campaign be reworked as a draft", () => {
    expect(canTransition("rejected", "draft", "advertiser")).toBe(true);
  });
});

describe("creative validation", () => {
  it("rejects unsupported mime types", () => {
    expect(validateCreativeFile({ mimeType: "application/pdf", fileSize: 100 }).ok).toBe(false);
  });

  it("accepts a small png", () => {
    expect(validateCreativeFile({ mimeType: "image/png", fileSize: 20_000 }).ok).toBe(true);
  });

  it("enforces the size limit", () => {
    expect(validateCreativeFile({ mimeType: "image/png", fileSize: 5_000_000 }).ok).toBe(false);
    expect(validateCreativeFile({ mimeType: "image/gif", fileSize: 1_500_000 }).ok).toBe(false);
  });

  it("requires exact dimensions for fixed formats", () => {
    expect(validateCreativeAgainstFormat("300x250", { width: 300, height: 250 }).ok).toBe(true);
    const bad = validateCreativeAgainstFormat("300x250", { width: 728, height: 90 });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.message).toContain("300×250");
  });

  it("allows a range for responsive creatives", () => {
    expect(validateCreativeAgainstFormat("responsive", { width: 600, height: 400 }).ok).toBe(true);
    expect(validateCreativeAgainstFormat("responsive", { width: 10, height: 10 }).ok).toBe(false);
  });

  it("derives an org-scoped storage path", () => {
    const path = creativeStoragePath({
      organizationId: "org-1",
      advertiserId: "adv-1",
      assetId: "asset-1",
      mimeType: "image/jpeg",
    });
    expect(path).toBe("org-1/adv-1/asset-1.jpg");
    expect(organizationFromStoragePath(path)).toBe("org-1");
  });
});

describe("image metadata sniffing", () => {
  it("reads png dimensions", () => {
    const bytes = new Uint8Array(24);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    bytes.set([0x49, 0x48, 0x44, 0x52], 12);
    bytes.set([0, 0, 1, 0x2c], 16); // 300
    bytes.set([0, 0, 0, 0xfa], 20); // 250
    expect(readImageMetadata(bytes)).toMatchObject({
      mimeType: "image/png",
      width: 300,
      height: 250,
    });
  });

  it("reads gif dimensions", () => {
    const bytes = new Uint8Array(10);
    bytes.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], 0);
    bytes.set([0x2c, 0x01, 0xfa, 0x00], 6);
    expect(readImageMetadata(bytes)).toMatchObject({
      mimeType: "image/gif",
      width: 300,
      height: 250,
    });
  });

  it("rejects non-image bytes", () => {
    expect(readImageMetadata(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))).toBeNull();
  });
});

describe("targeting rules", () => {
  it("matches everything when nothing is configured", () => {
    expect(targetingMatches(EMPTY_TARGETING, { country: "KE" })).toBe(true);
  });

  it("filters by country case-insensitively", () => {
    const rules = { ...EMPTY_TARGETING, countries: ["KE", "UG"] };
    expect(targetingMatches(rules, { country: "ke" })).toBe(true);
    expect(targetingMatches(rules, { country: "US" })).toBe(false);
    expect(targetingMatches(rules, {})).toBe(false);
  });

  it("requires every configured dimension to match", () => {
    const rules = { ...EMPTY_TARGETING, countries: ["KE"], devices: ["mobile" as const] };
    expect(targetingMatches(rules, { country: "KE", device: "mobile" })).toBe(true);
    expect(targetingMatches(rules, { country: "KE", device: "desktop" })).toBe(false);
  });

  it("honours the weekly schedule", () => {
    const rules = { ...EMPTY_TARGETING, schedule: { mon: [{ start: 9, end: 17 }] } };
    expect(targetingMatches(rules, { weekday: "mon", hour: 10 })).toBe(true);
    expect(targetingMatches(rules, { weekday: "mon", hour: 18 })).toBe(false);
    expect(targetingMatches(rules, { weekday: "tue", hour: 10 })).toBe(false);
  });

  it("parses and sanitises stored schedules", () => {
    expect(
      parseSchedule({ mon: [{ start: -5, end: 40 }], junk: 1, tue: [{ start: 5, end: 5 }] }),
    ).toEqual({
      mon: [{ start: 0, end: 24 }],
    });
    expect(parseSchedule(null)).toEqual({});
  });
});

describe("campaign list query", () => {
  const base = (over: Partial<Campaign>): Campaign =>
    ({
      name: "Campaign",
      status: "draft",
      created_at: "2026-01-01T00:00:00Z",
      total_budget: 100,
      start_date: "2026-01-01",
      ...over,
    }) as Campaign;

  const rows = [
    base({
      name: "Alpha",
      created_at: "2026-01-03T00:00:00Z",
      total_budget: 300,
      status: "active",
    }),
    base({ name: "Beta", created_at: "2026-01-02T00:00:00Z", total_budget: 100 }),
    base({
      name: "Gamma",
      created_at: "2026-01-01T00:00:00Z",
      total_budget: 200,
      status: "paused",
    }),
  ];

  it("searches by name", () => {
    expect(filterSortPaginateCampaigns(rows, { search: "bet" }).total).toBe(1);
  });

  it("filters by status", () => {
    expect(filterSortPaginateCampaigns(rows, { status: "active" }).total).toBe(1);
  });

  it("filters by date range", () => {
    expect(filterSortPaginateCampaigns(rows, { from: "2026-01-02" }).total).toBe(2);
    expect(filterSortPaginateCampaigns(rows, { to: "2026-01-01" }).total).toBe(1);
  });

  it("sorts and paginates", () => {
    const result = filterSortPaginateCampaigns(rows, {
      sortBy: "name",
      direction: "asc",
      pageSize: 2,
      page: 2,
    });
    expect(result.pageCount).toBe(2);
    expect(result.rows.map((row) => row.name)).toEqual(["Gamma"]);
  });
});

describe("destination urls", () => {
  it("accepts https urls", () => {
    expect(normalizeDestinationUrl("https://example.com/landing")).toBe(
      "https://example.com/landing",
    );
  });

  it("rejects other schemes and junk", () => {
    expect(normalizeDestinationUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeDestinationUrl("not a url")).toBeNull();
    expect(normalizeDestinationUrl("http://localhost")).toBeNull();
  });
});
