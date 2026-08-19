import { useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  Area,
  AreaChart,
  Line,
  LineChart,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";

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
import { CsvExportButton, MetricCard } from "@/components/analytics/analytics-filters";
import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/patterns/states";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import { usePublisherOrg } from "@/hooks/use-publisher";
import { useBillingSettings } from "@/hooks/use-billing";
import { useExportPublisherAnalytics, usePublisherAnalytics } from "@/hooks/use-analytics";
import { format } from "date-fns";
import type {
  BreakdownRow,
  PublisherAnalyticsFilters,
  PublisherTimeSeriesPoint,
} from "@/lib/analytics-service.server";

const IMPRESSIONS_CHART_CONFIG = {
  impressions: { label: "Impressions", color: "var(--color-primary)" },
  clicks: { label: "Clicks", color: "var(--color-chart-2)" },
} satisfies ChartConfig;

const EARNINGS_CHART_CONFIG = {
  earnings: { label: "Earnings", color: "var(--color-chart-3)" },
} satisfies ChartConfig;

const CTR_CHART_CONFIG = {
  ctr: { label: "CTR", color: "var(--color-chart-4)" },
} satisfies ChartConfig;

export const Route = createFileRoute("/_authenticated/publisher/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Publisher — TradeMall" },
      { name: "description", content: "Fill rate, impressions, clicks and effective CPM." },
      { property: "og:title", content: "Analytics — Publisher — TradeMall" },
      { property: "og:description", content: "Fill rate, impressions, clicks and effective CPM." },
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
  const { organizationId } = usePublisherOrg();
  const [dateRange, setDateRange] = useState<PublisherAnalyticsFilters["dateRange"]>({
    from: toDateString(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)),
    to: toDateString(new Date()),
  });

  const filters: PublisherAnalyticsFilters = useMemo(
    () => ({ organizationId: organizationId!, dateRange }),
    [organizationId, dateRange],
  );

  const analytics = usePublisherAnalytics(filters);
  const exportMutation = useExportPublisherAnalytics();
  const currency = billing.data?.currency ?? "USD";

  const handleExport = async () => {
    const result = await exportMutation.mutateAsync(filters);
    downloadCsv(result.csv, result.filename);
  };

  if (analytics.isLoading) {
    return (
      <WorkspaceGuard workspace="publisher">
        <PageHeader
          eyebrow="Publisher"
          title="Analytics"
          description="Fill rate, impressions, clicks and effective CPM."
        />
        <LoadingState rows={4} label="Loading analytics" />
      </WorkspaceGuard>
    );
  }

  if (analytics.error || !analytics.data) {
    return (
      <WorkspaceGuard workspace="publisher">
        <PageHeader
          eyebrow="Publisher"
          title="Analytics"
          description="Fill rate, impressions, clicks and effective CPM."
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
    <WorkspaceGuard workspace="publisher">
      <PageHeader
        eyebrow="Publisher"
        title="Analytics"
        description="Fill rate, impressions, clicks and effective CPM."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <CsvExportButton onExport={handleExport} disabled={exportMutation.isPending} />
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Impressions" value={data.summary.impressions} hint="Selected period" />
        <MetricCard label="Clicks" value={data.summary.clicks} hint="Selected period" />
        <MetricCard
          label="CTR"
          value={data.summary.ctr}
          hint="Click-through rate"
          format="percent"
        />
        <MetricCard
          label="Earnings"
          value={data.summary.earnings}
          hint="Selected period"
          format="currency"
        />
        <MetricCard
          label="RPM"
          value={data.summary.rpm}
          hint="Revenue per 1k impressions"
          format="currency"
        />
      </div>

      <Tabs defaultValue="time" className="mt-6">
        <TabsList>
          <TabsTrigger value="time">Over time</TabsTrigger>
          <TabsTrigger value="websites">Top websites</TabsTrigger>
          <TabsTrigger value="zones">Top zones</TabsTrigger>
          <TabsTrigger value="daily">Daily earnings</TabsTrigger>
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
                <CardTitle className="text-base font-semibold">Earnings over time</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={EARNINGS_CHART_CONFIG} className="aspect-[2/1]">
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
                        dataKey="earnings"
                        stroke="var(--color-earnings)"
                        fill="var(--color-earnings)"
                        fillOpacity={0.2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">CTR over time</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={CTR_CHART_CONFIG} className="aspect-[2/1]">
                  <ResponsiveContainer>
                    <LineChart data={data.timeSeries}>
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => format(new Date(v), "MMM d")}
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => `${(v * 100).toFixed(1)}%`}
                      />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            formatter={(value: unknown) => `${(Number(value) * 100).toFixed(2)}%`}
                          />
                        }
                      />
                      <Line
                        type="monotone"
                        dataKey="ctr"
                        stroke="var(--color-ctr)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">RPM over time</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={EARNINGS_CHART_CONFIG} className="aspect-[2/1]">
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
                        dataKey="rpm"
                        stroke="var(--color-earnings)"
                        fill="var(--color-earnings)"
                        fillOpacity={0.2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="websites">
          <BreakdownTable
            rows={data.topWebsites}
            columns={["Impressions", "Clicks", "CTR", "Earnings", "RPM"]}
            formatCtr
          />
        </TabsContent>

        <TabsContent value="zones">
          <BreakdownTable
            rows={data.topZones}
            columns={["Impressions", "Clicks", "CTR"]}
            formatCtr
          />
        </TabsContent>

        <TabsContent value="daily">
          <BreakdownTable rows={data.dailyEarnings} columns={["Earnings"]} currency={currency} />
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
