/**
 * Pure helpers for the public pricing page and earnings estimator, so that
 * every public page derives its numbers the same way from platform settings.
 */

/**
 * The revenue share is stored as a fraction (0.4) but the billing RPC also
 * tolerates a whole percentage (40). Normalise both to a 0–1 fraction.
 */
export function normalizeShare(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value > 1 ? value / 100 : value;
}

/** 0.4 -> "40%", 0.425 -> "42.5%". */
export function formatSharePercent(value: number): string {
  const pct = Math.round(normalizeShare(value) * 1000) / 10;
  return `${pct}%`;
}

/**
 * CPM-equivalent of a CPC bid, using the same click-through assumption the ad
 * server uses to put CPC and CPM bids on one scale (see valuePerImpression in
 * ad-serving-domain.ts): value per impression = cpc * ctr.
 */
export function equivalentCpm(cpc: number, assumedCtr: number): number {
  return cpc * assumedCtr * 1000;
}

/** "KES 500", or "No minimum" when no threshold is configured. */
export function describeMinimumPayout(minimum: number, currency: string): string {
  return minimum > 0 ? `${currency} ${minimum.toLocaleString()}` : "No minimum";
}

/** Sentence fragment for running text, e.g. "currently KES 500". */
export function currentMinimumPayoutPhrase(minimum: number, currency: string): string {
  return minimum > 0
    ? `currently ${currency} ${minimum.toLocaleString()}`
    : "currently there is no minimum";
}

/**
 * Publisher earnings are shown as a range because real click-through rates on
 * display ads vary widely. The "High" case is the configured assumed CTR; the
 * others scale it down.
 */
export const EARNINGS_SCENARIOS = [
  { label: "Low", ctrFactor: 0.2 },
  { label: "Mid", ctrFactor: 0.5 },
  { label: "High", ctrFactor: 1 },
] as const;

export function estimateEarnings(input: {
  monthlyPageviews: number;
  assumedCtr: number;
  cpc: number;
  revenueShare: number;
}) {
  const share = normalizeShare(input.revenueShare);
  return EARNINGS_SCENARIOS.map((scenario) => {
    const ctr = input.assumedCtr * scenario.ctrFactor;
    const clicks = input.monthlyPageviews * ctr;
    return {
      label: scenario.label,
      ctr,
      clicks,
      earnings: clicks * input.cpc * share,
    };
  });
}
