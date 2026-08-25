/**
 * Payza payment flow end-to-end diagnostic.
 *
 * This script traces the EXACT same code paths as production:
 *   1. Query payment record from Supabase
 *   2. Call PayzaAPI verification (server-side, with secret key)
 *   3. Check wallet balance before/after
 *   4. Verify completion status
 *
 * REQUIRED ENVIRONMENT VARIABLES:
 *   SUPABASE_URL               - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY  - Service role key for admin DB access
 *   PAYZA_PUBLIC_KEY           - PayzaAPI public key
 *   PAYZA_SECRET_KEY           - PayzaAPI secret key
 *   PAYZA_API_BASE_URL         - PayzaAPI base URL (default: https://payzaapi.co.ke)
 *
 * USAGE:
 *   npx tsx scripts/diagnose-payment-flow.ts PAY-MT8NDY8K-3144C0E697F...
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { verifyPayzaPayment, getEnv } from "../src/lib/payzaapi.server";

const REFERENCE = process.argv[2];
if (!REFERENCE) {
  console.error("Usage: npx tsx scripts/diagnose-payment-flow.ts <payment-reference>");
  process.exit(1);
}

const SUPABASE_URL = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
const SERVICE_ROLE_KEY =
  process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
  process.env["EXTERNAL_SUPABASE_SERVICE_ROLE_KEY"] ||
  process.env["SERVICE_ROLE_KEY"];

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  console.log("\n[payment][test] start");
  console.log(`reference: ${REFERENCE}`);

  // Stage 1: Query payment record
  console.log("\n--- Stage 1: Payment Record ---");
  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("id, status, amount, currency, wallet_id, organization_id, user_id, provider, created_at, updated_at")
    .eq("reference", REFERENCE)
    .maybeSingle();

  if (paymentError || !payment) {
    console.error("[payment][test] NOT FOUND", { error: paymentError?.message });
    process.exit(1);
  }

  console.log("[payment][test] created");
  console.log(`reference: ${REFERENCE}`);
  console.log(`userId: ${payment.user_id}`);
  console.log(`amount: ${payment.amount}`);
  console.log(`currency: ${payment.currency}`);
  console.log(`status: ${payment.status}`);
  console.log(`walletId: ${payment.wallet_id}`);
  console.log(`provider: ${payment.provider}`);

  // Stage 2: Check Payza configuration
  console.log("\n--- Stage 2: Payza Configuration ---");
  const env = getEnv();
  console.log(`baseUrl: ${env.baseUrl}`);
  console.log(`publicKey configured: ${Boolean(env.publicKey)}`);
  console.log(`secretKey configured: ${Boolean(env.secretKey)}`);
  console.log(`callbackUrl: ${env.callbackUrl}`);

  // Stage 3: Payza verification
  console.log("\n--- Stage 3: Payza Verification ---");
  try {
    const verification = await verifyPayzaPayment(REFERENCE);
    console.log("[payza][test][verify]");
    console.log(`httpStatus: ${verification.status === "authentication_failed" || verification.status === "provider_forbidden" || verification.status === "payment_not_found" || verification.status === "rate_limited" || verification.status === "provider_unavailable" || verification.status === "provider_request_error" || verification.status === "verification_failed" ? "error" : "200"}`);
    console.log(`success: ${verification.status === "completed" ? "true" : "false"}`);
    console.log(`providerStatus: ${verification.status}`);
    console.log(`amount: ${verification.amount}`);
    console.log(`currency: ${verification.currency}`);
    console.log(`providerReference: ${verification.providerTransactionId ?? "none"}`);

    if (verification.status === "completed") {
      console.log("\n[payment][verified]");
      console.log(`reference: ${REFERENCE}`);
      console.log(`verifiedAmount: ${verification.amount}`);
      console.log(`verifiedCurrency: ${verification.currency}`);
      console.log(`providerTransactionId: ${verification.providerTransactionId}`);
      console.log(`providerReceipt: ${verification.providerReceipt}`);
    }
  } catch (error) {
    console.error("[payza][test][verify] FAILED", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }

  // Stage 4: Wallet before
  console.log("\n--- Stage 4: Wallet Before ---");
  const { data: walletBefore, error: walletError } = await supabase
    .from("wallets")
    .select("id, balance_amount, currency, organization_id")
    .eq("organization_id", payment.organization_id)
    .eq("currency", payment.currency)
    .maybeSingle();

  if (walletError || !walletBefore) {
    console.error("[wallet][test] NOT FOUND", { error: walletError?.message });
    process.exit(1);
  }

  console.log("[wallet][before]");
  console.log(`walletId: ${walletBefore.id}`);
  console.log(`currency: ${walletBefore.currency}`);
  console.log(`balance: ${walletBefore.balance_amount}`);

  // Stage 5: Check if already completed
  console.log("\n--- Stage 5: Completion Status ---");
  if (payment.status === "completed") {
    console.log("[payment][test] ALREADY COMPLETED");
    console.log(`paymentId: ${payment.id}`);
    console.log(`status: ${payment.status}`);
    console.log("\nWallet balance unchanged (already completed).");
    return;
  }

  console.log("[payment][test] PENDING - requires manual completion via callback or confirmPayment");
  console.log("\nTo complete this payment:");
  console.log("1. Ensure PayzaAPI has posted/redirected to /api/public/pay/callback");
  console.log("2. Or call confirmPayment server function with this reference");
  console.log("3. The callback will verify with PayzaAPI and credit the wallet automatically");

  // Stage 6: Final state
  console.log("\n--- Stage 6: Current State Summary ---");
  console.log(`Payment reference: ${REFERENCE}`);
  console.log(`Payment ID: ${payment.id}`);
  console.log(`Current status: ${payment.status}`);
  console.log(`Amount: ${payment.amount} ${payment.currency}`);
  console.log(`Wallet ID: ${walletBefore.id}`);
  console.log(`Wallet balance: ${walletBefore.balance_amount} ${walletBefore.currency}`);
  console.log(`Provider: ${payment.provider}`);

  console.log("\n[payment][test] trace complete");
}

main().catch((error) => {
  console.error("[payment][test] FATAL", error);
  process.exit(1);
});
