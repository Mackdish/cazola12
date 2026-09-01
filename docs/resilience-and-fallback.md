# Resilience and Fallback

What this covers: timeout behavior on the serving path, the house ad fallback pool, known scaling limits, and what happens when components fail. Who should read this: SRE, platform engineers, and anyone debugging serving latency or empty ad zones.

## Timeout on serveAd()

`serveAd()` in `src/lib/ad-serving.server.ts:258-355` is wrapped in a 200ms `Promise.race` timeout. The inner `serveAdInner()` (line 268) performs the actual work: `loadZoneContext` → `loadCandidates` → `fundedOrganizationIds` → `selectAd` → `creativeUrl`. If the inner promise does not resolve within 200ms, the outer `serveAd()` catches a `serve_timeout` error.

**On timeout:**
1. The error is logged with zone and reason (`src/lib/ad-serving.server.ts:376-380`).
2. The system attempts to serve a house ad from the `house_ads` table (`src/lib/ad-serving.server.ts:382-400`).
3. If a house ad is available, it is returned as a normal ad response with `fillType: "house_ad"`. No HMAC token is issued (house ads do not need tracking beacons).
4. If no house ad exists, the response is `{ ok: false, reason: "serve_timeout" }`.

The 200ms timeout is a starting value. Adjust it based on observed p99 latency of `loadCandidates` + `selectAd` + `creativeUrl` in production.

## House Ad Fallback Pool

The house ad fallback is defined in `supabase/migrations/20260825200001_create_house_ads.sql`. The table schema:

| Column | Type | Purpose |
|---|---|---|
| `id` | uuid (PK) | Unique identifier |
| `creative_url` | text | Image URL to render |
| `click_url` | text | Destination when user clicks |
| `active` | boolean | Whether this house ad is eligible for fallback |
| `created_at` | timestamptz | Insertion time |
| `updated_at` | timestamptz | Last update |

One placeholder house ad is seeded by default:
- `creative_url`: `https://placehold.co/300x250/2563eb/ffffff?text=TradeMall`
- `click_url`: `https://trademall.co.ke`
- `active`: `true`

### House Ad Behavior

- **Served when:** `serveAdInner()` times out, throws an unhandled error, or returns `no_ad` due to no eligible candidates. (Note: the current implementation only falls back on timeout/error, not on `no_ad` from empty candidates.)
- **Tracked:** Yes — an impression is recorded for the house ad so fill-rate metrics are accurate.
- **Billed:** **Never** — `chargeAdEvent()` is never called for house ads.
- **Distinguishable:** The response includes `fillType: "house_ad"` (`src/lib/ad-serving.server.ts:375`). Logs use `[ad] house_ad_served` with the zone and reason (`timeout` or `error`).

### Managing House Ads

House ads are managed through the `house_ads` table. To add a new house ad creative, insert a row with `active = true`. To disable one, set `active = false`. The `loadHouseAd()` function (`src/lib/ad-serving.server.ts:365-393`) queries `SELECT creative_url, click_url FROM house_ads WHERE active = true LIMIT 1`.

## Known Scaling Limits

### Row-Lock Contention on High-Traffic Campaigns

The `charge_campaign_event` RPC acquires `FOR UPDATE` on the `campaigns` row and the `wallets` row (`supabase/migrations/20260825200000_fix_charge_campaign_event_rpc.sql:76-79, 169-172`). For a campaign receiving many requests per second, all billing transactions serialize on these locks.

**Impact:** Billing latency increases linearly with contention. At 100 req/s with 5ms RPC execution, the 100th request waits ~500ms for the lock. This does not block `loadCandidates()` (read-only), but it does block the billing tail of `recordImpression()`/`recordClick()`.

**Mitigation path (not yet built):** Buffer spend in Redis and flush to the RPC in batches per campaign (e.g., every 100ms or 1k events). This amortizes lock cost across multiple events but introduces eventual consistency on `spent_amount`.

### In-Memory Creative Cache

`CREATIVE_CACHE` is a module-level `Map` with 60-second TTL (`src/lib/ad-serving.server.ts:48-62`). In a multi-instance deployment, each instance has its own cache. There is no cache invalidation when an advertiser updates a creative; the old URL remains cached until TTL expiry.

**Impact:** Cold-start penalty on every instance for every creative. Stale creatives served for up to 60 seconds after an update.

**Mitigation path (not yet built):** Migrate to Redis or Cloudflare KV with a shared cache keyed by `mediaAssetId` and short TTL (30-60s). Add a cache-bust on ad update.

### Redis / Optional Services

If Redis is unavailable:
- Blocked IP checks fall back to allowing the request (`src/lib/ad-serving.server.ts:262-271`).
- The impression buffer falls back to direct `impressions` table inserts (`src/lib/impression-buffer.server.ts`).

Neither failure breaks serving; they only degrade fraud protection or throughput.

## Scheduled Jobs

Defined in `src/server.ts:109-152`:

| Job | Schedule | What it does |
|---|---|---|
| `flushImpressionBatch` | Every invocation of `scheduled()` | Flushes buffered impressions from Redis/queue to Postgres |
| `purgeExpiredIpAddresses` | Daily at 03:00 UTC | Removes old entries from `fraud_events` |
| `syncBlockedIpsToRedis` | Every invocation | Syncs blocked IPs from Postgres to Redis set |

There is no scheduled reconciliation, no budget reset job, and no metric aggregation.
