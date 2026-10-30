# Security Configuration

## Cloudflare Workers secrets

Some server-side values must be set as **Cloudflare Secrets**, not plaintext `vars`.

### Why Secrets vs Variables

- **Variables** (`wrangler.jsonc` `vars` block, or dashboard "Variables"): plaintext, checked into git, visible to anyone with repo access. Use only for non-sensitive config.
- **Secrets** (`wrangler secret put` or dashboard "Secrets"): encrypted, never visible after creation, not in git. Use for API keys, tokens, peppers, passwords, and anything else sensitive.

### Setting a secret via CLI

```bash
npx wrangler secret put API_KEY_PEPPER
npx wrangler secret put AD_TOKEN_SECRET
npx wrangler secret put PAYZA_SECRET_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

### Verifying secrets are registered

```bash
npx wrangler secret list
```

This prints the names of registered secrets. It does **not** reveal their values.

### Common mistake

If you add a secret through the Cloudflare dashboard, make sure you create it as type **Secret**, not **Variable**. Dashboard "Variables" are plaintext and are not injected into the Workers `env` object the same way.

### Runtime env wiring in this project

This project uses `captureRuntimeEnv(env)` in the Workers `fetch` handler to cache Cloudflare `env` bindings into an in-memory map. Server code then reads them through `readEnv(...)`, which checks:

1. the runtime env cache,
2. `process.env`,
3. `import.meta.env`.

Do **not** read Cloudflare secrets directly from `process.env` in application code; always use `readEnv(...)` so the runtime cache is respected.

### Health check

After deploying, verify wiring with:

```bash
curl https://trademall.co.ke/api/_internal/config-check
```

It returns booleans for required secrets (`API_KEY_PEPPER`, `AD_TOKEN_SECRET`, `PAYZA_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) without echoing their values.

## Database functions (money, settings, accounts)

Row-level security does **not** protect `SECURITY DEFINER` functions: they run with the
owner's rights, and Supabase exposes every function in `public` to anyone holding the
public API key. Until October 2026, 21 such functions (`deposit_to_wallet`, `request_payout`,
`review_payout`, `update_platform_billing_settings`, ...) were callable by anonymous visitors
with no checks. They were locked down in
`supabase/migrations/20261026000000_lock_down_money_functions.sql`.

Rules for every new function in `public`:

1. If it is `SECURITY DEFINER`, check the caller **inside** the function
   (`auth.uid()`, `public.is_org_member(...)`, `public.is_platform_admin(...)`), always
   allowing the server (`coalesce(auth.role(), '') = 'service_role'`).
2. If only the server calls it, make it server-only: `revoke all ... from public, anon,
   authenticated; grant execute ... to service_role;`.
3. In every case `revoke all on function ... from public, anon;` — Postgres grants
   `EXECUTE` to everyone by default, which is how this happened.
4. Never take an organization/user id from the caller and trust it without checking the
   caller belongs to it.

Re-run `supabase/audits/exposed-functions.sql` after schema changes. A test
(`src/lib/__tests__/migrations-security.test.ts`) enforces rule 3 for new migrations.
