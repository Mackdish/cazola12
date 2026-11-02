import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useApplyReferralCode } from "@/hooks/use-referral";
import {
  clearStoredReferralCode,
  readStoredReferralCode,
  referralCodeFromSearch,
  storeReferralCode,
} from "@/lib/referral-domain";

/**
 * Mounted once at the root. If a visitor arrives through a referral link (?ref=CODE) we
 * remember the code for 30 days, so it still works if they sign up later or on another page.
 */
export function ReferralCapture() {
  useEffect(() => {
    const code = referralCodeFromSearch(window.location.search);
    if (code) storeReferralCode(code);
  }, []);
  return null;
}

/** Reasons worth retrying later (the program might open, or the network might recover). */
const RETRY_REASONS = new Set(["program_disabled", "error"]);

/**
 * Mounted inside the signed-in area. Once a new user is signed in it applies the code that
 * ReferralCapture remembered, exactly once, then forgets it. Failures that can never succeed
 * (invalid code, already referred, existing account...) are dropped silently.
 */
export function ReferralApplier() {
  const apply = useApplyReferralCode();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const code = readStoredReferralCode();
    if (!code) return;
    apply
      .mutateAsync(code)
      .then((result) => {
        if (result.ok) {
          toast.success("You joined through a referral. Welcome to TradeMall!");
          clearStoredReferralCode();
        } else if (!RETRY_REASONS.has(result.reason ?? "")) {
          clearStoredReferralCode();
        }
      })
      .catch(() => {
        // offline / server hiccup: keep the code and try again next time
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

/** Small confirmation on the sign-up form when the visitor arrived through a referral link. */
export function ReferralSignupNotice() {
  const [code, setCode] = useState<string | null>(null);
  // Read after mount only, so the server and first client render match.
  useEffect(() => setCode(readStoredReferralCode()), []);
  if (!code) return null;
  return (
    <div
      role="status"
      className="mb-4 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-foreground"
    >
      You're joining through a referral link
      <span className="ml-1 font-mono text-xs text-muted-foreground">({code})</span>. Your referrer is linked
      automatically when you sign up.
    </div>
  );
}
