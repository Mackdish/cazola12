# Known Limitations and Roadmap

What this covers: what is **not** yet built or is **not** fully resolved in the current TradeMall ad server, why each gap matters, and what the path forward looks like. Who should read this: engineers onboarding to the codebase, SREs planning capacity, and product managers prioritizing work.

## Current Limitations (Not Yet Built)

### 1. No Nightly Reconciliation Job

**What is missing:** There is no batch process that compares `campaign_spend` sums to `campaigns.spent_amount`, or reconciles `publisher_earnings` against `wallet_transactions`.

**What breaks without it:** Financial discrepancies accumulate silently. If the `charge_campaign_event` RPC ever has a bug, or if Redis-buffered impressions are flushed out-of-order, the database's `spent_amount` can diverge from actual billed events. Advertiser dashboards show incorrect remaining budgets. Publishers may be underpaid or overpaid.

**Current mitigation:** The atomic RPC and idempotency checks make drift unlikely, but not impossible. The scheduled handler (`src/server.ts:109-152`) runs buffer flush, fraud purge, and blocklist sync — but no reconciliation.

**Roadmap:** Add a nightly job at e.g., 4 AM UTC that:
1. Groups `campaign_spend` by `campaign_id`, sums `amount`, compares to `campaigns.spent_amount`.
2. Groups `publisher_earnings` by `publisher_id`, sums `publisher_amount`, compares to `wallet_transactions` for `type = 'spend'`.
3. Alerts on discrepancies > 0.01%.

---

### 2. No Distributed Creative Cache

**What is missing:** `CREATIVE_CACHE` is an in-memory `Map` in `src/lib/ad-serving.server.ts:48-62`. Each Cloudflare Worker instance has its own isolated memory.

**What breaks without it:** Cold-start penalty on every instance for every creative. Under scale with many instances and many creatives, this adds proportional DB/storage load. There is also no cache invalidation when an advertiser updates a creative; the old URL remains cached for up to 60 seconds.

**Roadmap:** Migrate to Redis or Cloudflare KV, keyed by `mediaAssetId`, with 30-60s TTL. Add a cache-bust on ad/media-asset update.

---

### 3. No Real-Time Monitoring or Alerting

**What is missing:** The codebase uses `console.debug`, `console.warn`, and `console.error` exclusively. There is no metrics collection, no latency histograms, no win-rate tracking, and no alerting.

**What breaks without it:** A fail-open bug (e.g., `charge_campaign_event` failing silently but impressions still being recorded) would go undetected for hours or days. No alert fires on budget overspend, latency spikes, error rate increases, or empty fill rates.

**Roadmap:** Instrument `serveAd()`, `recordImpression()`, and `recordClick()` with structured metrics:
- Request latency (p50, p99)
- `charge_campaign_event` error rate
- Impression buffer backlog depth
- `spent_amount` drift rate
- Fill rate (house ads vs real ads)

Alert thresholds:
- `charge_campaign_event` error rate > 1%
- Impression buffer backlog > 10,000
- Ad serve latency p99 > 500ms
- Fill rate drops below 80% for 5 minutes

---

### 4. No Bidding / Real-Time Auction

**What is missing:** The current system uses a pre-configured fixed bid per campaign (`bid_amount`). There is no real-time bidding exchange, no bid request/response protocol, and no programmatic advertiser integration.

**What breaks without it:** Cannot support programmatic advertising or dynamic pricing. All advertisers must set bids manually in the dashboard.

**Roadmap:** Replace `selectAd()` with a real auction endpoint that accepts bid requests and returns bid responses. The eligibility gate (`candidateIsEligible`) and targeting logic can be reused; only the selection layer changes.

---

### 5. No Redis-Buffered Spend Batching

**What is missing:** Every `chargeAdEvent()` call hits the `charge_campaign_event` RPC synchronously, acquiring row locks on the campaign and wallet. For high-traffic campaigns (100+ req/s), this serializes all billing on a single row lock.

**What breaks without it:** Billing latency increases linearly with contention. At sufficient scale, this becomes a bottleneck.

**Roadmap:** Buffer spend events in Redis per campaign, flush to the RPC in batches every 100ms-1s. This amortizes lock cost across multiple events but introduces eventual consistency on `spent_amount`.

---

### 6. No Creative Sanitization Layer

**What is missing:** Advertiser-supplied text fields (`adName`, etc.) are not sanitized before being served to publisher pages. The current server response only includes image URLs and alphanumeric IDs, which is safe, but any future field addition risks XSS.

**What breaks without it:** If a future feature allows advertisers to set HTML-enabled text fields (e.g., ad descriptions), a malicious advertiser could inject JavaScript that executes in the publisher's page context.

**Roadmap:** Sanitize all text fields server-side before inserting into the SDK payload. Use a strict allowlist for ad metadata exposed to the browser.

---

### 7. No Cross-Organization Access Control Middleware

**What is missing:** Authorization relies on application-level checks (`assertAdvertiserAccess()`, `assertPublisherAccess()` in `src/lib/api-authorization.server.ts`). Any new route that forgets to call these helpers will expose cross-organization data.

**What breaks without it:** A developer adding a new campaign API endpoint without calling `assertAdvertiserAccess()` would allow any authenticated user to read/modify any organization's campaigns by UUID manipulation.

**Roadmap:** Add a middleware/linter rule that enforces authorization checks on all authenticated routes. Consider enabling RLS on the `supabaseAdmin` client for advertiser/publisher data so the database enforces isolation as a safety net.

---

## Honest Assessment of Production Readiness

**The core serving and billing paths are now correct and tested for the critical race conditions.** The atomic RPC, daily advisory lock, fraud-before-billing gating, timeout/fallback, and minimum bid enforcement are all in place.

**The system is NOT ready for high-volume production traffic until:**

1. The daily-budget-race and fraud-blocking tests pass against the live Supabase database (they are written but require `SUPABASE_SERVICE_ROLE_KEY` to run).
2. The house ad fallback is validated under real timeout conditions in the Cloudflare Workers runtime.
3. A monitoring/alerting stack is in place to catch fail-open or latency regressions.
4. A reconciliation job is implemented to detect financial drift.

**The highest-priority remaining work is:**
1. Verify Fix 1 and Fix 2 with the Supabase-dependent tests.
2. Add monitoring.
3. Implement reconciliation.
