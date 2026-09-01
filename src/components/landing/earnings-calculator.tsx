import { useMemo, useState } from "react";
import { Info, Wallet } from "lucide-react";

import { Slider } from "@/components/ui/slider";
import { useBillingSettings } from "@/hooks/use-billing";

const MIN_VIEWS = 1_000;
const MAX_VIEWS = 500_000;

/**
 * Interactive publisher-earnings estimator.
 * Uses the platform's real, currently-configured revenue share, CPC, and
 * assumed CTR (the same values shown on /pricing) — never invented figures.
 * Clearly labeled as an estimate since actual earnings vary with traffic quality.
 */
export function EarningsCalculator() {
  const settings = useBillingSettings();
  const [monthlyPageviews, setMonthlyPageviews] = useState(20_000);

  const currency = settings.data?.currency ?? "KES";
  const cpc = settings.data?.startingCpc ?? 5;
  const assumedCtr = settings.data?.assumedCtr ?? 0.01;
  const revenueShare = settings.data?.publisherRevenueShare ?? 0.4;

  const estimate = useMemo(() => {
    const estimatedClicks = monthlyPageviews * assumedCtr;
    const grossRevenue = estimatedClicks * cpc;
    const publisherEarnings = grossRevenue * revenueShare;
    return { estimatedClicks, publisherEarnings };
  }, [monthlyPageviews, assumedCtr, cpc, revenueShare]);

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-lg sm:p-8">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-success/10 text-success">
          <Wallet className="size-5" />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Earnings estimator</h3>
          <p className="text-xs text-muted-foreground">Based on TradeMall's current rate card</p>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground" htmlFor="pageviews-slider">
            Monthly pageviews
          </label>
          <span className="text-numeric text-sm font-semibold text-foreground">
            {monthlyPageviews.toLocaleString()}
          </span>
        </div>
        <Slider
          id="pageviews-slider"
          className="mt-4"
          min={MIN_VIEWS}
          max={MAX_VIEWS}
          step={1_000}
          value={[monthlyPageviews]}
          onValueChange={(values) => setMonthlyPageviews(values[0] ?? monthlyPageviews)}
        />
        <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
          <span>{MIN_VIEWS.toLocaleString()}</span>
          <span>{MAX_VIEWS.toLocaleString()}+</span>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-muted/50 p-4">
          <p className="text-eyebrow">Est. clicks / mo</p>
          <p className="text-numeric mt-1 text-xl font-semibold text-foreground">
            {Math.round(estimate.estimatedClicks).toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl bg-success/10 p-4">
          <p className="text-eyebrow text-success">Est. earnings / mo</p>
          <p className="text-numeric mt-1 text-xl font-semibold text-success">
            {currency} {Math.round(estimate.publisherEarnings).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <p>
          Illustrative estimate using TradeMall's current CPC ({currency} {cpc}/click), a{" "}
          {(assumedCtr * 100).toFixed(1)}% assumed click-through rate, and a{" "}
          {(revenueShare * 100).toFixed(0)}% publisher revenue share. Actual earnings depend on your
          traffic, audience, and ad placement.
        </p>
      </div>
    </div>
  );
}
