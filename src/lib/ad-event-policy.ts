export type ImpressionFraudStatus = "normal" | "suspicious" | "blocked" | "review_required";

/** Blocked fraud verdicts and explicit bot signals must never be billed. */
export function shouldBillImpression(
  fraudStatus: ImpressionFraudStatus,
  isLikelyBot: boolean | null | undefined,
): boolean {
  return fraudStatus !== "blocked" && isLikelyBot !== true;
}

/** A click may only be attributed after a persisted impression exists. */
export function shouldFlushBufferedImpression(
  hasPersistedImpression: boolean,
  bufferingEnabled: boolean,
): boolean {
  return !hasPersistedImpression && bufferingEnabled;
}
