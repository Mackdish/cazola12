import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { Files, Megaphone, Sparkles, TrendingUp, Wallet, MousePointerClick, Eye, DollarSign, Activity } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MetricCard } from "@/components/patterns/metric-card";
import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/patterns/states";
import { StatusBadge } from "@/components/patterns/status-badge";
import { CampaignDialog } from "@/components/advertiser/campaign-dialog";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import {
  useAdvertiserAds,
  useAdvertiserOrg,
  useAdvertiserProfile,
  useCampaigns,
  useCreatives,
} from "@/hooks/use-advertiser";
import { useAdvertiserAnalytics } from "@/hooks/use-analytics";
import { useBillingSettings, useWallet } from "@/hooks/use-billing";
import { campaignStatusLabel, campaignStatusTone, formatCurrency } from "@/lib/advertiser-domain";

export const Route = createFileRoute("/_authenticated/advertiser/")({
  head: () => ({
    meta: [
      { title: "Advertiser overview — TradeMall" },
      {
        name: "description",
        content: "Campaign health, creative inventory and review status at a glance.",
      },
      { property: "og:title", content: "Advertiser overview — TradeMall" },
      {
        property: "og:description",
        content: "Campaign health, creative inventory and review status at a glance.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdvertiserOverviewPage,
});

const DEFAULT_DATE_RANGE = {
  from: format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
  to: format(new Date(), "yyyy-MM-dd"),
};

function AdvertiserOverviewPage() {
  const { organizationId } = useAdvertiserOrg();
  const profile = useAdvertiserProfile(organizationId);
  const campaigns = useCampaigns(organizationId);
  const ads = useAdvertiserAds(organizationId);
  const creatives = useCreatives(organizationId);
  const wallet = useWallet(organizationId);
  const billing = useBillingSettings();
  const analytics = useAdvertiserAnalytics({
    organizationId: organizationId!,
    dateRange: DEFAULT_DATE_RANGE,
  });

  const currency = billing.data?.currency ?? "USD";

  const rows = campaigns.data ?? [];
  const live = rows.filter((row) => row.status === "active").length;
  const inReview = rows.filter((row) => row.status === "pending_review").length;
  const budget = rows.reduce((sum, row) => sum + Number(row.total_budget ?? 0), 0);

  const summary = analytics.data?.summary;
  const balance = wallet.data?.balance ?? 0;

  return (
    <WorkspaceGuard workspace="advertiser">
      <PageHeader
        eyebrow="Advertiser"
        title="Dashboard"
        description="Monitor your campaign performance, spend, and creative inventory."
        actions={<CampaignDialog organizationId={organizationId} />}
      />

      {campaigns.isLoading ? (
        <LoadingState rows={3} label="Loading your dashboard" />
      ) : campaigns.error ? (
        <ErrorState
          title="Couldn't load dashboard"
          message={campaigns.error.message}
          onRetry={() => void campaigns.refetch()}
        />
      ) : !profile.data ? (
        <EmptyState
          icon={<Megaphone className="size-5" />}
          title="Finish your advertiser profile"
          description="Add your business details so campaigns can be reviewed and approved."
          action={
            <Button asChild>
              <Link to="/advertiser/settings">Go to settings</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Spend (30d)"
              value={formatCurrency(summary?.spend ?? 0, currency)}
              hint={`${summary?.impressions?.toLocaleString() ?? 0} impressions`}
              icon={<DollarSign className="size-4" />}
            />
            <MetricCard
              label="Impressions"
              value={summary?.impressions?.toLocaleString() ?? "—"}
              hint={`${summary?.clicks?.toLocaleString() ?? 0} clicks`}
              icon={<Eye className="size-4" />}
            />
            <MetricCard
              label="CTR"
              value={summary?.ctr ? `${(summary.ctr * 100).toFixed(2)}%` : "—"}
              hint="Click-through rate"
              icon={<MousePointerClick className="size-4" />}
            />
            <MetricCard
              label="Available balance"
              value={formatCurrency(balance, currency)}
              hint={`${live} active campaigns`}
              icon={<Wallet className="size-4" />}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="CPC"
              value={summary?.cpc ? formatCurrency(summary.cpc, currency) : "—"}
              hint="Cost per click"
              icon={<Activity className="size-4" />}
            />
            <MetricCard
              label="CPM"
              value={summary?.cpm ? formatCurrency(summary.cpm, currency) : "—"}
              hint="Cost per 1k impressions"
              icon={<TrendingUp className="size-4" />}
            />
            <MetricCard
              label="Campaigns"
              value={String(rows.length)}
              hint={`${live} running · ${inReview} in review`}
              icon={<Sparkles className="size-4" />}
            />
            <MetricCard
              label="Creatives"
              value={String(creatives.data?.length ?? 0)}
              hint={`${ads.data?.length ?? 0} ads built`}
              icon={<Files className="size-4" />}
            />
          </div>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight">Recent campaigns</h2>
              <Button asChild size="sm" variant="ghost">
                <Link to="/advertiser/campaigns">View all</Link>
              </Button>
            </div>
            {rows.length === 0 ? (
              <EmptyState
                icon={<Sparkles className="size-5" />}
                title="No campaigns yet"
                description="Create your first campaign, add an ad and submit it for review."
                action={<CampaignDialog organizationId={organizationId} />}
              />
            ) : (
              <div className="grid gap-3">
                {rows.slice(0, 5).map((campaign) => (
                  <Card
                    key={campaign.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        to="/advertiser/campaigns/$campaignId"
                        params={{ campaignId: campaign.id }}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {campaign.name}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {campaign.adCount} ads · {formatCurrency(campaign.total_budget, currency)} budget
                      </p>
                    </div>
                    <StatusBadge tone={campaignStatusTone(campaign.status)}>
                      {campaignStatusLabel(campaign.status)}
                    </StatusBadge>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </WorkspaceGuard>
  );
}
