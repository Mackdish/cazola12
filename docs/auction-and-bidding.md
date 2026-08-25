# Auction and Bidding

What this covers: how TradeMall selects which ad wins an auction, what filters are applied, how bids are scored, and what happens on ties. Who should read this: ad ops, billing engineers, and anyone debugging why a campaign is or isn't serving.

## Auction Model

TradeMall uses a **first-price, score-based selection** model. There is no real-time bid exchange between advertisers. Instead, each advertiser sets a fixed bid (`bid_amount`) and bid type (`bid_type`: `cpm` or `cpc`) when creating a campaign. The server pre-filters eligible campaigns, scores them, and the highest scorer wins. The winner pays its own bid amount; there is no second-price discount.

## Scoring Formula

The scoring function is `scoreCandidate()` in `src/lib/ad-serving-domain.ts:176-183`:

```
score = impression_value × priority_weight × pacing_weight × format_weight
```

Where:

| Term | Formula | Explanation |
|---|---|---|
| `impression_value` | `bidAmount / 1000` if CPM; `bidAmount × 0.01` if CPC | Puts CPC and CPM bids on the same per-impression scale. The 0.01 assumed CTR is defined as `ASSUMED_CTR` at `src/lib/ad-serving-domain.ts:157`. |
| `priority_weight` | `min(10, max(1, priority)) / 5` | Campaign priority (1-10, default 5) scales the score. Priority 5 = neutral weight of 1.0. |
| `pacing_weight` | `0.5 + 0.5 × min(1, remainingBudget / totalBudget)` | Campaigns with full budget remaining score 1.0. As budget depletes, the weight drops to 0.5, de-pacing nearly-spent campaigns. |
| `format_weight` | `1.0` if exact format match; `0.85` if responsive fallback | Exact-size matches outrank responsive ads. |

## Eligibility Filters (Applied Before Scoring)

`candidateIsEligible()` in `src/lib/ad-serving-domain.ts:133-152` applies these checks **in order** before a candidate enters the auction:

1. `campaignApproval === 'approved'`
2. `campaignStatus === 'active' || campaignStatus === 'approved'`
3. `bidAmount > 0` (enforced since the minimum bid fix)
4. `startDate` not in the future (UTC date comparison)
5. `endDate` not in the past (UTC date comparison)
6. `remainingBudget > 0` (total budget gate)
7. `adApproval === 'approved'`
8. `adStatus === 'active'`
9. `mediaAssetId` present (creative exists)
10. Format match (`formatMatches()` at `src/lib/ad-serving-domain.ts:36-38`)
11. Targeting match (`targetingMatches()` from `src/lib/advertiser-domain.ts`)

If any check fails, the candidate is excluded with a specific `IneligibleReason` (e.g., `campaign_not_approved`, `budget_exhausted`, `format_mismatch`). These reasons are used for diagnostics in `src/lib/ad-diagnostics.server.ts`.

## Floor Price / Minimum Bid

There is no explicit floor price configured per zone. The only floor enforcement is `candidate.bidAmount > 0` in `candidateIsEligible()` (`src/lib/ad-serving-domain.ts:139`). A campaign with `bid_amount = 0` or `null` is excluded from the auction entirely. The `charge_campaign_event` RPC also rejects zero-cost events (`supabase/migrations/20260825200000_fix_charge_campaign_event_rpc.sql:128-137`).

## Tie-Break Behavior

When two candidates have identical scores, `selectAd()` breaks ties by `adId.localeCompare` (`src/lib/ad-serving-domain.ts:203`):

```typescript
.sort((a, b) => b.score - a.score || a.candidate.adId.localeCompare(b.candidate.adId));
```

This is deterministic: the lexicographically smaller `adId` always wins. There is no randomness.

## Worked Example

Assume a 300x250 zone with the following three campaigns:

| Campaign | bid_type | bid_amount | total_budget | spent_amount | priority | status | approval_status |
|---|---|---|---|---|---|---|---|
| A | cpm | 100 | 1000 | 200 | 5 | active | approved |
| B | cpc | 10 | 500 | 0 | 8 | active | approved |
| C | cpm | 200 | 2000 | 1900 | 3 | active | approved |

**Step 1 — impression_value:**
- A: 100 / 1000 = 0.1
- B: 10 × 0.01 = 0.1
- C: 200 / 1000 = 0.2

**Step 2 — priority_weight:**
- A: min(10, max(1, 5)) / 5 = 1.0
- B: min(10, max(1, 8)) / 5 = 1.6
- C: min(10, max(1, 3)) / 5 = 0.6

**Step 3 — pacing_weight:**
- A: remaining = 800, total = 1000 → 0.5 + 0.5 × 0.8 = 0.9
- B: remaining = 500, total = 500 → 0.5 + 0.5 × 1.0 = 1.0
- C: remaining = 100, total = 2000 → 0.5 + 0.5 × 0.05 = 0.525

**Step 4 — format_weight:**
- All exact match → 1.0

**Step 5 — final scores:**
- A: 0.1 × 1.0 × 0.9 × 1.0 = **0.09**
- B: 0.1 × 1.6 × 1.0 × 1.0 = **0.16**
- C: 0.2 × 0.6 × 0.525 × 1.0 = **0.063**

**Winner: Campaign B** (score 0.16), despite having a lower raw bid than C, because its high priority and full budget pacing outweigh C's higher bid.
