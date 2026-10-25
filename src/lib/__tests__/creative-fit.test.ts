import { describe, expect, it } from "vitest";

import { computeCreativeDisplay } from "@/lib/creative-fit";

const fit = (
  zoneFormat: Parameters<typeof computeCreativeDisplay>[0]["zoneFormat"],
  adFormat: Parameters<typeof computeCreativeDisplay>[0]["adFormat"],
  naturalWidth: number | null,
  naturalHeight: number | null,
) => computeCreativeDisplay({ zoneFormat, adFormat, naturalWidth, naturalHeight });

describe("computeCreativeDisplay — fixed-size slots", () => {
  it("fills a slot exactly when the creative already matches", () => {
    expect(fit("728x90", "728x90", 728, 90)).toEqual({ width: 728, height: 90, fit: "cover" });
    expect(fit("300x250", "300x250", 600, 500)).toEqual({ width: 300, height: 250, fit: "cover" });
  });

  it("uses the slot size, not the creative size (the 1024x1024-in-a-leaderboard bug)", () => {
    const d = fit("728x90", "responsive", 1024, 1024);
    expect(d.width).toBe(728);
    expect(d.height).toBe(90);
    expect(d.fit).toBe("contain"); // a square must not be cropped to a 728x90 strip
  });

  it("crops slightly (cover) when the shape is within 10% of the slot", () => {
    expect(fit("728x90", "responsive", 700, 90).fit).toBe("cover"); // ~4% off
    expect(fit("300x250", "responsive", 320, 250).fit).toBe("cover"); // ~7% off
  });

  it("switches to contain just past the 10% tolerance", () => {
    expect(fit("300x250", "responsive", 340, 250).fit).toBe("contain"); // ~13% off
  });

  it("never crops when the creative's size is unknown", () => {
    expect(fit("320x50", "320x50", null, null)).toEqual({ width: 320, height: 50, fit: "contain" });
  });

  it("treats zero, negative and NaN sizes as unknown", () => {
    expect(fit("320x100", "responsive", 0, 100).fit).toBe("contain");
    expect(fit("320x100", "responsive", -5, 100).fit).toBe("contain");
    expect(fit("320x100", "responsive", Number.NaN, 100).fit).toBe("contain");
  });
});

describe("computeCreativeDisplay — responsive slots", () => {
  it("uses a fixed ad's own size when the slot is responsive", () => {
    expect(fit("responsive", "300x250", 900, 750)).toEqual({ width: 300, height: 250, fit: "cover" });
  });

  it("keeps the creative's shape and caps a big square at 400px tall", () => {
    expect(fit("responsive", "responsive", 1024, 1024)).toEqual({ width: 400, height: 400, fit: "cover" });
  });

  it("caps wide creatives at 728px wide, keeping their shape", () => {
    expect(fit("responsive", "responsive", 1456, 180)).toEqual({ width: 728, height: 90, fit: "cover" });
  });

  it("never scales a small creative up past its real size", () => {
    expect(fit("responsive", "responsive", 200, 100)).toEqual({ width: 200, height: 100, fit: "cover" });
  });

  it("falls back to 300x250 (contain) when the size is unknown", () => {
    expect(fit("responsive", "responsive", null, null)).toEqual({ width: 300, height: 250, fit: "contain" });
  });
});
