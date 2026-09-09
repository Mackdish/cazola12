# TradeMall AI Copilot

TradeMall AI Copilot is implemented directly in the application. It does not depend on n8n.

## Configuration

Set these server-side environment variables:

- `GEMINI_API_KEY` — Google Gemini API key.
- `GEMINI_MODEL` — optional model override. Defaults to `gemini-3.7-flash`.

Never prefix these variables with `VITE_` and never send the Gemini key to the browser.

## Capabilities

### Campaign Copilot
Scans an advertiser website, loads the current TradeMall publisher inventory, and produces a structured campaign plan containing objective, bidding, budget, audience, targeting, publisher recommendations, creative direction and copy.

### Website Audit
Analyzes the supplied landing page and returns a campaign-readiness score, strengths, issues, opportunities and recommended CTA/objective.

### Creative Analyzer
Analyzes an uploaded image creative using Gemini vision and scores product visibility, text readability, branding and mobile suitability.

### Campaign Optimizer
Uses TradeMall campaign analytics and ad metadata to produce advisory optimization recommendations. AI recommendations are never executed automatically.

## Security model

- All AI operations require authenticated advertiser organization membership.
- Website fetching uses the existing SSRF-safe fetcher.
- Gemini is called server-side only.
- Publisher and creative IDs returned by Gemini are validated against TradeMall data before being surfaced.
- Financial values are bounded by application validation and campaign creation rules.
- Optimization is advisory; budget/status changes require explicit application/user action.


## Production hardening

The AI Copilot is server-only and hardened with organization membership checks, database-backed per-user/per-organization AI rate limits, strict Zod validation of Gemini output, exact TradeMall website/publisher pair validation, bounded website and creative response bodies, supported-image MIME checks, Gemini retry/backoff for transient failures, and audit events for successful AI operations. Gemini recommendations remain advisory; campaign creation still requires the advertiser's explicit draft-creation action.

Required server environment variables:
- `GEMINI_API_KEY`
- `GEMINI_MODEL` (optional; defaults to the configured Gemini model)
