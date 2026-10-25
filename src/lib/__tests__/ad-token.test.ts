import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const payload = {
  rid: "req-1",
  adId: "ad-1",
  campaignId: "camp-1",
  publisherId: "pub-1",
  websiteId: "site-1",
  zoneId: "zone-1",
  device: "desktop",
  browser: "chrome",
  os: "windows",
  country: "KE",
};

const LONG_SECRET = "s".repeat(48);

// runtime-env keeps a module-level cache, so load fresh module instances per test.
async function load() {
  vi.resetModules();
  const runtimeEnv = await import("@/lib/runtime-env.server");
  const token = await import("@/lib/ad-token.server");
  return { runtimeEnv, token };
}

describe("ad token signing secret", () => {
  const original = process.env["AD_TOKEN_SECRET"];

  beforeEach(() => {
    delete process.env["AD_TOKEN_SECRET"];
  });

  afterEach(() => {
    if (original === undefined) delete process.env["AD_TOKEN_SECRET"];
    else process.env["AD_TOKEN_SECRET"] = original;
  });

  it("works when the secret exists ONLY in the Cloudflare runtime env (not process.env)", async () => {
    // This is the production failure: Workers deliver secrets on `env`, and the
    // process.env mirror can be rejected. Ads were selected, then crashed here.
    const { runtimeEnv, token } = await load();
    runtimeEnv.captureRuntimeEnv({ AD_TOKEN_SECRET: LONG_SECRET });
    expect(process.env["AD_TOKEN_SECRET"]).toBeUndefined();

    expect(token.tokenSecretStatus()).toBe("ok");
    const issued = token.issueServedToken(payload);
    expect(token.verifyServedToken(issued)).toMatchObject({ rid: "req-1", adId: "ad-1" });
  });

  it("still works when the secret is only on process.env", async () => {
    process.env["AD_TOKEN_SECRET"] = LONG_SECRET;
    const { token } = await load();
    expect(token.tokenSecretStatus()).toBe("ok");
    expect(token.verifyServedToken(token.issueServedToken(payload))).not.toBeNull();
  });

  it("reports a missing secret and refuses to issue tokens", async () => {
    const { token } = await load();
    expect(token.tokenSecretStatus()).toBe("missing");
    expect(() => token.issueServedToken(payload)).toThrow("not configured");
  });

  it("reports a too-short secret separately from a missing one", async () => {
    const { runtimeEnv, token } = await load();
    runtimeEnv.captureRuntimeEnv({ AD_TOKEN_SECRET: "short" });
    expect(token.tokenSecretStatus()).toBe("too_short");
    expect(() => token.issueServedToken(payload)).toThrow("too short");
  });

  it("rejects a tampered token", async () => {
    const { runtimeEnv, token } = await load();
    runtimeEnv.captureRuntimeEnv({ AD_TOKEN_SECRET: LONG_SECRET });
    const issued = token.issueServedToken(payload);
    const [body, sig] = issued.split(".");
    const forged = Buffer.from(JSON.stringify({ ...payload, adId: "other-ad", exp: 9999999999 })).toString("base64url");
    expect(token.verifyServedToken(`${forged}.${sig}`)).toBeNull();
    expect(token.verifyServedToken(`${body}.${sig}x`)).toBeNull();
  });
});
