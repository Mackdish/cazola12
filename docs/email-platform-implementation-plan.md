# TradeMall Email Platform — Implementation Plan

## Scope

Build one email platform on the existing Resend integration for both advertiser and publisher journeys, plus full platform-admin controls. Transactional messages and consent-based marketing are separate streams: operational mail is never blocked by marketing opt-out, while campaigns and promotional automations always respect preferences, unsubscribe state, and suppression.

## Repository findings

- The app is a TanStack Start / React / TypeScript application backed by Supabase.
- `resend` is already a production dependency and `RESEND_API_KEY` is documented as server-only in `.env.example`.
- `src/lib/email.server.ts` currently creates a singleton Resend client and sends only website-approved and website-rejected emails. Those sends are direct calls, not queued, templated, or logged centrally.
- Website review actions invoke those functions from server-side admin operations.
- Supabase migrations are maintained under `supabase/migrations`; generated DB types live in `src/integrations/supabase/types.ts`.
- Platform authorization already exposes `is_platform_staff` / `is_platform_admin` and the admin workspace is guarded by `assertWorkspaceAccess("admin")`.
- The admin route tree is file-based. New admin pages must follow the existing `admin.*.tsx` convention and be registered by the TanStack route generator.
- Existing app sender is `TradeMall <no-reply@trademall.co.ke>`; support contact is `support@trademall.co.ke`. Delivery requires that the sending domain is verified in Resend.

## Target architecture

1. **Domain events** — auth, organization, campaign, wallet, website, ad-zone, earnings, payout, and platform events are recorded from trusted server-side business operations. Event producers do not call Resend directly.
2. **Automation evaluator** — maps an event to enabled automations and eligible steps; applies audience, timing, frequency, and eligibility conditions.
3. **Persistent queue** — stores scheduled work, retries, idempotency keys, and delivery state in Supabase. A worker claims due rows using a database lock so multiple workers cannot send the same message concurrently.
4. **Renderer and Resend adapter** — renders versioned templates with escaped variables, sends via the existing Resend SDK, and records provider IDs/results.
5. **Webhook reconciliation** — Resend webhook events update delivery, bounce, complaint, and suppression state. Verify webhook signatures before accepting events.
6. **Admin workspace** — manage templates, automations, broadcasts, segments, preferences/suppressions, queue, and delivery analytics. All write operations require a platform-admin role and are audited.

## Data model introduced in the foundation migration

- `email_templates`: reusable versioned transactional/marketing templates.
- `email_preferences`: per-user marketing consent and unsubscribe state.
- `email_events`: idempotent domain event ledger.
- `email_automations` and `email_automation_steps`: configurable journeys and timed steps.
- `email_queue`: scheduled delivery queue with retries and idempotency.
- `email_logs`: provider and delivery lifecycle records.
- `email_campaigns` and `email_campaign_recipients`: admin broadcasts and recipient-level results.

All email-platform tables have RLS enabled. Users can manage only their own preferences; platform staff can inspect/manage admin data. Queue claiming is a service-role-only database function.

## Journeys to implement

### Shared account lifecycle
- Welcome / account-created.
- Email-confirmation and password-reset remain owned by Supabase Auth; configure their branded templates rather than duplicating auth tokens in app mail.
- Security alerts for password/email changes and sign-in anomalies where supported by trusted events.
- Incomplete onboarding reminders at 24 hours and 3 days, with suppression once onboarding completes.
- Re-engagement at 7 and 30 days only for opted-in recipients.

### Advertiser
- Profile completion and first-campaign guidance.
- Campaign submitted, approved, rejected, paused, resumed, and completed.
- Wallet top-up success/failure and low-balance notices.
- Budget depletion / campaign ending reminders with deduplication and threshold rules.
- First campaign milestone and weekly/monthly performance summaries.
- Lapsed advertiser win-back, marketing consent required.

### Publisher
- Publisher welcome and profile completion.
- Website submitted, verification required, approved, rejected, and policy status changed.
- Ad-zone setup guidance and first-impression milestone.
- Earnings available, payout requested, approved, rejected, and paid.
- Weekly earnings/performance summaries and opted-in re-engagement.

### Platform communications
- Product announcements, feature launches, scheduled maintenance, incident notices, and policy updates.
- Operational/incident notices are transactional; promotional product newsletters are marketing and require consent.

## Admin controls

Create an Email workspace with:
- Overview: queued, sent, delivered, bounced, complained, failed, unsubscribed, and campaign performance.
- Templates: create/edit, category, preview, test-send, versioning, activate/archive.
- Automations: trigger, audience, steps/delays, conditions, enable/pause, run history.
- Campaigns: audience filters, consent preview, draft, test, schedule, send, pause/cancel, recipient outcomes.
- Audience: advertiser/publisher/both, active status, signup date, organization, consent, suppression; export only permitted fields.
- Delivery logs: Resend message ID, event timeline, retries, errors, bounce/complaint reason.
- Preferences/suppressions: inspect state and reason; never silently re-subscribe a user.
- Settings: sender identity, reply-to, webhook status, test configuration; secrets remain in server environment and are never rendered to clients.

## Delivery and compliance rules

- Use a stable idempotency key for every event + recipient + template + automation step.
- Queue insertion must be idempotent; workers claim rows with `FOR UPDATE SKIP LOCKED`.
- Re-check user state, marketing consent, suppression, and automation eligibility immediately before sending.
- Transactional and marketing categories are explicit; marketing requires consent and a one-click unsubscribe path.
- Respect Resend rate limits, exponential backoff, maximum attempts, and terminal bounce/complaint suppression.
- Never log API keys, auth tokens, full payment details, or sensitive event payloads.
- Keep email sends off request-critical paths. A Resend outage must not roll back a successful campaign approval, payout, or wallet operation.

## Delivery sequence

1. **Foundation (this branch):** schema, RLS, queue-claim primitive, documented architecture and acceptance criteria.
2. **Core delivery:** server-only Resend adapter, template renderer, queue producer/worker, retries, logs, webhook signature verification, and migrate the two existing website emails to queued delivery.
3. **Event producers:** wire signup/organization, campaign, wallet, website, ad-zone, earnings, and payout events; seed default templates and advertiser/publisher automations.
4. **Admin workspace:** route, navigation, server functions, template editor, automation builder, campaign composer, audience filters, logs, and analytics.
5. **Hardening:** tests for authorization, idempotency, opt-out, worker concurrency, retries, webhook signatures, and end-to-end test sends; configure Resend domain/webhook and scheduled worker in deployment.

## Acceptance criteria

- A domain event creates at most one queue item per recipient/template/step.
- Multiple workers cannot claim the same item concurrently.
- A marketing send is impossible without valid consent and no suppression.
- Transactional mail continues when marketing is disabled.
- Resend failures are retried without affecting the originating business transaction.
- Every send has an auditable queue record, provider ID, and delivery status.
- Non-admin users cannot read or mutate templates, automations, campaigns, queue, or logs.
- Admins can preview and test a message before scheduling a real campaign.
- No email secret is exposed to browser code.


## Implementation progress (feature branch)

The following working slices have now been added on `feature/trademall-email-platform`:

- Server-only Resend adapter with database-backed queueing, escaped template interpolation, provider idempotency keys, exponential retry scheduling, and stale worker-lease recovery.
- Cloudflare `scheduled()` handler drains up to 25 due messages every minute. The repository already has a one-minute Cron Trigger in `wrangler.jsonc`.
- Authenticated fallback worker endpoint: `POST /api/worker/email-delivery`.
- Signed Resend webhook endpoint: `POST /api/webhooks/resend`, with provider-event deduplication, delivery logs, and bounce/complaint suppression.
- Signed unsubscribe endpoint: `/api/email/unsubscribe`, supporting browser GET and Resend one-click POST. Marketing sends include List-Unsubscribe headers and a footer link.
- User self-service preferences page at `/email-preferences`, linked from admin, advertiser and publisher navigation.
- Admin email workspace at `/admin/email`: template create/edit/activate, test sends, automation creation and enable/pause, campaign drafts, immediate sends, scheduling, pause/cancel, queue/log views, and suppression review/removal.
- Consent-filtered campaign audience expansion across paginated Auth users; only active advertiser/publisher organization members with marketing consent and no suppression are queued.
- Event dispatcher with event-key deduplication and configurable automation steps. Default advertiser/publisher welcome journeys are seeded.
- Business events are wired for new advertiser/publisher profiles, website creation/review, ad-zone creation, campaign creation/submission/approval/rejection, advertiser wallet deposits, and publisher payout request/approval/rejection/payment.
- Seeded transactional templates and automation journeys for the main advertiser and publisher lifecycle events.

## Remaining before production rollout

1. Run the full TypeScript, lint, unit and production build checks in the repository's normal development environment.
2. Apply the three email migrations to the connected Supabase project and regenerate database types if required by the project's workflow.
3. Configure Cloudflare secrets: `RESEND_API_KEY`, `EMAIL_FROM`, `RESEND_WEBHOOK_SECRET`, and `EMAIL_UNSUBSCRIBE_SECRET`. The optional HTTP worker endpoint also needs `EMAIL_WORKER_SECRET`.
4. Register `https://trademall.co.ke/api/webhooks/resend` in Resend and subscribe to delivery, bounce, complaint, open and click events.
5. Verify the `trademall.co.ke` sending domain in Resend and send test messages to controlled inboxes.
6. Add integration tests against a test Supabase project for worker concurrency, duplicate webhooks, unsubscribe, campaign scheduling/pause/cancel, role-based admin access, and retry recovery.

The feature branch has not been deployed and the migrations have not been applied to production. The scheduled delivery hook is implemented, but real delivery depends on the environment secrets and verified Resend domain being configured.
