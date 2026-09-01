# Fraud and Trust

What this covers: what signals TradeMall evaluates to detect invalid traffic, when those signals run relative to billing, and what happens for each severity level. Who should read this: trust and safety engineers, billing engineers, and anyone tuning bot thresholds.

## Fraud Signals

Fraud detection runs in two functions: `evaluateImpressionFraud()` (`src/lib/fraud-detection.server.ts:125-200`) and `evaluateClickFraud()` (`src/lib/fraud-detection.server.ts:28-123`). Both evaluate the same signal categories against a 60-second sliding window (impressions/clicks) and a 24-hour IP history window.

### Signal Types and Thresholds

| Signal | Trigger condition | Severity | Score |
|---|---|---|---|
| `excessive_impressions` | >100 impressions from same IP+campaign+publisher in 60s | `suspicious` | `min(1, count / 1000)` |
| `excessive_impressions` (blocked) | >500 impressions in 60s | `blocked` | Same formula, severity elevated |
| `rapid_clicks` | >10 clicks in 60s | `suspicious` | `min(1, count / 50)` |
| `rapid_clicks` (blocked) | >30 clicks in 60s | `blocked` | Same formula, severity elevated |
| `abnormal_ctr` | clicks / impressions > 0.5 in 60s | `review_required` | 0.7 |
| `ip_repeat_offender` | >3 fraud events in 24h with avg score > 0.5 | `blocked` | 0.9 |
| `suspicious_user_agent` | UA contains "bot", "crawler", "spider", "headless", or "phantom" | `blocked` | 0.95 |

### Overall Status Determination

At `src/lib/fraud-detection.server.ts:116-120`:

```typescript
if (signals.some((s) => s.severity === "blocked")) status = "blocked";
else if (signals.some((s) => s.severity === "review_required")) status = "review_required";
else if (signals.some((s) => s.severity === "suspicious")) status = "suspicious";
else status = "normal";
```

A single `blocked` signal overrides all others.

## When Fraud Evaluation Runs Relative to Billing

**Current behavior (as of the latest code):**

- **Impressions:** `recordImpression()` inserts the impression row first (`src/lib/ad-serving.server.ts:397-413`), then runs `evaluateImpressionFraud()` (`src/lib/ad-serving.server.ts:415-438`), then checks `shouldBlockBilling` (`src/lib/ad-serving.server.ts:441-458`). If `evaluation.status === "blocked"` or `isLikelyBot === true`, it updates the impression row to set `is_likely_bot = true` and **skips `chargeAdEvent()` entirely**.
- **Clicks:** `recordClick()` inserts the click row first (`src/lib/ad-serving.server.ts:502-515`), then runs `evaluateClickFraud()` (`src/lib/ad-serving.server.ts:522-546`), then checks `shouldBlockClickBilling` (`src/lib/ad-serving.server.ts:548-566`). If blocked, it updates the click row to `is_likely_bot = true` and **skips billing**.

**This means fraud evaluation now gates billing.** A `blocked` evaluation prevents the `charge_campaign_event` RPC from being called. The event is still recorded (for audit/future analysis) but not billed.

### Bot Score Threshold

Cloudflare Bot Management scores arrive via the `cf-bot-management-score` header. `extractGeoAndBotScore()` in `src/lib/rate-limit.server.ts:102-116` sets `isLikelyBot = true` when the score is `<= 30` (raised from the original `<= 10`). This is a secondary signal layered on top of fraud evaluation. A request with `bot_score = 25` is flagged as `isLikelyBot` and billing is skipped even if fraud evaluation returns `normal`.

## Behavior per Status

| Fraud status | Impression recorded? | Click recorded? | Billing called? | Post-recording action |
|---|---|---|---|---|
| `blocked` | Yes | Yes | **No** | `is_likely_bot` set to `true`; fraud event logged via `recordFraudEvent()` |
| `suspicious` | Yes | Yes | Yes | Billing proceeds; fraud event logged |
| `review_required` | Yes | Yes | Yes | Billing proceeds; fraud event logged |
| `normal` | Yes | Yes | Yes | No fraud event logged |

## What Is Not Yet Built

- No real-time blocking at the `serveAd()` level. A known bad IP can still win an auction and have its impression recorded; the block happens at billing time, not at serving time.
- No machine-learning-based scoring. All signals are rule-based with hard-coded thresholds.
- No advertiser-facing fraud dashboard.

## Tuning Thresholds

If traffic data shows the current thresholds are too aggressive or too permissive, adjust them in:

- `src/lib/fraud-detection.server.ts` — lines 66-73 (click thresholds), 156-163 (impression thresholds), 91-97 (IP repeat offender), 108-113 (UA patterns).
- `src/lib/rate-limit.server.ts` — line 113 (bot score threshold).

Changes to these files take effect on deploy; there is no database-configured threshold layer yet.
