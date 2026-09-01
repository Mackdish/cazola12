# Campaign Lifecycle

What this covers: every status a campaign or ad can be in, who can change it, what the change does to serving eligibility, and the exact database transitions. Who should read this: ad ops, platform admins, and engineers debugging why a campaign is not serving.

## Campaign Status Values

Defined in `src/lib/advertiser-domain.ts` as the `CampaignStatus` type. The valid values and their meaning:

| Status | Meaning | Can serve? |
|---|---|---|
| `draft` | Advertiser is building the campaign, not yet submitted | No |
| `pending_review` | Submitted, waiting for admin approval | No |
| `approved` | Admin approved, but advertiser has not activated yet | Yes — `loadCandidates` includes `campaigns.status IN ('active', 'approved')` (`src/lib/ad-serving.server.ts:124`) |
| `active` | Running and billing | Yes |
| `paused` | Temporarily stopped by admin or advertiser | No — excluded from `loadCandidates` because `'paused'` is not in `['active', 'approved']` |
| `rejected` | Admin rejected | No |
| `completed` | Finished or manually completed | No |

## Ad Status Values

| Status | Meaning | Can serve? |
|---|---|---|
| `pending` | Created but not submitted/approved | No |
| `active` | Approved and active | Yes |
| `suspended` | Rejected or paused | No |

## Approval Fields

There are two independent approval-related fields:

- `campaigns.approval_status`: `"pending"` | `"approved"` | `"rejected"`
- `campaigns.status`: the lifecycle state above
- `ads.approval_status`: `"pending"` | `"approved"` | `"rejected"`
- `ads.status`: `"active"` | `"suspended"` | `"pending"`

**Important:** `approval_status` and `status` are separate. A campaign can have `approval_status = 'approved'` but `status = 'draft'` if the advertiser never activated it. In that case, `loadCandidates` does **not** include it because the query filters on `campaigns.status IN ('active', 'approved')`.

## State Transition Diagram

The allowed transitions are defined in `CAMPAIGN_TRANSITIONS` at `src/lib/advertiser-domain.ts:64-96`:

```
draft → pending_review (advertiser)
pending_review → approved (admin)
pending_review → rejected (admin)
pending_review → draft (advertiser)
approved → active (advertiser)
approved → active (admin)
approved → paused (admin)
approved → rejected (admin)
active → paused (advertiser)
active → paused (admin)
active → completed (advertiser)
active → completed (admin)
active → rejected (admin)
paused → active (advertiser)
paused → active (admin)
paused → completed (advertiser)
paused → completed (admin)
paused → rejected (admin)
completed → (no outgoing transitions)
rejected → draft (advertiser)
```

`assertTransition()` (`src/lib/advertiser-domain.ts:110-116`) enforces this graph before any update executes.

## Admin Approval Action

When an admin approves a campaign via `adminReviewCampaign()` (`src/lib/advertiser-service.server.ts:794-872`):

1. The function validates the transition via `assertTransition()` (line 821).
2. It sets `campaigns.status = 'approved'` and `campaigns.approval_status = 'approved'` in a single UPDATE (lines 830-836).
3. It also sets `ads.status = 'active'` and `ads.approval_status = 'approved'` for all ads in the campaign (lines 857-869).

**There is no separate "activate" step required.** Approval and activation happen atomically in one database call.

## Approval → Live Serving Guarantee

`loadCandidates()` queries the database directly on every request (`src/lib/ad-serving.server.ts:115-125`). There is no candidate cache, no Redis layer, and no CDN edge cache between approval and serving. The query filters on:

```typescript
.eq("status", "active")                     // ad status
.eq("approval_status", "approved")          // ad approval
.eq("campaigns.approval_status", "approved") // campaign approval
.in("campaigns.status", ["active", "approved"]) // campaign status
```

These are the exact same values the admin approval action sets. The moment the UPDATE commits, the next `serveAd()` call will include the campaign in its candidate pool. **Latency from approval to first eligible auction is bounded only by the next ad request — typically milliseconds.**

## Rejection / Pause Takes Effect Immediately

The same query logic applies in reverse:

- **Rejection:** `campaigns.approval_status` becomes `'rejected'` and `campaigns.status` becomes `'rejected'`. The `loadCandidates` filter `campaigns.approval_status = 'approved'` immediately excludes the campaign.
- **Pause:** `campaigns.status` becomes `'paused'`. The `loadCandidates` filter `campaigns.status IN ('active', 'approved')` immediately excludes it.

A paused or rejected campaign cannot win an auction, so it cannot generate billable events. The billing RPC also rejects non-active/approved campaigns as a safety net.

## Wallet Check on Activation

When a campaign transitions to `active` (including approval-to-active), `assertWalletCanFundCampaign()` is called (`src/lib/advertiser-service.server.ts:826-828`). This checks that the advertiser's wallet has a positive balance. If not, the transition is rejected.

## Audit Trail

Every approval, rejection, pause, and completion is logged via `logAuditEvent()` (`src/lib/advertiser-service.server.ts:848-855`). The log records `action`, `targetType`, `targetId`, `targetLabel`, and `metadata` containing `fromStatus`, `toStatus`, and `reason`.
