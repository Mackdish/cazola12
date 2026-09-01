import { CheckCircle2 } from "lucide-react";

import { useInView } from "@/hooks/use-in-view";
import { cn } from "@/lib/utils";

/** macOS-style browser chrome wrapper used to frame product interface mockups. */
export function BrowserFrame({
  title,
  status,
  children,
  className,
}: {
  title: string;
  status?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card shadow-xl overflow-hidden",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-3">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-destructive/50" />
          <span className="size-2.5 rounded-full bg-warning/50" />
          <span className="size-2.5 rounded-full bg-success/50" />
        </div>
        <div className="ml-2 flex-1 truncate rounded-md bg-background px-3 py-1 text-xs text-muted-foreground">
          {title}
        </div>
        {status ? (
          <span className="flex shrink-0 items-center gap-1 text-xs text-success">
            <CheckCircle2 className="size-3" />
            {status}
          </span>
        ) : null}
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </div>
  );
}

const CAMPAIGN_ROWS = [
  { name: "Nairobi Launch Push", format: "Rectangle · CPC", trend: 72 },
  { name: "Lagos Weekend Boost", format: "Banner · CPM", trend: 54 },
  { name: "Kampala Retarget", format: "Responsive · CPC", trend: 88 },
];

/** Illustrative advertiser campaign dashboard mockup. */
export function AdvertiserDashboardMock() {
  return (
    <BrowserFrame title="app.trademall.co.ke/advertiser" status="Live">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-eyebrow">Campaign performance</p>
          <p className="mt-1 text-xs text-muted-foreground">Illustrative preview</p>
        </div>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          3 campaigns active
        </span>
      </div>
      <div className="mt-5 space-y-3">
        {CAMPAIGN_ROWS.map((row) => (
          <div key={row.name} className="rounded-xl border border-border p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">{row.name}</span>
              <span className="text-xs text-muted-foreground">{row.format}</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-mkt-blue transition-all duration-1000"
                style={{ width: `${row.trend}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </BrowserFrame>
  );
}

const EARNINGS_ROWS = [
  { site: "nairobi-daily.co.ke", zone: "Sidebar Rectangle", share: 64 },
  { site: "techkenya.news", zone: "In-article Banner", share: 41 },
  { site: "sportspulse.co.ke", zone: "Mobile Sticky", share: 79 },
];

/** Illustrative publisher earnings dashboard mockup. */
export function PublisherDashboardMock() {
  return (
    <BrowserFrame title="app.trademall.co.ke/publisher" status="Live">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-eyebrow">Earnings by zone</p>
          <p className="mt-1 text-xs text-muted-foreground">Illustrative preview</p>
        </div>
        <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
          Payouts on schedule
        </span>
      </div>
      <div className="mt-5 space-y-3">
        {EARNINGS_ROWS.map((row) => (
          <div key={row.site} className="rounded-xl border border-border p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">{row.site}</span>
              <span className="text-xs text-muted-foreground">{row.zone}</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-success to-mkt-emerald transition-all duration-1000"
                style={{ width: `${row.share}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </BrowserFrame>
  );
}

const CHART_BARS = [38, 52, 45, 61, 58, 74, 69, 82, 77, 91, 88, 96];

/**
 * Lightweight, dependency-free animated bar chart for the analytics section.
 * Illustrative data only — clearly labeled. Uses transform/opacity so it stays cheap.
 */
export function AnalyticsChartMock() {
  const { ref, inView } = useInView();

  return (
    <BrowserFrame title="app.trademall.co.ke/analytics" status="Updated live">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-eyebrow">Impressions & clicks trend</p>
          <p className="mt-1 text-xs text-muted-foreground">Illustrative 12-week trend</p>
        </div>
      </div>
      <div ref={ref} className="mt-6 flex h-40 items-end gap-1.5 sm:gap-2">
        {CHART_BARS.map((value, i) => (
          <div
            key={i}
            className="flex-1 origin-bottom rounded-t-md bg-gradient-to-t from-primary to-mkt-blue transition-transform duration-700 ease-out motion-reduce:transition-none"
            style={{
              height: "100%",
              transform: inView ? `scaleY(${value / 100})` : "scaleY(0.04)",
              transitionDelay: `${i * 40}ms`,
            }}
          />
        ))}
      </div>
      <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-gradient-to-r from-primary to-mkt-blue" />
          Impressions
        </span>
        <span>CTR, spend, and revenue tracked in the same dashboard</span>
      </div>
    </BrowserFrame>
  );
}
