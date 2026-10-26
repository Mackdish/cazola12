// @ts-nocheck -- fake-DB fixtures are intentionally loosely typed.
/**
 * End-to-end simulation of the REAL serveAd() code path against an in-memory
 * stand-in for Supabase. Only the database is faked; every decision (zone gate,
 * candidate pre-filter, wallet gate, eligibility, targeting, creative lookup,
 * token signing, timeout / house-ad fallback) is the production code.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";

type Row = Record<string, any>;
type Data = { zones: Row[]; ads: Row[]; wallets: Row[]; daily: Row[]; assets: Row[]; houseAds: Row[]; latencyMs: number };

const RESULTS: Array<Record<string, unknown>> = [];
const SECRET = "s".repeat(48);

function base(): Data {
  const asset = (id: string) => ({
    id,
    storage_path: `org-1/adv-1/${id}.png`,
    width: 300,
    height: 250,
    status: "ready",
    storage_provider: "supabase",
  });
  return {
    latencyMs: 0,
    zones: [
      {
        id: "zone-1",
        zone_key: "zone_abcd1234",
        status: "active",
        format: "responsive",
        website_id: "site-1",
        publisher_id: "pub-1",
        websites: {
          status: "active",
          approval_status: "approved",
          verification_status: "verified",
          category: "business",
          domain: "trademall.co.ke",
        },
        publishers: { status: "active", approval_status: "approved" },
      },
    ],
    ads: [
      {
        id: "ad-1",
        name: "Promo",
        format: "300x250",
        status: "active",
        approval_status: "approved",
        destination_url: "https://advertiser.example/landing",
        media_asset_id: "asset-1",
        campaign_id: "camp-1",
        created_at: "2026-10-20T00:00:00Z",
        campaigns: {
          id: "camp-1",
          organization_id: "org-1",
          status: "active",
          approval_status: "approved",
          bid_type: "cpm",
          bid_amount: 100,
          total_budget: 5000,
          spent_amount: 0,
          priority: 5,
          start_date: null,
          end_date: null,
          campaign_targeting: null,
        },
      },
    ],
    wallets: [{ organization_id: "org-1", currency: "KES", balance_amount: 1000 }],
    daily: [],
    assets: [asset("asset-1"), asset("asset-2")],
    houseAds: [{ creative_url: "https://placehold.co/300x250", click_url: "https://trademall.co.ke", active: true }],
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function fakeSupabase(d: Data) {
  const get = (row: Row, path: string) =>
    path.split(".").reduce((o: any, k) => (o == null ? undefined : o[k]), row);
  const source = (table: string): Row[] =>
    ({ ad_zones: d.zones, ads: d.ads, wallets: d.wallets, campaign_daily_stats: d.daily, media_assets: d.assets, house_ads: d.houseAds }[table] ?? []);

  function from(table: string) {
    const filters: Array<(r: Row) => boolean> = [];
    let lo = 0;
    let hi = Infinity;
    let single = false;
    const run = async () => {
      if (d.latencyMs) await sleep(d.latencyMs);
      // `!inner` embeds drop parents whose embedded row is missing.
      let rows = source(table).filter((r) => filters.every((f) => f(r)));
      rows = rows.slice(lo, hi === Infinity ? undefined : hi + 1);
      return { data: single ? (rows[0] ?? null) : rows, error: null, count: rows.length };
    };
    const api: any = {
      select: () => api,
      eq: (c: string, v: unknown) => (filters.push((r) => get(r, c) === v), api),
      in: (c: string, vs: unknown[]) => (filters.push((r) => vs.includes(get(r, c))), api),
      gt: (c: string, v: number) => (filters.push((r) => Number(get(r, c)) > v), api),
      not: (c: string, op: string, v: unknown) => {
        if (op === "is" && v === null) filters.push((r) => get(r, c) != null);
        return api;
      },
      order: () => api,
      limit: () => api,
      range: (a: number, b: number) => ((lo = a), (hi = b), api),
      maybeSingle: () => ((single = true), run()),
      single: () => ((single = true), run()),
      then: (res: any, rej: any) => run().then(res, rej),
    };
    return api;
  }

  return {
    from,
    rpc: async () => ({ data: { ok: true }, error: null }),
    storage: {
      from: () => ({
        createSignedUrl: async (p: string) => ({ data: { signedUrl: `https://sb.test/${p}?token=t` }, error: null }),
        getPublicUrl: (p: string) => ({ data: { publicUrl: `https://sb.test/public/${p}` } }),
      }),
    },
  };
}

type Opts = {
  country?: string | null;
  origin?: string | null;
  ua?: string;
  secret?: string | undefined;
  redis?: unknown;
  timeoutEnv?: string;
};

let warnings: unknown[][] = [];

async function serve(mutate?: (d: Data) => void, opts: Opts = {}) {
  vi.resetModules();
  const d = base();
  mutate?.(d);
  vi.doMock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: fakeSupabase(d) }));
  vi.doMock("@/lib/fraud-center.server", async (orig) => ({
    ...(await orig<Record<string, unknown>>()),
    recordBlockedIpHit: async () => {},
  }));
  vi.doMock("@/lib/redis.server", () => ({ redis: opts.redis ?? null }));
  if ("secret" in opts) {
    if (opts.secret === undefined) delete process.env["AD_TOKEN_SECRET"];
    else process.env["AD_TOKEN_SECRET"] = opts.secret;
  } else process.env["AD_TOKEN_SECRET"] = SECRET;
  if (opts.timeoutEnv) process.env["AD_SERVE_TIMEOUT_MS"] = opts.timeoutEnv;
  else delete process.env["AD_SERVE_TIMEOUT_MS"];

  warnings = [];
  const mod = await import("@/lib/ad-serving.server");
  const t0 = Date.now();
  const res = await mod.serveAd({
    zoneKey: "zone_abcd1234",
    userAgent: opts.ua ?? "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    country: opts.country === undefined ? "KE" : opts.country,
    county: null,
    city: null,
    requestId: crypto.randomUUID(),
    ipAddress: "203.0.113.9",
    origin: opts.origin ?? null,
  });
  return { res, ms: Date.now() - t0, logs: warnings.map((w) => String(w[0])).filter((s) => s.startsWith("[ad]")) };
}

function outcome(res: any) {
  if (!res.ok) return res.reason as string;
  return res.fillType === "house_ad" ? "HOUSE_AD" : "SERVED";
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation((...a: unknown[]) => void warnings.push(a));
  vi.spyOn(console, "debug").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => void warnings.push(a));
});
afterEach(() => vi.restoreAllMocks());

const scenarios: Array<{
  name: string;
  expect: string;
  mutate?: (d: Data) => void;
  opts?: Opts;
}> = [
  { name: "Happy path: responsive zone, funded KES wallet, approved ad", expect: "SERVED" },
  { name: "Exact-format zone 300x250 + 300x250 ad", expect: "SERVED", mutate: (d) => (d.zones[0]!.format = "300x250") },
  { name: "CPC campaign (billed on click)", expect: "SERVED", mutate: (d) => (d.ads[0]!.campaigns.bid_type = "cpc") },
  { name: "Zone 728x90 but only a 300x250 ad", expect: "no_ad", mutate: (d) => (d.zones[0]!.format = "728x90") },

  { name: "Advertiser has NO wallet", expect: "no_ad", mutate: (d) => (d.wallets = []) },
  { name: "Wallet exists but only in USD", expect: "no_ad", mutate: (d) => (d.wallets[0]!.currency = "USD") },
  { name: "KES wallet with zero balance", expect: "no_ad", mutate: (d) => (d.wallets[0]!.balance_amount = 0) },
  { name: "Campaign status = paused (e.g. auto-paused by billing)", expect: "no_ad", mutate: (d) => (d.ads[0]!.campaigns.status = "paused") },
  { name: "Campaign approval pending", expect: "no_ad", mutate: (d) => (d.ads[0]!.campaigns.approval_status = "pending") },
  { name: "Ad approval pending", expect: "no_ad", mutate: (d) => (d.ads[0]!.approval_status = "pending") },
  { name: "Daily budget reached today", expect: "no_ad", mutate: (d) => { d.ads[0]!.campaigns.daily_budget = 200; d.daily = [{ campaign_id: "camp-1", spend: 200, date: new Date().toISOString().slice(0, 10) }]; } },
  { name: "Daily budget set, today's spend below it", expect: "SERVED", mutate: (d) => { d.ads[0]!.campaigns.daily_budget = 200; d.daily = [{ campaign_id: "camp-1", spend: 150, date: new Date().toISOString().slice(0, 10) }]; } },
  { name: "Daily budget set, nothing spent today", expect: "SERVED", mutate: (d) => (d.ads[0]!.campaigns.daily_budget = 200) },
  { name: "Total budget fully spent", expect: "no_ad", mutate: (d) => (d.ads[0]!.campaigns.spent_amount = 5000) },
  { name: "Campaign starts tomorrow", expect: "no_ad", mutate: (d) => (d.ads[0]!.campaigns.start_date = new Date(Date.now() + 86400e3).toISOString().slice(0, 10)) },
  { name: "Campaign ended yesterday", expect: "no_ad", mutate: (d) => (d.ads[0]!.campaigns.end_date = new Date(Date.now() - 86400e3).toISOString().slice(0, 10)) },
  { name: "Bid amount = 0", expect: "no_ad", mutate: (d) => (d.ads[0]!.campaigns.bid_amount = 0) },
  { name: "Creative asset still 'processing'", expect: "no_ad", mutate: (d) => (d.assets[0]!.status = "processing") },
  { name: "Ad has no creative attached", expect: "no_ad", mutate: (d) => (d.ads[0]!.media_asset_id = null) },

  { name: "Website not verified", expect: "zone_unavailable", mutate: (d) => (d.zones[0]!.websites.verification_status = "pending") },
  { name: "Website approval pending", expect: "zone_unavailable", mutate: (d) => (d.zones[0]!.websites.approval_status = "pending") },
  { name: "Website suspended", expect: "zone_unavailable", mutate: (d) => (d.zones[0]!.websites.status = "suspended") },
  { name: "Publisher suspended", expect: "zone_unavailable", mutate: (d) => (d.zones[0]!.publishers.status = "suspended") },
  { name: "Zone suspended", expect: "zone_unavailable", mutate: (d) => (d.zones[0]!.status = "suspended") },
  { name: "Unknown zone key", expect: "unknown_zone", mutate: (d) => (d.zones = []) },

  { name: "Origin = https://trademall.co.ke (registered)", expect: "SERVED", opts: { origin: "https://trademall.co.ke" } },
  { name: "Origin = https://www.trademall.co.ke", expect: "SERVED", opts: { origin: "https://www.trademall.co.ke" } },
  { name: "Origin = https://app.trademall.co.ke (subdomain)", expect: "zone_unavailable", opts: { origin: "https://app.trademall.co.ke" } },
  { name: "Origin = https://other-site.com", expect: "zone_unavailable", opts: { origin: "https://other-site.com" } },
  { name: "No Origin header (same-origin GET)", expect: "SERVED", opts: { origin: null } },

  {
    name: "Targeting: Kenya only, request from KE",
    expect: "SERVED",
    mutate: (d) => (d.ads[0]!.campaigns.campaign_targeting = { countries: ["KE"] }),
  },
  {
    name: "Targeting: Kenya only, but country header missing (local/dev)",
    expect: "no_ad",
    mutate: (d) => (d.ads[0]!.campaigns.campaign_targeting = { countries: ["KE"] }),
    opts: { country: null },
  },
  {
    name: "Targeting: Uganda only, request from KE",
    expect: "no_ad",
    mutate: (d) => (d.ads[0]!.campaigns.campaign_targeting = { countries: ["UG"] }),
  },
  {
    name: "Targeting: mobile only, desktop visitor",
    expect: "no_ad",
    mutate: (d) => (d.ads[0]!.campaigns.campaign_targeting = { devices: ["mobile"] }),
  },
  {
    name: "Top-ranked ad has an unready creative -> falls back to next ad",
    expect: "SERVED",
    mutate: (d) => {
      const second = structuredClone(d.ads[0]!);
      second.id = "ad-2";
      second.media_asset_id = "asset-2";
      second.campaign_id = "camp-2";
      second.campaigns.id = "camp-2";
      second.campaigns.bid_amount = 50;
      d.ads[0]!.campaigns.bid_amount = 500; // ad-1 outranks ad-2...
      d.assets[0]!.status = "failed"; // ...but its creative is broken
      d.ads.push(second);
    },
  },

  { name: "AD_TOKEN_SECRET not set", expect: "HOUSE_AD", opts: { secret: undefined } },
  { name: "AD_TOKEN_SECRET set but < 32 chars", expect: "HOUSE_AD", opts: { secret: "short-secret-123" } },

  { name: "Database latency 400ms per query (default timeout)", expect: "SERVED", mutate: (d) => (d.latencyMs = 400) },
  { name: "Database latency 700ms per query (default timeout)", expect: "HOUSE_AD", mutate: (d) => (d.latencyMs = 700) },
  { name: "Database latency 250ms + AD_SERVE_TIMEOUT_MS=350 (old .env.example value, now clamped to 1500)", expect: "SERVED", mutate: (d) => (d.latencyMs = 250), opts: { timeoutEnv: "350" } },
  { name: "Database latency 400ms + AD_SERVE_TIMEOUT_MS=350 (clamp to 1500 is still not enough)", expect: "HOUSE_AD", mutate: (d) => (d.latencyMs = 400), opts: { timeoutEnv: "350" } },
];

describe("serveAd() end to end, real code, fake database", () => {
  it.each(scenarios)("$name", async ({ name, expect: want, mutate, opts }) => {
    const { res, ms, logs } = await serve(mutate, opts);
    const got = outcome(res);
    RESULTS.push({ name, want, got, ms, logs: [...new Set(logs)].join(", ") });
    expect(got).toBe(want);
  }, 30_000);

  it("a signed token for the winning ad verifies and names the right ad", async () => {
    const { res } = await serve((d) => {
      const second = structuredClone(d.ads[0]!);
      second.id = "ad-2";
      second.media_asset_id = "asset-2";
      second.campaign_id = "camp-2";
      second.campaigns.id = "camp-2";
      second.campaigns.bid_amount = 50;
      d.ads[0]!.campaigns.bid_amount = 500;
      d.assets[0]!.status = "failed";
      d.ads.push(second);
    });
    expect(res.ok).toBe(true);
    const { verifyServedToken } = await import("@/lib/ad-token.server");
    const payload = verifyServedToken((res as any).token);
    expect(payload?.adId).toBe("ad-2");
    expect(payload?.zoneId).toBe("zone-1");
    RESULTS.push({ name: "TOKEN: verifies, names the fallback ad", want: "ad-2", got: payload?.adId, ms: 0, logs: "" });
  });

  it("Redis configured but failing (bad token / outage): still serves a real ad", async () => {
    const broken = {
      sismember: async () => {
        throw new Error("WRONGPASS invalid or missing auth token");
      },
      get: async () => {
        throw new Error("WRONGPASS");
      },
      setex: async () => {
        throw new Error("WRONGPASS");
      },
    };
    const { res } = await serve(undefined, { redis: broken });
    RESULTS.push({ name: "Redis configured but erroring", want: "SERVED", got: outcome(res), ms: 0, logs: "" });
    expect(outcome(res)).toBe("SERVED");
  });

  it("Redis blocklist hit still blocks when Redis is healthy", async () => {
    const { res } = await serve(undefined, { redis: { sismember: async () => 1, get: async () => null, setex: async () => "OK" } });
    expect(outcome(res)).toBe("blocked_ip");
  });
});

afterAll(() => {
  if (process.env["SIM_OUT"]) writeFileSync(process.env["SIM_OUT"], JSON.stringify(RESULTS, null, 1));
});
