# Architecture Overview

What this covers: a map of every major component in the TradeMall ad server, how they connect, and the exact code paths a request flows through. Who should read this: anyone working on serving, bidding, billing, or fraud logic.

## System Components

| Component | Responsibility | Key file(s) |
|---|---|---|
| Publisher SDK | Injects ad slots into publisher pages, calls `/api/public/ad`, fires impression/click beacons | `src/lib/ad-sdk-source.ts` |
| Ad server | Validates zone, loads candidates, runs auction, selects winner, returns creative + HMAC token | `src/lib/ad-serving.server.ts` |
| Bidding/selection | Pure eligibility + scoring logic, no DB access | `src/lib/ad-serving-domain.ts` |
| Billing RPC | Atomic charge event: validates campaign/ad status, budget, wallet, inserts spend rows | `supabase/migrations/20260825200000_fix_charge_campaign_event_rpc.sql` |
| Billing caller | Thin wrapper that invokes the RPC and pauses campaign on budget exhaustion | `src/lib/billing-charge.server.ts` |
| Fraud detection | Evaluates impression/click signals for bot patterns, rapid-fire, IP repeat offenders | `src/lib/fraud-detection.server.ts` |
| Admin approval | Admin reviews pending campaigns/ads, transitions status machine | `src/lib/advertiser-service.server.ts` |
| HMAC tokens | Signs served ad payloads so impression/click endpoints can verify authenticity without trusting the browser | `src/lib/ad-token.server.ts` |
| Impression buffer | Optional Redis-backed buffer for high-throughput impression ingestion | `src/lib/impression-buffer.server.ts` |
| Scheduled jobs | Runs in Cloudflare Workers `scheduled()` handler: buffer flush, fraud retention purge, blocklist sync | `src/server.ts:109-152` |

## Data Stores

| Store | What it holds | Accessed by |
|---|---|---|
| Postgres (Supabase) | campaigns, ads, ad_groups, ad_zones, websites, publishers, organizations, wallets, wallet_transactions, campaign_spend, publisher_earnings, impressions, clicks, fraud_events, campaign_daily_stats, house_ads, platform_settings | All server-side code via `supabaseAdmin` |
| In-memory CREATIVE_CACHE | Map of `mediaAssetId → { url, width, height, _ts }` with 60s TTL | `src/lib/ad-serving.server.ts:48-62` |
| In-memory serve-cache | Map of `requestId → { zoneId, adId, campaignId, ... }` with 5min TTL, used only for impression/click validation | `src/lib/serve-cache.server.ts` |
| Optional Redis | blocked_ips set, impression buffer backlog | `src/lib/impression-buffer.server.ts`, `src/lib/fraud-center.server.ts` |

## Request Lifecycle (numbered)

The following traces a single ad request from the publisher's page through to billing.

1. Publisher page loads `ad-sdk-source.ts` string, which calls `GET /api/public/ad?zone=<zone_key>` (`src/lib/ad-sdk-source.ts:197`).
2. Route handler `src/routes/api/public/ad.ts:39-101` validates the zone key, checks rate limit (`extractIpAddress`, `checkRateLimit`), and generates a fresh `requestId = crypto.randomUUID()` (`src/routes/api/public/ad.ts:69`).
3. `serveAd(input)` is called (`src/lib/ad-serving.server.ts:258`). It checks Redis for blocked IPs, then calls `loadZoneContext(zoneKey)` (`src/lib/ad-serving.server.ts:273`) which queries `websites`, `publishers`, `ad_zones`, and `campaign_targeting` in a single join.
4. `zoneIsServeable(zone)` (`src/lib/ad-serving-domain.ts:111-119`) runs supply-side checks: zone active, website active+approved+verified, publisher active+approved. If any fail, returns `zone_unavailable`.
5. `loadCandidates(zone)` (`src/lib/ad-serving.server.ts:110-183`) queries `ads` with an inner join on `campaigns` and `campaign_targeting`, filtered by:
   - `ads.status = 'active'`
   - `ads.approval_status = 'approved'`
   - `campaigns.approval_status = 'approved'`
   - `campaigns.status IN ('active', 'approved')`
   - `ads.media_asset_id IS NOT NULL`
   - Format match if zone is not responsive
   - Limit 50 rows
6. `fundedOrganizationIds()` (`src/lib/billing-charge.server.ts:79-94`) filters out campaigns whose advertiser wallet has `balance_amount <= 0`. On DB failure, it falls back to serving all (delivery over pacing).
7. `selectAd(fundedCandidates, zone, { now, signals })` (`src/lib/ad-serving-domain.ts:194-209`) runs demand-side eligibility (`candidateIsEligible`, line 133), scores each candidate (`scoreCandidate`, line 176), sorts by score descending, and breaks ties by `adId.localeCompare`.
8. `creativeUrl(winner.mediaAssetId)` (`src/lib/ad-serving.server.ts:185-228`) fetches the media asset from Supabase Storage, generates a signed URL with 30-minute TTL, and caches it in `CREATIVE_CACHE`.
9. `issueServedToken()` (`src/lib/ad-token.server.ts:43-50`) creates an HMAC-signed JWT-like token containing `requestId`, `adId`, `campaignId`, `publisherId`, `websiteId`, `zoneId`, device/browser/os/country, and expiry (6 hours).
10. `serveAd()` returns `{ ok: true, requestId, token, ad: { format, width, height, imageUrl, alt, clickUrl } }`. The `clickUrl` is empty here; the route fills it in with the token (`src/routes/api/public/ad.ts:95`).
11. The SDK renders the ad, then fires an impression beacon via `navigator.sendBeacon` or `fetch` with `keepalive: true` to `POST /api/public/impression` with body `{ token }` (`src/lib/ad-sdk-source.ts:42-58`).
12. The impression endpoint verifies the HMAC token, extracts the payload, and calls `recordImpression(payload, ipAddress, userAgent, botScore, isLikelyBot)` (`src/lib/ad-serving.server.ts:358-461`).
13. `recordImpression()` inserts the impression row, runs `evaluateImpressionFraud()` **before** billing, and if fraud status is `"blocked"` or `isLikelyBot === true`, it skips `chargeAdEvent()` and flags `is_likely_bot = true` (`src/lib/ad-serving.server.ts:415-458`). Otherwise it calls `chargeAdEvent()`.
14. `chargeAdEvent()` (`src/lib/billing-charge.server.ts:29-73`) invokes the `charge_campaign_event` RPC. The RPC performs all validation and spend atomically, returning `{ ok, reason, amount, publisher_amount, platform_amount }`. On `budget_exhausted` or `insufficient_funds`, the caller pauses the campaign (`src/lib/billing-charge.server.ts:64-70`).
15. On click, the SDK calls `GET /api/public/click?t=<token>`. The click endpoint verifies the token, confirms an impression exists, inserts a click row, runs `evaluateClickFraud()` before billing, and calls `chargeAdEvent()` for clicks if not blocked (`src/lib/ad-serving.server.ts:478-570`).

## Timeout and Fallback (Current Behavior)

`serveAd()` is wrapped in a 200ms `Promise.race` timeout (`src/lib/ad-serving.server.ts:258-355`). The inner `serveAdInner()` does the actual work. If it times out or throws, the outer `serveAd()` catches the error and attempts to serve a house ad from the `house_ads` table (`src/lib/ad-serving.server.ts:365-393`). House ads are never billed (`chargeAdEvent` is never called for them) and are logged with `fill_type: 'house_ad'`. If no house ad exists, the response is `{ ok: false, reason: "serve_timeout" }`.

## Tech Stack Summary

- Runtime: Cloudflare Workers / Nitro
- Framework: TanStack Router, React
- Database: Supabase (Postgres) with PostgREST
- Auth: Supabase Auth + custom `api-authorization.server.ts`
- Storage: Supabase Storage for creatives
- Optional: Redis (for blocked IPs, impression buffer)
