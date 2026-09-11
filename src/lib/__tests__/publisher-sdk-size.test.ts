import { gzipSync, brotliCompressSync, constants as zlibConstants } from "node:zlib";
import { describe, expect, it } from "vitest";
import { AD_SDK_SOURCE } from "../ad-sdk-source";

const MAX_COMPRESSED_BYTES = 5 * 1024;

describe("publisher SDK", () => {
  it("stays below the 5 KB compressed budget", () => {
    const source = AD_SDK_SOURCE.replaceAll("__ORIGIN__", "https://trademall.co.ke")
      .replaceAll("__API_ORIGIN__", "https://trademall.co.ke");
    const gzipBytes = gzipSync(source, { level: 9 }).byteLength;
    const brotliBytes = brotliCompressSync(source, {
      params: {
        [zlibConstants.BROTLI_PARAM_QUALITY]: 11,
      },
    }).byteLength;

    expect(gzipBytes).toBeLessThan(MAX_COMPRESSED_BYTES);
    expect(brotliBytes).toBeLessThan(MAX_COMPRESSED_BYTES);
  });

  it("contains the publisher security and telemetry primitives", () => {
    expect(AD_SDK_SOURCE).toContain('attachShadow({mode:"closed"})');
    expect(AD_SDK_SOURCE).toContain("navigator.sendBeacon");
    expect(AD_SDK_SOURCE).toContain("document.visibilityState");
    expect(AD_SDK_SOURCE).toContain("viewportWidth");
    expect(AD_SDK_SOURCE).toContain("viewportHeight");
    expect(AD_SDK_SOURCE).toContain("navigator.userAgentData");
  });
});
