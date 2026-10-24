import { useMemo, useState } from "react";
import { Info, Wallet } from "lucide-react";

import { Slider } from "@/components/ui/slider";
import { useBillingSettings } from "@/hooks/use-billing";
import { estimateEarnings, formatSharePercent, normalizeShare } from "@/lib/public-terms";

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

  const scenarios = useMemo(
    () => estimateEarnings({ monthlyPageviews, assumedCtr, cpc, revenueShare }),
    [monthlyPageviews, assumedCtr, cpc, revenueShare],
  );
  const low = scenarios[0]!;
  const high = scenarios[scenarios.length - 1]!;
  const fmt = (n: number) => Math.round(n).toLocaleString();
  const pct = (ctr: number) => `${(ctr * 100).toFixed(2).replace(/\.?0+$/, "")}%`;
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

      <div className="mt-6 rounded-xl bg-success/10 p-4">
        <p className="text-eyebrow text-success">Est. earnings / mo</p>
        <p className="text-numeric mt-1 text-xl font-semibold text-success">
          {currency} {fmt(low.earnings)} – {fmt(high.earnings)}
        </p>
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Scenario</th>
              <th className="px-3 py-2 text-right font-medium">CTR</th>
              <th className="px-3 py-2 text-right font-medium">Clicks / mo</th>
              <th className="px-3 py-2 text-right font-medium">Earnings / mo</th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map((row) => (
              <tr key={row.label} className="border-t border-border">
                <td className="px-3 py-2 font-medium text-foreground">{row.label}</td>
                <td className="text-numeric px-3 py-2 text-right text-muted-foreground">
                  {pct(row.ctr)}
                </td>
                <td className="text-numeric px-3 py-2 text-right text-muted-foreground">
                  {fmt(row.clicks)}
                </td>
                <td className="text-numeric px-3 py-2 text-right font-semibold text-foreground">
                  {currency} {fmt(row.earnings)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <p>
          Illustrative range using TradeMall's current CPC ({currency} {cpc}/click) and a{" "}
          {formatSharePercent(normalizeShare(revenueShare))} publisher revenue share. Click-through
          rates vary widely by site and placement: the high case uses {pct(high.ctr)}, the low case{" "}
          {pct(low.ctr)}. Assumes one filled ad slot per pageview. Actual earnings depend on your
          traffic, audience, and ad placement.
        </p>
      </div>
    </div>
  );
}
