import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Guard against reopening the October 2026 hole: SECURITY DEFINER functions in `public`
 * bypass row-level security and Postgres grants EXECUTE to everyone (including the
 * anonymous public API key) by default. Every migration from the lock-down onwards that
 * defines such a function must also revoke access from anon/public (see SECURITY.md).
 */
const LOCK_DOWN_VERSION = "20261026000000";
const dir = resolve(process.cwd(), "supabase/migrations");

const migrations = readdirSync(dir)
  .filter((file) => file.endsWith(".sql") && file.split("_")[0]! >= LOCK_DOWN_VERSION)
  .map((file) => ({ file, sql: readFileSync(resolve(dir, file), "utf8") }));

// Strip comments so words in comments don't count.
const code = (sql: string) => sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

describe("migrations from the lock-down onwards", () => {
  it("includes the lock-down migration itself", () => {
    expect(migrations.map((m) => m.file)).toContain("20261026000000_lock_down_money_functions.sql");
  });

  for (const { file, sql } of migrations) {
    it(`${file}: every SECURITY DEFINER function revokes anonymous access`, () => {
      const body = code(sql);
      const definesDefiner = /security\s+definer/i.test(body);
      if (!definesDefiner) return;
      expect(body, "must revoke EXECUTE from anon/public").toMatch(/revoke\s+(all|execute)[\s\S]*?(anon|public)/i);
    });
  }

  it("the lock-down keeps the server-only list and a guard in request_payout", () => {
    const body = code(migrations.find((m) => m.file.startsWith(LOCK_DOWN_VERSION))!.sql);
    for (const fn of ["deposit_to_wallet", "review_payout", "refund_campaign_spend", "update_platform_billing_settings"]) {
      expect(body).toContain(fn);
    }
    expect(body).toContain("payout_id is null"); // the double-payout fix
    expect(body).toMatch(/is_org_member\(_organization_id, auth\.uid\(\)\)/);
  });
});
