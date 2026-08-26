/**
 * Database integration coverage for the atomic payment-completion RPC.
 *
 * These tests deliberately require separately named staging credentials so
 * they cannot be accidentally run against the production project.
 *
 * Run after deploying migrations to staging:
 *   SUPABASE_TEST_URL=... SUPABASE_TEST_SERVICE_ROLE_KEY=... npm test -- --run src/lib/__tests__/complete-payment.integration.test.ts
 */
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const testUrl = process.env["SUPABASE_TEST_URL"];
const testServiceRoleKey = process.env["SUPABASE_TEST_SERVICE_ROLE_KEY"];
const canRun = Boolean(testUrl && testServiceRoleKey);

describe.skipIf(!canRun)("complete_payment", () => {
  let supabase: SupabaseClient;
  const organizationIds: string[] = [];

  beforeAll(() => {
    supabase = createClient(testUrl!, testServiceRoleKey!);
  });

  afterEach(async () => {
    const ids = organizationIds.splice(0);
    for (const organizationId of ids) {
      await supabase.from("wallet_transactions").delete().eq("organization_id", organizationId);
      await supabase.from("payments").delete().eq("organization_id", organizationId);
      await supabase.from("wallets").delete().eq("organization_id", organizationId);
      await supabase.from("organizations").delete().eq("id", organizationId);
    }
  });

  async function createPendingKesPayment() {
    const suffix = crypto.randomUUID();
    const { data: organization, error: organizationError } = await supabase
      .from("organizations")
      .insert({ name: `Payment RPC Test ${suffix}`, slug: `payment-rpc-${suffix}`, type: "advertiser" })
      .select("id")
      .single();
    if (organizationError) throw organizationError;
    organizationIds.push(organization.id);

    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .insert({ organization_id: organization.id, currency: "KES", balance_amount: 0 })
      .select("id, balance_amount")
      .single();
    if (walletError) throw walletError;

    const paymentId = crypto.randomUUID();
    const reference = `TEST-PAY-${suffix}`;
    const { error: paymentError } = await supabase.from("payments").insert({
      id: paymentId,
      organization_id: organization.id,
      wallet_id: wallet.id,
      amount: 100,
      currency: "KES",
      provider: "payzaapi",
      reference,
      status: "pending",
    });
    if (paymentError) throw paymentError;

    return { organizationId: organization.id, walletId: wallet.id, paymentId, reference };
  }

  it("credits a verified KES payment once and creates one text ledger reference", async () => {
    const payment = await createPendingKesPayment();

    const results = await Promise.all(
      Array.from({ length: 2 }, () =>
        supabase.rpc("complete_payment", {
          _payment_id: payment.paymentId,
          _provider: "payzaapi",
          _provider_reference: payment.reference,
        }),
      ),
    );
    for (const result of results) expect(result.error).toBeNull();

    const { data: finalPayment, error: finalPaymentError } = await supabase
      .from("payments")
      .select("status")
      .eq("id", payment.paymentId)
      .single();
    expect(finalPaymentError).toBeNull();
    expect(finalPayment?.status).toBe("completed");

    const { data: finalWallet, error: finalWalletError } = await supabase
      .from("wallets")
      .select("balance_amount")
      .eq("id", payment.walletId)
      .single();
    expect(finalWalletError).toBeNull();
    expect(Number(finalWallet?.balance_amount)).toBe(100);

    const { data: transactions, error: transactionError } = await supabase
      .from("wallet_transactions")
      .select("amount, reference_id, reference_type")
      .eq("wallet_id", payment.walletId)
      .eq("reference_type", "payment");
    expect(transactionError).toBeNull();
    expect(transactions).toEqual([
      expect.objectContaining({ amount: 100, reference_id: payment.paymentId, reference_type: "payment" }),
    ]);
  });

  it("rejects a pending payment when its target wallet has a different currency", async () => {
    const payment = await createPendingKesPayment();
    const { error: currencyUpdateError } = await supabase
      .from("wallets")
      .update({ currency: "UGX" })
      .eq("id", payment.walletId);
    expect(currencyUpdateError).toBeNull();

    const { error } = await supabase.rpc("complete_payment", {
      _payment_id: payment.paymentId,
      _provider: "payzaapi",
      _provider_reference: payment.reference,
    });
    expect(error?.message).toContain("Wallet currency");

    const { data: wallet } = await supabase
      .from("wallets")
      .select("balance_amount")
      .eq("id", payment.walletId)
      .single();
    expect(Number(wallet?.balance_amount)).toBe(0);
  });
});
