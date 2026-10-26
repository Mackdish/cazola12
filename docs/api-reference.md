# API Reference

What this covers: every public-facing endpoint in the TradeMall ad serving stack, with exact paths, methods, auth requirements, request/response shapes, and error codes pulled from the actual route handlers. Who should read this: SDK integrators, publisher developers, and ad ops engineers testing the serving flow.

## Public Endpoints (No Auth Required)

### GET /api/public/ad

**File:** `src/routes/api/public/ad.ts:39-101`

Serves an ad for a given zone. Called by the publisher SDK.

**Query parameters:**

| Param | Required | Type | Validation |
|---|---|---|---|
| `zone` | Yes | string | 4-64 chars, `^[A-Za-z0-9_-]+$` |
| `country` | No | string | 1-80 chars, optional |
| `county` | No | string | optional |
| `city` | No | string | optional |

**Request headers used:**
- `user-agent` — passed to `classifyUserAgent()` for device/OS/browser targeting
- `cf-ipcountry` — Cloudflare country code, used for geo-targeting
- `cf-bot-management-score` — Cloudflare bot score, used for fraud detection

**Success response (200):**

```json
{
  "ok": true,
  "requestId": "uuid",
  "ad": {
    "ad_id": "uuid",
    "campaign_id": "uuid",
    "creative_url": "https://...",
    "format": "300x250",
    "width": 300,
    "height": 250,
    "click_url": "https://trademall.co.ke/api/public/click?t=<token>"
  },
  "impressionUrl": "https://trademall.co.ke/api/public/impression",
  "token": "<hmac-signed-token>"
}
```

**Error response (200 or 429):**

```json
{
  "ok": false,
  "reason": "invalid_zone | rate_limited | unknown_zone | zone_unavailable | no_ad | blocked_ip | serve_timeout"
}
```

Note: serving errors return HTTP 200 with `ok: false` so the SDK can distinguish "no ad" from network failure. Rate limit errors return HTTP 429 with `Retry-After: 60`.

---

### POST /api/public/impression

**File:** `src/routes/api/public/impression.ts`

Records an impression beacon. Called by the SDK via `navigator.sendBeacon` or `fetch` with `keepalive: true`.

**Query parameters:**

| Param | Required | Type |
|---|---|---|
| `request_id` | Yes | UUID |

**Request body:**

```json
{
  "token": "<hmac-signed-token>"
}
```

**Response (200):**

```json
{ "ok": true }
```

**Error responses:**

| Status | Body | Meaning |
|---|---|---|
| 400 | `{ "ok": false, "error": "invalid_request" }` | Missing or invalid `request_id` |
| 401 | `{ "ok": false, "error": "invalid_token" }` | HMAC token verification failed |
| 404 | `{ "ok": false, "error": "not_found" }` | Ad zone or impression not found |
| 429 | `{ "ok": false, "error": "rate_limited" }` | Rate limit exceeded |

The server verifies the HMAC token (`verifyServedToken()` in `src/lib/ad-token.server.ts:52-72`), extracts the payload, and calls `recordImpression()` (`src/lib/ad-serving.server.ts:358-461`).

---

### GET /api/public/click

**File:** `src/routes/api/public/click.ts`

Records a click and redirects to the destination URL. Called when the user clicks the ad.

**Query parameters:**

| Param | Required | Type |
|---|---|---|
| `t` | Yes | string | HMAC-signed token |

**Response:** 302 redirect to the ad's `destination_url` after recording the click.

**Error responses:** Same as impression endpoint.

The server verifies the token, confirms an impression exists for the `request_id`, inserts a click row, runs fraud evaluation, and calls `chargeAdEvent()` for clicks if not blocked.

---

## Authenticated Endpoints (Require API Key)

### GET /api/v1/ads/serve

**File:** `src/routes/api/v1/ads/serve.ts`

Authenticated ad serving endpoint for v1 API clients. Requires `x-api-key` header.

**Query parameters:** Same as `/api/public/ad` plus `website_id` (UUID).

**Response:** Same shape as `/api/public/ad`.

---

### POST /api/v1/events/impression

**File:** `src/routes/api/v1/events/impression.ts`

Records an impression for an ad this server served. The signed `token` must match `request_id`; every field of the event is read from it, so events cannot be forged with an arbitrary `ad_id`/`zone_id`.

**Query parameters:** `request_id` (UUID).

**Request body:**

```json
{ "token": "signed token from the serve response (ad.token)" }
```

**Response (200):** `{ "ok": true }`

---

### POST /api/v1/events/click

**File:** `src/routes/api/v1/events/click.ts`

Records a click for an ad this server served (same signed `token` rule as impressions) and returns the destination.

**Query parameters:** `request_id` (UUID).

**Request body:**

```json
{ "token": "signed token from the serve response (ad.token)" }
```

**Response (200):** `{ "ok": true }`

---

## Admin Endpoints (Require Platform Admin Role)

### Campaign Review

**File:** `src/lib/advertiser-service.server.ts:794-872`

Triggered via the admin dashboard UI (no public API route file found in the repo; accessed through the authenticated TanStack Router admin routes).

**Input:**

```json
{
  "campaignId": "uuid",
  "action": "approve" | "reject" | "pause" | "reactivate" | "complete",
  "reason": "string (required for reject)"
}
```

**Effect on approval:**
- `approve`: sets `campaigns.status = 'approved'`, `campaigns.approval_status = 'approved'`, and all `ads.status = 'active'`, `ads.approval_status = 'approved'`.
- `reject`: sets `campaigns.status = 'rejected'`, `campaigns.approval_status = 'rejected'`, `ads.status = 'suspended'`, `ads.approval_status = 'rejected'`.
- `pause`: sets `campaigns.status = 'paused'`.
- `reactivate`: sets `campaigns.status = 'active'` (after wallet check).
- `complete`: sets `campaigns.status = 'completed'`.

## HMAC Token Format

Tokens are issued by `issueServedToken()` (`src/lib/ad-token.server.ts:43-50`) and verified by `verifyServedToken()` (`src/lib/ad-token.server.ts:52-72`).

**Format:** `<base64url(payload)>.<base64url(hmac_sha256(payload))>`

**Payload fields:**
- `rid`: request ID (UUID)
- `adId`: ad UUID
- `campaignId`: campaign UUID
- `publisherId`: publisher UUID
- `websiteId`: website UUID
- `zoneId`: zone UUID
- `device`: device type string
- `browser`: browser type string
- `os`: OS type string
- `country`: 2-letter country code or null
- `exp`: expiry as Unix epoch seconds (6 hours from issue)

**Validation rules:**
- Token length <= 2048
- Signature must match using `AD_TOKEN_SECRET` env var (minimum 32 chars)
- `rid`, `adId`, and `exp` must be present
- `exp` must be in the future
