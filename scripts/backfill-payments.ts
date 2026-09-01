/**
 * Backfill payment statuses for pending transactions.
 *
 * Usage:
 *   bun run scripts/backfill-payments.ts
 *   npx tsx scripts/backfill-payments.ts
 *
 * This script:
 * 1. Reads all pending payments from Supabase
 * 2. Verifies each payment's actual status with PayzaAPI
 * 3. Updates the database accordingly:
 *    - completed → credits wallet, marks payment completed
 *    - failed/cancelled → marks payment failed/cancelled
 *    - still pending → leaves as pending
 *
 * IMPORTANT: Run this AFTER applying the migration that fixes the payment RPCs.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

interface PaymentRow {
  id: string;
  reference: string;
  status: string;
  amount: number;
  currency: string;
  wallet_id: string;
  organization_id: string;
  provider: string;
  provider_reference: string | null;
  provider_transaction_id: string | null;
  provider_receipt: string | null;
  created_at: string;
}

async function fetchAllPendingPayments(): Promise<PaymentRow[]> {
  const allPayments: PaymentRow[] = [];
  let page = 0;
  const pageSize = 100;

  while (true) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .range(from, to);

    if (error) {
      console.error("Failed to fetch payments:", error);
      throw error;
    }

    const batch = data as PaymentRow[] | null;
    if (!batch || batch.length === 0) {
      break;
    }

    allPayments.push(...batch);

    if (batch.length < pageSize) {
      break;
    }

    page++;
  }

  return allPayments;
}

async function verifyWithPayzaApi(reference: string): Promise<{
  status: string;
  providerTransactionId?: string;
  providerReceipt?: string;
  amount?: number;
  currency?: string;
}> {
  // Dynamically import server-only module to avoid bundling in client
  const { verifyPayzaPayment } = await import("./src/lib/payzaapi.server");
  return verifyPayzaPayment(reference);
}

async function completePayment(payment: PaymentRow, verification: Awaited<ReturnType<typeof verifyWithPayzaApi>>): Promise<boolean> {
  // Use the fixed RPC directly to avoid any extra server function logic
  const { data, error } = await supabase.rpc("complete_payment", {
    _payment_id: payment.id,
    _provider: payment.provider,
    _provider_reference: verification.providerTransactionId ?? payment.provider_reference ?? payment.reference,
    _provider_transaction_id: verification.providerTransactionId ?? payment.provider_transaction_id ?? null,
    _provider_receipt: verification.providerReceipt ?? payment.provider_receipt ?? null,
  });

  if (error) {
    console.error(`  [backfill] complete_payment RPC failed for ${payment.reference}:`, error.message);
    return false;
  }

  const result = Array.isArray(data) ? data[0] : data;
  console.log(`  [backfill] complete_payment result:`, result);
  return true;
}

async function markPaymentFailed(payment: PaymentRow, reason: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("fail_payment", {
    _payment_id: payment.id,
    _provider: payment.provider,
    _failure_reason: reason,
  });

  if (error) {
    console.error(`  [backfill] fail_payment RPC failed for ${payment.reference}:`, error.message);
    return false;
  }

  const result = Array.isArray(data) ? data[0] : data;
  console.log(`  [backfill] fail_payment result:`, result);
  return true;
}

async function markPaymentCancelled(payment: PaymentRow): Promise<boolean> {
  const { data, error } = await supabase.rpc("cancel_payment", {
    _payment_id: payment.id,
    _provider: payment.provider,
  });

  if (error) {
    console.error(`  [backfill] cancel_payment RPC failed for ${payment.reference}:`, error.message);
    return false;
  }

  const result = Array.isArray(data) ? data[0] : data;
  console.log(`  [backfill] cancel_payment result:`, result);
  return true;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("[backfill] Fetching all pending payments...");
  const payments = await fetchAllPendingPayments();
  console.log(`[backfill] Found ${payments.length} pending payment(s).`);

  if (payments.length === 0) {
    console.log("[backfill] Nothing to do.");
    return;
  }

  let completed = 0;
  let failed = 0;
  let cancelled = 0;
  let stillPending = 0;
  let errors = 0;

  for (let i = 0; i < payments.length; i++) {
    const payment = payments[i];
    const progress = `[${i + 1}/${payments.length}]`;

  console.log(`${progress} [backfill] Verifying ${payment.reference} (${payment.amount} ${payment.currency})...`);

  try {
    const verification = await verifyWithPayzaApi(payment.reference);
    const status = verification.status;

    console.log(`${progress} [backfill] PayzaAPI status for ${payment.reference}: ${status}`);

    if (status === "completed") {
      console.log(`${progress} [payment][confirmed]`, {
        reference: payment.reference,
        transactionId: verification.providerTransactionId,
        amount: payment.amount,
        currency: payment.currency,
        walletId: payment.wallet_id,
        organizationId: payment.organization_id,
      });

      const { data, error } = await supabase.rpc("complete_payment", {
        _payment_id: payment.id,
        _provider: payment.provider,
        _provider_reference: verification.providerTransactionId ?? payment.provider_reference ?? payment.reference,
        _provider_transaction_id: verification.providerTransactionId ?? payment.provider_transaction_id ?? null,
        _provider_receipt: verification.providerReceipt ?? payment.provider_receipt ?? null,
      });

      if (error) {
        console.error(`${progress} [wallet][credit][ERROR]`, {
          reference: payment.reference,
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        errors++;
        console.log(`${progress} [backfill] ❌ Failed to complete ${payment.reference}`);
        continue;
      }

      const result = Array.isArray(data) ? data[0] : data;
      console.log(`${progress} [wallet][credit][SUCCESS]`, {
        reference: payment.reference,
        walletId: payment.wallet_id,
        newBalance: result?.wallet_balance,
        alreadyCompleted: result?.already_completed,
      });
      console.log(`${progress} [backfill] ✅ Completed ${payment.reference}`);
      completed++;
      } else if (status === "failed" || status === "verification_failed") {
        console.log(`${progress} [payment][deposit]`, {
          reference: payment.reference,
          status: "failed",
          reason: `provider reported ${status}`,
        });
        const ok = await markPaymentFailed(payment, `Backfill: provider reported ${status}`);
        if (ok) {
          failed++;
          console.log(`${progress} [backfill] ✅ Marked failed ${payment.reference}`);
        } else {
          errors++;
          console.log(`${progress} [backfill] ❌ Failed to mark failed ${payment.reference}`);
        }
      } else if (status === "cancelled") {
        console.log(`${progress} [payment][deposit]`, {
          reference: payment.reference,
          status: "cancelled",
        });
        const ok = await markPaymentCancelled(payment);
        if (ok) {
          cancelled++;
          console.log(`${progress} [backfill] ✅ Marked cancelled ${payment.reference}`);
        } else {
          errors++;
          console.log(`${progress} [backfill] ❌ Failed to mark cancelled ${payment.reference}`);
        }
      } else {
        console.log(`${progress} [payment][deposit]`, {
          reference: payment.reference,
          status: "pending",
        });
        stillPending++;
        console.log(`${progress} [backfill] ⏳ Still pending: ${payment.reference}`);
      }
    } catch (error) {
      errors++;
      console.error(`${progress} [backfill] ❌ Error verifying ${payment.reference}:`, error);
    }

    // Rate-limit ourselves to avoid hitting PayzaAPI too hard
    if (i < payments.length - 1) {
      await sleep(500);
    }
  }

  console.log("\n[backfill] ===== SUMMARY =====");
  console.log(`[backfill] Total pending payments:  ${payments.length}`);
  console.log(`[backfill] Completed:               ${completed}`);
  console.log(`[backfill] Failed:                  ${failed}`);
  console.log(`[backfill] Cancelled:               ${cancelled}`);
  console.log(`[backfill] Still pending:           ${stillPending}`);
  console.log(`[backfill] Errors:                  ${errors}`);
  console.log("[backfill] =====================");
}

main().catch((error) => {
  console.error("[backfill] Fatal error:", error);
  process.exit(1);
});
