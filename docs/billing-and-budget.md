# Billing and Budget

What this covers: how TradeMall charges advertisers for impressions and clicks, the atomic guarantees of the billing RPC, revenue split logic, idempotency, and every return reason the RPC can produce. Who should read this: billing engineers, finance, and anyone debugging spend discrepancies.

## The charge_campaign_event RPC

All billable events flow through a single PostgreSQL function: `public.charge_campaign_event`. Its full definition is in `supabase/migrations/20260825200000_fix_charge_campaign_event_rpc.sql`. The caller is `chargeAdEvent()` in `src/lib/billing-charge.server.ts:29-73`.

### Checks in Order

The RPC executes these checks sequentially inside a single PL/pgSQL transaction:

1. **Validate event type** (`_event_type IN ('impression', 'click')`) — line 48. Rejects anything else as `invalid_request`.
2. **Load platform settings** (`SELECT * FROM platform_settings WHERE id LIMIT 1`) — line 59. Used for revenue share and earnings hold days.
3. **Idempotency check** (`EXISTS (SELECT 1 FROM campaign_spend WHERE request_id = _request_id AND event_type = _event_type)`) — line 62. Returns `duplicate` if the same request_id + event_type was already billed.
4. **Lock campaign row** (`SELECT * INTO _campaign FROM campaigns WHERE id = _campaign_id FOR UPDATE`) — line 76. Acquires a row-level exclusive lock on the campaign.
5. **Campaign status check** (`_campaign.status IN ('active','approved') AND approval_status = 'approved'`) — line 92. Returns `campaign_inactive` if not.
6. **Total budget exhaustion** (`COALESCE(spent_amount, 0) >= COALESCE(total_budget, 0)`) — line 103. Returns `budget_exhausted`.
7. **Calculate event cost** — line 114:
   - CPC click: `_event_cost = _campaign.bid_amount`
   - CPM impression: `_event_cost = _campaign.bid_amount / 1000.0`
   - Otherwise: `not_billable`
8. **Round and validate cost** (`round(_event_cost, 6)`, reject if `<= 0`) — line 128.
9. **Pre-increment budget check** (`spent_amount + _event_cost > total_budget`) — line 140. Returns `budget_exhausted` if this event would push the campaign over its total budget.
10. **Daily budget advisory lock** (`PERFORM pg_advisory_xact_lock(hashtext(_campaign_id::text || _today::text))`) — line 150. Serializes all concurrent requests for the same campaign on the same UTC day, preventing the "first event of day" race condition.
11. **Lock wallet row** (`SELECT * INTO _wallet FROM wallets WHERE organization_id = _campaign.organization_id FOR UPDATE`) — line 169. Acquires row-level exclusive lock on the advertiser's wallet.
12. **Sufficient funds check** (`COALESCE(balance_amount, 0) < _event_cost`) — line 185. Returns `insufficient_funds`.
13. **Revenue split calculation** — line 195:
    - `_revenue_share = COALESCE(_settings.publisher_revenue_share, 0.7)`
    - If `_revenue_share > 1`, divide by 100 (percentage vs decimal)
    - `_publisher_share = round(_event_cost × _revenue_share, 6)`
    - `_platform_share = round(_event_cost - _publisher_share, 6)`
14. **Insert billing event** into `campaign_spend` — line 203.
15. **Update campaign** (`spent_amount += _event_cost`, `impressions_count`/`clicks_count` incremented) — line 237.
16. **Update wallet** (`balance_amount -= _event_cost`, `lifetime_spent += _event_cost`) — line 245.
17. **Insert wallet transaction** into `wallet_transactions` — line 252.
18. **Insert publisher earnings** into `publisher_earnings` with `status = 'pending'` and `available_at = now() + earnings_hold_days` — line 279.
19. **Update daily stats** (`INSERT ... ON CONFLICT DO UPDATE` on `campaign_daily_stats`) — line 312. Tracks spend per campaign per UTC date for pacing.
20. **Return success** — line 339.

### Atomicity Guarantees

The RPC uses two locking mechanisms:

| Lock | Scope | What it prevents |
|---|---|---|
| `FOR UPDATE` on `campaigns` row | Transaction-scoped | Two concurrent requests reading the same `spent_amount` before either writes it. Serializes total-budget checks per campaign. |
| `FOR UPDATE` on `wallets` row | Transaction-scoped | Two concurrent requests reading the same `balance_amount` before either debits it. Prevents wallet overdraft. |
| `pg_advisory_xact_lock(hashtext(campaign_id::text \|\| today::text))` | Transaction-scoped (released at COMMIT/ROLLBACK) | Serializes the daily budget check across all concurrent requests for the same campaign on the same UTC day, even when no `campaign_daily_stats` row exists yet. This closes the "first event of day" race window. |

**What is prevented:**
- Two requests both reading `spent_amount = 0` and both charging: **impossible** because the first transaction holds the campaign lock until it commits, so the second transaction reads the updated `spent_amount`.
- Two requests both inserting `campaign_daily_stats` for the same campaign/date and exceeding `daily_budget`: **impossible** because the advisory lock serializes them.
- Wallet overdraft: **impossible** because the wallet row lock prevents concurrent debit reads.

## Revenue Split

The split between publisher and platform comes from `platform_settings.publisher_revenue_share` (`supabase/migrations/20260825200000_fix_charge_campaign_event_rpc.sql:195-201`). Default is `0.7` (70% publisher, 30% platform). If the value is stored as a percentage (`> 1`), it is divided by 100 before use.

Publishers do not receive their share immediately. Earnings are inserted into `publisher_earnings` with `status = 'pending'` and `available_at = now() + COALESCE(earnings_hold_days, 0)` (line 308). A separate payout flow handles actual transfers.

## Idempotency

The RPC checks for an existing `(request_id, event_type)` pair in `campaign_spend` before charging (line 62). If found, it returns `duplicate` and does not insert or update anything.

The caller (`chargeAdEvent`) does not retry on `duplicate` — it passes the result through as `ok: false, reason: "duplicate"`.

## Caller Behavior on Failure

`chargeAdEvent()` (`src/lib/billing-charge.server.ts:64-70`) pauses the campaign on two reasons:

| RPC reason | Caller action |
|---|---|
| `insufficient_funds` | Set `campaigns.status = 'paused'`, `pause_reason = 'insufficient_funds'` |
| `budget_exhausted` | Set `campaigns.status = 'paused'`, `pause_reason = 'budget_exhausted'` |
| `daily_budget_exhausted` | No automatic pause (campaign stays active but cannot bill today) |
| Any other `ok: false` | No status change |

## Return Reasons Reference

| Reason | Meaning | Caller action |
|---|---|---|
| `charged` | Event billed successfully | Continue serving |
| `duplicate` | Same request_id + event_type already billed | Ignore (idempotent) |
| `budget_exhausted` | Total budget reached or this event would exceed it | Pause campaign |
| `daily_budget_exhausted` | Daily pacing limit reached | Skip billing for this event |
| `insufficient_funds` | Wallet balance too low | Pause campaign |
| `campaign_inactive` | Campaign not approved or not active | Stop serving campaign |
| `not_billable` | Event type doesn't match bid type (e.g., impression on CPC campaign) | Skip billing |
| `invalid_request` | Event type not 'impression' or 'click' | Log error |
| `unknown_campaign` | Campaign ID not found | Stop serving |
| `no_wallet` | Advertiser has no wallet | Stop serving |
