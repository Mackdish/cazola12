import { describe, expect, it } from "vitest";

import {
  AD_FORMATS,
  adFormatSpec,
  buildEmbedCode,
  categoryLabel,
  formatDimensions,
  normalizeDomain,
  verificationFileName,
} from "./publisher-domain";

describe("normalizeDomain", () => {
  it.each([
    ["example.com", "example.com"],
    ["https://www.Example.com/blog?x=1", "example.com"],
    ["  EXAMPLE.COM  ", "example.com"],
    ["sub.example.co.uk", "sub.example.co.uk"],
    ["http://example.com:8080", "example.com"],
    ["user:pass@example.com", "example.com"],
    ["", null],
    ["not a domain", null],
    ["localhost", null],
    ["example.1", null],
    ["1.2.3.4", null],
    ["a.b", null],
  ])("%s → %s", (input, expected) => {
    expect(normalizeDomain(input)).toBe(expected);
  });

  it("rejects domains over 253 characters", () => {
    const long = "a." + "b.".repeat(130) + "com";
    expect(normalizeDomain(long)).toBeNull();
  });
});

describe("buildEmbedCode", () => {
  it("renders a fixed-size banner", () => {
    const snippet = buildEmbedCode({
      origin: "https://ads.example.com",
      zoneKey: "z-abc123",
      format: "300x250",
      width: 300,
      height: 250,
      responsive: false,
    });
    expect(snippet).toContain('data-trademall-zone="z-abc123"');
    expect(snippet).toContain('data-width="300"');
    expect(snippet).toContain('data-height="250"');
    expect(snippet).toContain("width:300px;height:250px");
    expect(snippet).toContain("https://ads.example.com/ad/loader.js");
  });

  it("renders a responsive unit", () => {
    const snippet = buildEmbedCode({
      origin: "https://ads.example.com/",
      zoneKey: "z-responsive",
      format: "responsive",
      width: null,
      height: null,
      responsive: true,
    });
    expect(snippet).toContain('data-responsive="true"');
    expect(snippet).toContain("width:100%");
    expect(snippet).not.toContain("data-width");
  });

  it("strips trailing slashes from origin", () => {
    const snippet = buildEmbedCode({
      origin: "https://ads.example.com///",
      zoneKey: "z-abc",
      format: "320x50",
      width: 320,
      height: 50,
      responsive: false,
    });
    expect(snippet).toContain("https://ads.example.com/ad/loader.js");
  });
});

describe("adFormatSpec", () => {
  it("returns the spec for every known format", () => {
    for (const { format } of AD_FORMATS) {
      const spec = adFormatSpec(format);
      expect(spec.format).toBe(format);
    }
  });

  it("throws for unknown formats", () => {
    expect(() => adFormatSpec("999x999" as never)).toThrow("Unknown ad format");
  });
});

describe("formatDimensions", () => {
  it("returns responsive for responsive zones", () => {
    expect(
      formatDimensions({ format: "responsive", width: null, height: null, responsive: true }),
    ).toBe("Responsive");
  });

  it("returns width × height for fixed zones", () => {
    expect(
      formatDimensions({ format: "300x250", width: 300, height: 250, responsive: false }),
    ).toBe("300 × 250");
  });

  it("falls back to em dash when dimensions are missing", () => {
    expect(
      formatDimensions({ format: "300x250", width: null, height: null, responsive: false }),
    ).toBe("—");
  });
});

describe("categoryLabel", () => {
  it("returns the label for a known category", () => {
    expect(categoryLabel("technology")).toBe("Technology");
  });

  it("returns Other for unknown categories", () => {
    expect(categoryLabel("missing" as never)).toBe("Other");
  });
});

describe("verificationFileName", () => {
  it("includes the verification key and token", () => {
    expect(verificationFileName("token123")).toContain("trademall-verification-token123.txt");
  });
});
