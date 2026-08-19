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
import { useAdminAnalytics, useExportAdminAnalytics } from "@/hooks/use-analytics";
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
