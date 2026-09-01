import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import {
  Building2,
  DollarSign,
  Megaphone,
  ShieldCheck,
  Users,
  Wallet,
  TrendingUp,
  Eye,
  MousePointerClick,
  BarChart3,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MetricCard } from "@/components/patterns/metric-card";
import { PageHeader } from "@/components/patterns/page-header";
import { StatusBadge, type StatusTone } from "@/components/patterns/status-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/patterns/states";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import { useAdminAdvertisers } from "@/hooks/use-advertiser";
import { useAdminCampaigns } from "@/hooks/use-advertiser";
import { useAdminPublishers } from "@/hooks/use-publisher";
import { useAdminAnalytics } from "@/hooks/use-analytics";
import { useAdminLedger, useAdminPayouts, useBillingSettings } from "@/hooks/use-billing";
import { campaignStatusLabel, campaignStatusTone, formatCurrency } from "@/lib/advertiser-domain";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Network overview — Platform Admin — TradeMall" },
      {
        name: "description",
        content: "Operate the TradeMall network: organizations, inventory, moderation and finance.",
      },
      { property: "og:title", content: "Network overview — Platform Admin — TradeMall" },
      {
        property: "og:description",
        content: "Operate the TradeMall network from a single control surface.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminOverview,
});

const DEFAULT_DATE_RANGE = {
  from: format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
  to: format(new Date(), "yyyy-MM-dd"),
};

function AdminOverview() {
  const billing = useBillingSettings();
  const advertisers = useAdminAdvertisers();
  const publishers = useAdminPublishers();
  const campaigns = useAdminCampaigns();
  const analytics = useAdminAnalytics({ dateRange: DEFAULT_DATE_RANGE });
  const ledger = useAdminLedger();
  const payouts = useAdminPayouts();

  const pendingReview = useMemo(
    () => (campaigns.data ?? []).filter((c) => c.status === "pending_review").length,
    [campaigns.data],
  );

  const pendingPayouts = useMemo(
    () => (payouts.data ?? []).filter((p) => p.status === "pending").length,
    [payouts.data],
  );

  const STATUS_TONE: Record<string, StatusTone> = {
    active: "active",
    pending: "pending",
    suspended: "suspended",
  };

  const recentCampaigns = useMemo(
    () =>
      [...(campaigns.data ?? [])]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 5),
    [campaigns.data],
  );

  const recentAdvertisers = useMemo(
    () =>
      [...(advertisers.data ?? [])]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 5),
    [advertisers.data],
  );

  const summary = analytics.data?.summary;
  const ledgerRows = (ledger.data?.transactions ?? []) as unknown as Array<{ amount: number; publisher_amount: number; platform_amount: number }>;
  const totalSpend = ledgerRows.reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const totalPublisherEarnings = ledgerRows.reduce((s, r) => s + Number(r.publisher_amount ?? 0), 0);
  const totalPlatformRevenue = ledgerRows.reduce((s, r) => s + Number(r.platform_amount ?? 0), 0);

  return (
    <WorkspaceGuard workspace="admin">
      <PageHeader
        eyebrow="Platform Admin"
        title="Network overview"
        description="The health of both sides of the marketplace: who joined, what is live, and where money moved."
        actions={
          <Button asChild size="sm" variant="outline">
            <Link to="/admin/settings">Platform settings</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Advertisers"
          value={String(advertisers.data?.length ?? 0)}
          hint="Demand organizations"
          icon={<Megaphone className="size-4" />}
        />
        <MetricCard
          label="Publishers"
          value={String(publishers.data?.length ?? 0)}
          hint="Supply organizations"
          icon={<Building2 className="size-4" />}
        />
        <MetricCard
          label="Campaigns"
          value={String(campaigns.data?.length ?? 0)}
          hint="Total campaigns"
          icon={<BarChart3 className="size-4" />}
        />
        <MetricCard
          label="Pending review"
          value={String(pendingReview)}
          hint="Awaiting moderation"
          icon={<ShieldCheck className="size-4" />}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Impressions (30d)"
          value={summary?.totalImpressions?.toLocaleString() ?? "—"}
          hint={`${summary?.totalClicks?.toLocaleString() ?? 0} clicks`}
          icon={<Eye className="size-4" />}
        />
        <MetricCard
          label="CTR"
          value={summary?.ctr ? `${(summary.ctr * 100).toFixed(2)}%` : "—"}
          hint="Click-through rate"
          icon={<MousePointerClick className="size-4" />}
        />
        <MetricCard
          label="Advertiser spend"
          value={formatCurrency(totalSpend, billing.data?.currency ?? "USD")}
          hint="Total billed"
          icon={<DollarSign className="size-4" />}
        />
        <MetricCard
          label="Platform revenue"
          value={formatCurrency(totalPlatformRevenue, billing.data?.currency ?? "USD")}
          hint="Net margin"
          icon={<Wallet className="size-4" />}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Publisher earnings"
          value={formatCurrency(totalPublisherEarnings, billing.data?.currency ?? "USD")}
          hint="Owed to supply"
          icon={<TrendingUp className="size-4" />}
        />
        <MetricCard
          label="Pending payouts"
          value={String(pendingPayouts)}
          hint="Awaiting approval"
          icon={<Wallet className="size-4" />}
        />
        <MetricCard
          label="Websites"
          value={String(summary?.totalWebsites ?? 0)}
          hint="Verified domains"
          icon={<Building2 className="size-4" />}
        />
        <MetricCard
          label="Active campaigns"
          value={String(summary?.activeCampaigns ?? 0)}
          hint="Currently running"
          icon={<Megaphone className="size-4" />}
        />
      </div>

      {(advertisers.isLoading || publishers.isLoading || campaigns.isLoading || analytics.isLoading) ? (
        <LoadingState rows={3} label="Loading network data" />
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Recent campaigns</h3>
              <Button asChild size="sm" variant="ghost">
                <Link to="/admin/campaigns">View all</Link>
              </Button>
            </div>
            <div className="mt-4 space-y-3">
              {recentCampaigns.map((campaign) => (
                <Card key={campaign.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{campaign.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {campaign.advertisers?.business_name ?? "—"} ·{" "}
                        {new Date(campaign.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <StatusBadge tone={campaignStatusTone(campaign.status)}>
                      {campaignStatusLabel(campaign.status)}
                    </StatusBadge>
                  </div>
                </Card>
              ))}
              {recentCampaigns.length === 0 && (
                <p className="text-sm text-muted-foreground">No campaigns yet.</p>
              )}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Recent advertisers</h3>
              <Button asChild size="sm" variant="ghost">
                <Link to="/admin/advertisers">View all</Link>
              </Button>
            </div>
            <div className="mt-4 space-y-3">
              {recentAdvertisers.map((advertiser) => (
                <Card key={advertiser.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{advertiser.business_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {advertiser.organizations?.name ?? "—"} · Joined{" "}
                        {new Date(advertiser.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <StatusBadge tone={STATUS_TONE[advertiser.status] ?? "neutral"}>
                      {advertiser.status}
                    </StatusBadge>
                  </div>
                </Card>
              ))}
              {recentAdvertisers.length === 0 && (
                <p className="text-sm text-muted-foreground">No advertisers yet.</p>
              )}
            </div>
          </section>
        </div>
      )}
    </WorkspaceGuard>
  );
}
