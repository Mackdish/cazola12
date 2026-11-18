import { useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, Area, AreaChart, XAxis, YAxis, ResponsiveContainer } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  AnalyticsDateFilter,
  CsvExportButton,
  MetricCard,
} from "@/components/analytics/analytics-filters";
import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/patterns/states";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import { useAdminAnalytics, useAdminCampaignInsights, useExportAdminAnalytics } from "@/hooks/use-analytics";
import { useBillingSettings } from "@/hooks/use-billing";
import { format } from "date-fns";
import type {
  AdminAnalyticsFilters,
  BreakdownRow,
  TimeSeriesPoint,
} from "@/lib/analytics-service.server";

const IMPRESSIONS_CHART_CONFIG = {
  impressions: { label: "Impressions", color: "var(--color-primary)" },
  clicks: { label: "Clicks", color: "var(--color-chart-2)" },
} satisfies ChartConfig;

const SPEND_CHART_CONFIG = {
  spend: { label: "Spend", color: "var(--color-chart-3)" },
} satisfies ChartConfig;

export const Route = createFileRoute("/_authenticated/admin/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Platform Admin — TradeMall" },
      { name: "description", content: "Network delivery, revenue and quality analytics." },
      { property: "og:title", content: "Analytics — Platform Admin — TradeMall" },
      { property: "og:description", content: "Network delivery, revenue and quality analytics." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

function toDateString(date: Date): string {
  return date.toISOString().split("T")[0] ?? date.toISOString();
}

function Page() {
  const billing = useBillingSettings();
  const [dateRange, setDateRange] = useState<AdminAnalyticsFilters["dateRange"]>({
    from: toDateString(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)),
    to: toDateString(new Date()),
  });

  const filters: AdminAnalyticsFilters = useMemo(() => ({ dateRange }), [dateRange]);

  const analytics = useAdminAnalytics(filters);
  const campaignInsights = useAdminCampaignInsights(filters);
  const exportMutation = useExportAdminAnalytics();
  const currency = billing.data?.currency ?? "USD";

  const handleExport = async () => {
    const result = await exportMutation.mutateAsync(filters);
    downloadCsv(result.csv, result.filename);
  };

  if (analytics.isLoading) {
    return (
      <WorkspaceGuard workspace="admin">
        <PageHeader
          eyebrow="Platform Admin"
          title="Analytics"
          description="Network delivery, revenue and quality analytics."
        />
        <LoadingState rows={4} label="Loading analytics" />
      </WorkspaceGuard>
    );
  }

  if (analytics.error || !analytics.data) {
    return (
      <WorkspaceGuard workspace="admin">
        <PageHeader
          eyebrow="Platform Admin"
          title="Analytics"
          description="Network delivery, revenue and quality analytics."
        />
        <ErrorState
          title="Couldn't load analytics"
          message={analytics.error?.message ?? "Something went wrong."}
          onRetry={() => void analytics.refetch()}
        />
      </WorkspaceGuard>
    );
  }

  const data = analytics.data;

  return (
    <WorkspaceGuard workspace="admin">
      <PageHeader
        eyebrow="Platform Admin"
        title="Analytics"
        description="Network delivery, revenue and quality analytics."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AnalyticsDateFilter value={dateRange} onChange={setDateRange} />
            <CsvExportButton onExport={handleExport} disabled={exportMutation.isPending} />
            {campaignInsights.data && (
              <Button variant="outline" onClick={() => downloadInsightsCsv(campaignInsights.data!, dateRange)}>
                Export detailed report
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total advertisers"
          value={data.summary.totalAdvertisers}
          hint="Registered"
        />
        <MetricCard
          label="Total publishers"
          value={data.summary.totalPublishers}
          hint="Registered"
        />
        <MetricCard
          label="Active campaigns"
          value={data.summary.activeCampaigns}
          hint="Running or approved"
        />
        <MetricCard label="Total websites" value={data.summary.totalWebsites} hint="Registered" />
        <MetricCard
          label="Total impressions"
          value={data.summary.totalImpressions}
          hint="Selected period"
        />
        <MetricCard label="Total clicks" value={data.summary.totalClicks} hint="Selected period" />
        <MetricCard
          label="Advertiser spend"
          value={data.summary.totalAdvertiserSpend}
          hint="Selected period"
          format="currency"
        />
        <MetricCard
          label="Publisher earnings"
          value={data.summary.publisherEarnings}
          hint="Selected period"
          format="currency"
        />
        <MetricCard
          label="Platform revenue"
          value={data.summary.platformRevenue}
          hint="Selected period"
          format="currency"
        />
        <MetricCard label="CTR" value={data.summary.ctr} hint="Network-wide" format="percent" />
      </div>

      <Tabs defaultValue="time" className="mt-6">
        <TabsList>
          <TabsTrigger value="time">Over time</TabsTrigger>
          <TabsTrigger value="publishers">Top publishers</TabsTrigger>
          <TabsTrigger value="advertisers">Top advertisers</TabsTrigger>
          <TabsTrigger value="campaigns">Top campaigns</TabsTrigger>
          <TabsTrigger value="campaign-detail">Campaign intelligence</TabsTrigger>
          <TabsTrigger value="audience">Audience & geography</TabsTrigger>
        </TabsList>

        <TabsContent value="time" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  Impressions and clicks over time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={IMPRESSIONS_CHART_CONFIG} className="aspect-[2/1]">
                  <ResponsiveContainer>
                    <BarChart data={data.timeSeries}>
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => format(new Date(v), "MMM d")}
                      />
                      <YAxis tick={{ fontSize: 11 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Bar
                        dataKey="impressions"
                        fill="var(--color-impressions)"
                        radius={[2, 2, 0, 0]}
                      />
                      <Bar dataKey="clicks" fill="var(--color-clicks)" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Spend over time</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={SPEND_CHART_CONFIG} className="aspect-[2/1]">
                  <ResponsiveContainer>
                    <AreaChart data={data.timeSeries}>
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => format(new Date(v), "MMM d")}
                      />
                      <YAxis tick={{ fontSize: 11 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area
                        type="monotone"
                        dataKey="spend"
                        stroke="var(--color-spend)"
                        fill="var(--color-spend)"
                        fillOpacity={0.2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="publishers">
          <BreakdownTable
            rows={data.topPublishers}
            columns={["Impressions", "Clicks", "CTR", "Earnings", "RPM"]}
            formatCtr
            currency={currency}
          />
        </TabsContent>

        <TabsContent value="advertisers">
          <BreakdownTable
            rows={data.topAdvertisers}
            columns={["Impressions", "Clicks", "CTR", "Spend"]}
            formatCtr
            currency={currency}
          />
        </TabsContent>

        <TabsContent value="campaigns">
          <BreakdownTable
            rows={data.topCampaigns}
            columns={["Impressions", "Clicks", "CTR", "Spend"]}
            formatCtr
            currency={currency}
          />
        </TabsContent>

        <TabsContent value="campaign-detail" className="space-y-4">
          {campaignInsights.isLoading ? (
            <LoadingState rows={4} label="Loading campaign intelligence" />
          ) : campaignInsights.error ? (
            <ErrorState title="Couldn't load campaign details" message={campaignInsights.error.message} onRetry={() => void campaignInsights.refetch()} />
          ) : (
            <CampaignIntelligenceTable campaigns={campaignInsights.data?.campaigns ?? []} currency={currency} />
          )}
        </TabsContent>

        <TabsContent value="audience" className="space-y-4">
          {campaignInsights.isLoading ? (
            <LoadingState rows={3} label="Loading audience insights" />
          ) : campaignInsights.error ? (
            <ErrorState title="Couldn't load audience insights" message={campaignInsights.error.message} onRetry={() => void campaignInsights.refetch()} />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <InsightBreakdown title="Visitor countries" rows={campaignInsights.data?.countries ?? []} />
              <InsightBreakdown title="Devices" rows={campaignInsights.data?.devices ?? []} />
              <InsightBreakdown title="Browsers" rows={campaignInsights.data?.browsers ?? []} />
              <InsightBreakdown title="Operating systems" rows={campaignInsights.data?.operatingSystems ?? []} />
              <InsightBreakdown title="Top publisher websites" rows={campaignInsights.data?.publishers ?? []} />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </WorkspaceGuard>
  );
}

function BreakdownTable({
  rows,
  columns,
  formatCtr = false,
  currency = "USD",
}: {
  rows: BreakdownRow[];
  columns: string[];
  formatCtr?: boolean;
  currency?: string;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<BarChart3 className="size-5" />}
        title="No data"
        description="There are no results for the selected filters."
      />
    );
  }

  return (
    <div className="rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="h-10 px-4 text-left font-medium text-muted-foreground">Name</th>
            <th className="h-10 px-4 text-right font-medium text-muted-foreground">Impressions</th>
            <th className="h-10 px-4 text-right font-medium text-muted-foreground">Clicks</th>
            {formatCtr && (
              <th className="h-10 px-4 text-right font-medium text-muted-foreground">CTR</th>
            )}
            {columns.includes("Spend") && (
              <th className="h-10 px-4 text-right font-medium text-muted-foreground">Spend</th>
            )}
            {columns.includes("Earnings") && (
              <th className="h-10 px-4 text-right font-medium text-muted-foreground">Earnings</th>
            )}
            {columns.includes("RPM") && (
              <th className="h-10 px-4 text-right font-medium text-muted-foreground">RPM</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b last:border-0 hover:bg-muted/40">
              <td className="p-4 align-middle font-medium">{row.name}</td>
              <td className="p-4 align-middle text-right tabular-nums">
                {row.impressions.toLocaleString()}
              </td>
              <td className="p-4 align-middle text-right tabular-nums">
                {row.clicks.toLocaleString()}
              </td>
              {formatCtr && (
                <td className="p-4 align-middle text-right tabular-nums">
                  {(row.ctr * 100).toFixed(2)}%
                </td>
              )}
              {columns.includes("Spend") && (
                <td className="p-4 align-middle text-right tabular-nums">
                  {new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
                    row.spend,
                  )}
                </td>
              )}
              {columns.includes("Earnings") && (
                <td className="p-4 align-middle text-right tabular-nums">
                  {new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
                    row.earnings,
                  )}
                </td>
              )}
              {columns.includes("RPM") && (
                <td className="p-4 align-middle text-right tabular-nums">
                  {new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
                    row.rpm,
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}


type CampaignInsightRow = {
  id: string; name: string; status: string; objective: string | null;
  bidType: string | null; bidAmount: number; dailyBudget: number; totalBudget: number;
  spentAmount: number; impressions: number; clicks: number; conversions: number;
  ctr: number; cpc: number; cpm: number; remainingBudget: number;
  startDate: string | null; endDate: string | null; advertiserId: string | null;
};

function CampaignIntelligenceTable({ campaigns, currency }: { campaigns: CampaignInsightRow[]; currency: string }) {
  if (campaigns.length === 0) return <EmptyState icon={<BarChart3 className="size-5" />} title="No campaigns found" description="Campaign records will appear here when available." />;
  const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">All campaigns with delivery and budget performance for the selected date range. Budget totals reflect campaign configuration; delivery metrics use the selected period.</p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[1180px] text-sm">
          <thead><tr className="border-b bg-muted/40 text-left text-muted-foreground">
            {["Campaign","Status","Objective","Impressions","Clicks","CTR","Conversions","Spend","CPC","CPM","Budget left"].map((label) => <th key={label} className="whitespace-nowrap px-3 py-3 font-medium">{label}</th>)}
          </tr></thead>
          <tbody>{campaigns.map((campaign) => <tr key={campaign.id} className="border-b last:border-0 hover:bg-muted/30">
            <td className="max-w-[220px] px-3 py-3"><div className="truncate font-medium">{campaign.name}</div><div className="text-xs text-muted-foreground">{campaign.id.slice(0, 8)}</div></td>
            <td className="px-3 py-3 capitalize">{campaign.status.replaceAll("_", " ")}</td>
            <td className="px-3 py-3">{campaign.objective ?? "—"}</td>
            <td className="px-3 py-3 text-right tabular-nums">{campaign.impressions.toLocaleString()}</td>
            <td className="px-3 py-3 text-right tabular-nums">{campaign.clicks.toLocaleString()}</td>
            <td className="px-3 py-3 text-right tabular-nums">{(campaign.ctr * 100).toFixed(2)}%</td>
            <td className="px-3 py-3 text-right tabular-nums">{campaign.conversions.toLocaleString()}</td>
            <td className="px-3 py-3 text-right tabular-nums">{money(campaign.spentAmount)}</td>
            <td className="px-3 py-3 text-right tabular-nums">{money(campaign.cpc)}</td>
            <td className="px-3 py-3 text-right tabular-nums">{money(campaign.cpm)}</td>
            <td className="px-3 py-3 text-right tabular-nums">{money(campaign.remainingBudget)}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

function InsightBreakdown({ title, rows }: { title: string; rows: { name: string; impressions: number; clicks: number; ctr: number }[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base font-semibold">{title}</CardTitle></CardHeader>
      <CardContent>
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">No recorded data for this period.</p> : (
          <div className="space-y-3">{rows.map((row) => <div key={row.name} className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium">{row.name}</span>
            <span className="shrink-0 text-right tabular-nums text-muted-foreground">{row.impressions.toLocaleString()} impressions</span>
          </div>)}</div>
        )}
      </CardContent>
    </Card>
  );
}


function downloadInsightsCsv(
  data: {
    campaigns: CampaignInsightRow[];
    countries: { name: string; impressions: number }[];
    devices: { name: string; impressions: number }[];
    browsers: { name: string; impressions: number }[];
    operatingSystems: { name: string; impressions: number }[];
    publishers: { name: string; impressions: number }[];
  },
  range: { from: string; to: string },
) {
  const escape = (value: string) => {
    const text = value.replace(/"/g, '""');
    return /[",\\n]/.test(text) ? `"${text}"` : text;
  };
  const lines = [
    "Campaign performance",
    "Campaign,Status,Objective,Impressions,Clicks,CTR,Conversions,Period spend,CPC,CPM,Remaining budget",
    ...data.campaigns.map((row) => [
      escape(row.name), escape(row.status), escape(row.objective ?? ""),
      row.impressions, row.clicks, (row.ctr * 100).toFixed(2) + "%",
      row.conversions, row.spentAmount.toFixed(2), row.cpc.toFixed(4),
      row.cpm.toFixed(4), row.remainingBudget.toFixed(2),
    ].join(",")),
    "",
    "Visitor countries",
    "Country,Impressions",
    ...data.countries.map((row) => [escape(row.name), row.impressions].join(",")),
    "",
    "Devices",
    "Device,Impressions",
    ...data.devices.map((row) => [escape(row.name), row.impressions].join(",")),
    "",
    "Browsers",
    "Browser,Impressions",
    ...data.browsers.map((row) => [escape(row.name), row.impressions].join(",")),
    "",
    "Operating systems",
    "Operating system,Impressions",
    ...data.operatingSystems.map((row) => [escape(row.name), row.impressions].join(",")),
    "",
    "Publisher websites",
    "Website,Impressions",
    ...data.publishers.map((row) => [escape(row.name), row.impressions].join(",")),
  ];
  downloadCsv(lines.join("\\n"), `admin-campaign-insights-${range.from}-to-${range.to}.csv`);
}
