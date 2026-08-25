/**
 * Production Payza payment failure diagnostic.
 *
 * This script traces ONE payment reference through the EXACT production code paths:
 * 1. Query payment record
 * 2. Call Payza verification (using production credentials)
 * 3. Check wallet state
 * 4. Attempt completion (dry-run unless explicitly enabled)
 *
 * REQUIRED:
 *   SUPABASE_SERVICE_ROLE_KEY
 *   PAYZA_PUBLIC_KEY
 *   PAYZA_SECRET_KEY
 *   PAYZA_API_BASE_URL (optional, defaults to https://payzaapi.co.ke)
 *
 * USAGE:
 *   npx tsx scripts/diagnose-production-payment.ts PAY-MT8NDY8K-3144C0E697F
 *
 * SAFETY:
 *   This script does NOT credit wallets, mark payments complete, or modify data
 *   unless DRY_RUN=false is explicitly set.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const REFERENCE = process.argv[2];
if (!REFERENCE) {
  console.error("Usage: npx tsx scripts/diagnose-production-payment.ts <reference>");
  process.exit(1);
}

const SUPABASE_URL = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
const SERVICE_ROLE_KEY =
  process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
  process.env["EXTERNAL_SUPABASE_SERVICE_ROLE_KEY"] ||
  process.env["SERVICE_ROLE_KEY"];

const PAYZA_PUBLIC_KEY = process.env["PAYZA_PUBLIC_KEY"] || process.env["PAYZA_PUBLIC"] || process.env["X_PUBLIC_KEY"];
const PAYZA_SECRET_KEY = process.env["PAYZA_SECRET_KEY"] || process.env["PAYZA_SECRET"] || process.env["X_SECRET_KEY"];
const PAYZA_API_BASE_URL = process.env["PAYZA_API_BASE_URL"] || "https://payzaapi.co.ke";

const DRY_RUN = process.env["DRY_RUN"] !== "false";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("MISSING: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  process.exit(1);
}

if (!PAYZA_PUBLIC_KEY || !PAYZA_SECRET_KEY) {
  console.error("MISSING: PAYZA_PUBLIC_KEY and PAYZA_SECRET_KEY are required");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function payzaVerifyFetch(reference: string): Promise<{
  status: number;
  json: any;
  text: string;
}> {
  const url = `${PAYZA_API_BASE_URL.replace(/\/+$/, "")}/api/v1/verify/${encodeURIComponent(reference)}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Public-Key": PAYZA_PUBLIC_KEY,
    "X-Secret-Key": PAYZA_SECRET_KEY,
  };

  let response: Response | null = null;
  let text = "";

  try {
    response = await fetch(url, {
      method: "GET",
      headers,
    });
  } catch (error) {
    return {
      status: 0,
      json: null,
      text: error instanceof Error ? error.message : String(error),
    };
  }

  text = await response.text().catch(() => "");
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return { status: response.status, json, text };
}

async function main() {
  console.log("\n[payment][diagnostic] START");
  console.log(`reference: ${REFERENCE}`);
  console.log(`dryRun: ${DRY_RUN}`);

  // ============================================================
  // STAGE 1: PAYMENT RECORD
  // ============================================================
  console.log("\n--- STAGE 1: PAYMENT RECORD ---");
  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("id, status, amount, currency, wallet_id, organization_id, user_id, provider, created_at, updated_at")
    .eq("reference", REFERENCE)
    .maybeSingle();

  if (paymentError || !payment) {
    console.error("[payment][diagnostic] NOT FOUND", { error: paymentError?.message });
    process.exit(1);
  }

  console.log("[payment][db][before]");
  console.log(`reference: ${REFERENCE}`);
  console.log(`status: ${payment.status}`);
  console.log(`amount: ${payment.amount}`);
  console.log(`currency: ${payment.currency}`);
  console.log(`userId: ${payment.user_id}`);
  console.log(`walletId: ${payment.wallet_id}`);
  console.log(`provider: ${payment.provider}`);

  // ============================================================
  // STAGE 2: PAYZA VERIFICATION
  // ============================================================
  console.log("\n--- STAGE 2: PAYZA VERIFICATION ---");
  const { status: httpStatus, json } = await payzaVerifyFetch(REFERENCE);

  const httpStatusNum = Number(httpStatus);
  const success = json?.success;
  const data = json?.data ?? json;
  const providerStatus = data?.status ?? data?.state ?? null;
  const providerMessage = json?.message ?? json?.error ?? null;
  const verifiedAmount = data?.amount ?? null;
  const verifiedCurrency = data?.currency ?? null;
  const providerTransactionId = data?.provider_transaction_id ?? data?.providerReference ?? data?.transaction_id ?? data?.id ?? null;

  console.log("[payza][verify][RESULT]");
  console.log(JSON.stringify({
    reference: REFERENCE,
    httpStatus: httpStatusNum,
    success,
    providerStatus,
    providerMessage,
    amount: verifiedAmount,
    currency: verifiedCurrency,
    providerTransactionId,
  }, null, 2));

  // ============================================================
  // STAGE 3: DECISION TREE
  // ============================================================
  console.log("\n--- STAGE 3: DECISION TREE ---");

  const isSuccess = success === true && providerStatus === "success";
  const isPending = success === true && providerStatus === "pending";
  const isVerificationFailed = success === false || httpStatusNum === 401 || httpStatusNum === 403 || httpStatusNum === 404 || httpStatusNum === 429 || (httpStatusNum >= 500);

  console.log(`isSuccess: ${isSuccess}`);
  console.log(`isPending: ${isPending}`);
  console.log(`isVerificationFailed: ${isVerificationFailed}`);

  if (isVerificationFailed && !isSuccess) {
    console.log("\n[payment][diagnostic] VERIFICATION FAILED — wallet completion will NOT be reached");
    console.log(`reason: ${providerMessage ?? `HTTP ${httpStatusNum}`}`);
    console.log(`ROOT CAUSE: Payza verification returned failure, not success`);
    return;
  }

  if (isPending) {
    console.log("\n[payment][diagnostic] PAYMENT IS GENUINELY PENDING");
    console.log(`reason: Payza returned success=true with data.status="pending"`);
    console.log(`ROOT CAUSE: Payment is still processing on Payza's side`);
    return;
  }

  if (!isSuccess) {
    console.log("\n[payment][diagnostic] UNEXPECTED STATE");
    console.log(`httpStatus: ${httpStatusNum}`);
    console.log(`success: ${success}`);
    console.log(`providerStatus: ${providerStatus}`);
    console.log(`ROOT CAUSE: Payza returned an unexpected response that is neither success nor pending`);
    return;
  }

  // ============================================================
  // STAGE 4: WALLET BEFORE
  // ============================================================
  console.log("\n--- STAGE 4: WALLET BEFORE ---");
  const { data: walletBefore, error: walletError } = await supabase
    .from("wallets")
    .select("id, balance_amount, currency, organization_id")
    .eq("organization_id", payment.organization_id)
    .eq("currency", payment.currency)
    .maybeSingle();

  if (walletError || !walletBefore) {
    console.error("[wallet][diagnostic] NOT FOUND", { error: walletError?.message });
    process.exit(1);
  }

  console.log("[wallet][before]");
  console.log(`walletId: ${walletBefore.id}`);
  console.log(`currency: ${walletBefore.currency}`);
  console.log(`balance: ${walletBefore.balance_amount}`);

  // ============================================================
  // STAGE 5: COMPLETE PAYMENT (DRY RUN)
  // ============================================================
  console.log("\n--- STAGE 5: COMPLETE PAYMENT ---");

  if (payment.status === "completed") {
    console.log("[payment][diagnostic] ALREADY COMPLETED");
    console.log(`paymentId: ${payment.id}`);
    console.log(`Wallet completion was never needed because payment was already completed.`);
    return;
  }

  console.log(`[payment][diagnostic] WOULD CALL completePaymentByReference()`);
  console.log(`reference: ${REFERENCE}`);
  console.log(`paymentId: ${payment.id}`);
  console.log(`verifiedAmount: ${verifiedAmount}`);
  console.log(`verifiedCurrency: ${verifiedCurrency}`);
  console.log(`providerTransactionId: ${providerTransactionId}`);

  if (DRY_RUN) {
    console.log("\n[payment][diagnostic] DRY RUN — NOT calling complete_payment RPC");
    console.log("Set DRY_RUN=false to actually execute completion");
    return;
  }

  // ============================================================
  // STAGE 6: ACTUAL COMPLETION (only if DRY_RUN=false)
  // ============================================================
  console.log("\n--- STAGE 6: ACTUAL COMPLETION ---");
  console.log("[payment][diagnostic] CALLING completePaymentByReference...");

  // We need to simulate what the callback does
  // Import the actual function
  const { completePaymentByReference } = await import("./src/lib/payment-service.server");

  try {
    const result = await completePaymentByReference(
      { supabase: supabase as any, userId: "diagnostic" } as any,
      REFERENCE,
      providerTransactionId ?? REFERENCE,
      null,
      verifiedAmount ?? undefined,
      verifiedCurrency ?? undefined,
    );

    console.log("[payment][completion]");
    console.log(JSON.stringify({
      reference: REFERENCE,
      paymentId: result.paymentId,
      verifiedAmount,
      verifiedCurrency,
      rpcCalled: true,
      rpcResult: result,
      alreadyCompleted: result.alreadyCompleted,
    }, null, 2));

    // ============================================================
    // STAGE 7: WALLET AFTER
    // ============================================================
    console.log("\n--- STAGE 7: WALLET AFTER ---");
    const { data: walletAfter, error: walletAfterError } = await supabase
      .from("wallets")
      .select("id, balance_amount, currency, organization_id")
      .eq("organization_id", payment.organization_id)
      .eq("currency", payment.currency)
      .maybeSingle();

    if (walletAfterError || !walletAfter) {
      console.error("[wallet][diagnostic] AFTER NOT FOUND", { error: walletAfterError?.message });
      process.exit(1);
    }

    console.log("[wallet][after]");
    console.log(`walletId: ${walletAfter.id}`);
    console.log(`currency: ${walletAfter.currency}`);
    console.log(`balance: ${walletAfter.balance_amount}`);
    console.log(`increase: ${Number(walletAfter.balance_amount) - Number(walletBefore.balance_amount)}`);

    // ============================================================
    // STAGE 8: PAYMENT AFTER
    // ============================================================
    console.log("\n--- STAGE 8: PAYMENT AFTER ---");
    const { data: paymentAfter } = await supabase
      .from("payments")
      .select("id, status, amount, currency, wallet_id, organization_id")
      .eq("reference", REFERENCE)
      .maybeSingle();

    if (paymentAfter) {
      console.log("[payment][db][after]");
      console.log(`reference: ${REFERENCE}`);
      console.log(`status: ${paymentAfter.status}`);
      console.log(`amount: ${paymentAfter.amount}`);
      console.log(`currency: ${paymentAfter.currency}`);
    }

    // ============================================================
    // STAGE 9: LEDGER
    // ============================================================
    console.log("\n--- STAGE 9: LEDGER ---");
    const { data: transactions, error: txError } = await supabase
      .from("wallet_transactions")
      .select("id, amount, currency, type, reference_id, reference_type, created_at")
      .eq("wallet_id", walletBefore.id)
      .order("created_at", { ascending: false })
      .limit(5);

    if (txError) {
      console.error("[wallet][diagnostic] TRANSACTIONS ERROR", { error: txError.message });
    } else if (transactions && transactions.length > 0) {
      console.log("[wallet][ledger]");
      for (const tx of transactions) {
        console.log(JSON.stringify({
          transactionId: tx.id,
          amount: tx.amount,
          currency: tx.currency,
          type: tx.type,
          reference: tx.reference_id,
          referenceType: tx.reference_type,
        }, null, 2));
      }
    } else {
      console.log("[wallet][ledger] NO TRANSACTIONS FOUND");
    }

  } catch (error) {
    console.error("[payment][diagnostic] COMPLETION FAILED", {
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }
}

main().catch((error) => {
  console.error("[payment][diagnostic] FATAL", error);
  process.exit(1);
});
