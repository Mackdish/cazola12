import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { Coins, Globe, Image, TrendingUp, Eye, MousePointerClick, Wallet, Activity } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MetricCard } from "@/components/patterns/metric-card";
import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/patterns/states";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import { useAdZones, usePublisherOrg, useWebsites } from "@/hooks/use-publisher";
import { usePublisherAnalytics } from "@/hooks/use-analytics";
import { useBillingSettings, useWallet } from "@/hooks/use-billing";
import { categoryLabel } from "@/lib/publisher-domain";
import { formatCurrency } from "@/lib/advertiser-domain";

export const Route = createFileRoute("/_authenticated/publisher/")({
  head: () => ({
    meta: [
      { title: "Publisher overview — TradeMall" },
      { name: "description", content: "Monitor website verification, ad zone performance and accrued revenue." },
      { property: "og:title", content: "Publisher overview — TradeMall" },
      { property: "og:description", content: "Monitor website verification, ad zone performance and accrued revenue." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PublisherOverview,
});

const DEFAULT_DATE_RANGE = {
  from: format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
  to: format(new Date(), "yyyy-MM-dd"),
};

function PublisherOverview() {
  const { organizationId } = usePublisherOrg();
  const { data: websites, isLoading: loadingWebsites, error: websitesError } = useWebsites(organizationId);
  const { data: zones, isLoading: loadingZones, error: zonesError } = useAdZones(organizationId);
  const wallet = useWallet(organizationId);
  const billing = useBillingSettings();
  const analytics = usePublisherAnalytics({ organizationId: organizationId!, dateRange: DEFAULT_DATE_RANGE });
  const currency = billing.data?.currency ?? "USD";
  const isLoading = loadingWebsites || loadingZones;
  const error = websitesError || zonesError;
  const verifiedWebsites = useMemo(() => (websites ?? []).filter((website) => website.verification_status === "verified"), [websites]);
  const activeZones = useMemo(() => (zones ?? []).filter((zone) => zone.status === "active"), [zones]);
  const summary = analytics.data?.summary;
  const balance = wallet.data?.balance ?? 0;

  if (isLoading) return <WorkspaceGuard workspace="publisher"><LoadingState rows={4} label="Loading overview" /></WorkspaceGuard>;
  if (error) return <WorkspaceGuard workspace="publisher"><ErrorState title="Couldn't load overview" message={error.message} onRetry={() => window.location.reload()} /></WorkspaceGuard>;

  return (
    <WorkspaceGuard workspace="publisher">
      <PageHeader
        eyebrow="Publisher"
        title="Dashboard"
        description="Monitor your website performance, ad zone revenue, and earnings."
        actions={<div className="flex gap-2"><Button asChild size="sm" variant="outline"><Link to="/publisher/placements">Manage placements</Link></Button><Button asChild size="sm" variant="outline"><Link to="/publisher/websites">Manage websites</Link></Button></div>}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Impressions (30d)" value={summary?.impressions?.toLocaleString() ?? "—"} hint={`${summary?.clicks?.toLocaleString() ?? 0} clicks`} icon={<Eye className="size-4" />} />
        <MetricCard label="CTR" value={summary?.ctr ? `${(summary.ctr * 100).toFixed(2)}%` : "—"} hint="Click-through rate" icon={<MousePointerClick className="size-4" />} />
        <MetricCard label="Earnings (30d)" value={summary?.earnings ? formatCurrency(summary.earnings, currency) : "—"} hint={summary?.rpm ? `RPM ${formatCurrency(summary.rpm, currency)}` : "Revenue per 1k impressions"} icon={<Coins className="size-4" />} />
        <MetricCard label="Available balance" value={formatCurrency(balance, currency)} hint="Ready for payout" icon={<Wallet className="size-4" />} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Websites" value={String(websites?.length ?? 0)} hint={`${verifiedWebsites.length} verified`} icon={<Globe className="size-4" />} />
        <MetricCard label="Ad zones" value={String(zones?.length ?? 0)} hint={`${activeZones.length} active`} icon={<Image className="size-4" />} />
        <MetricCard label="RPM" value={summary?.rpm ? formatCurrency(summary.rpm, currency) : "—"} hint="Revenue per 1k impressions" icon={<TrendingUp className="size-4" />} />
        <MetricCard label="Fill rate" value={summary?.ctr ? `${(summary.ctr * 100).toFixed(1)}%` : "—"} hint="Estimated fill rate based on click-through activity" icon={<Activity className="size-4" />} />
      </div>
      {websites?.length === 0 ? (
        <EmptyState icon={<Globe className="size-5" />} title="No websites added yet" description="Add a website to start the verification process and create ad zones." action={<Button asChild size="sm"><Link to="/publisher/websites">Add your first website</Link></Button>} />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between"><p className="text-sm font-medium">Your websites</p><Button asChild size="sm" variant="ghost"><Link to="/publisher/websites">View all</Link></Button></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(websites ?? []).slice(0, 6).map((website) => (
              <Link key={website.id} to="/publisher/websites/$websiteId" params={{ websiteId: website.id }} className="rounded-lg border border-border p-4 transition-colors hover:bg-muted/40">
                <p className="font-medium">{website.name}</p>
                <p className="text-xs text-muted-foreground">{website.domain}</p>
                <p className="mt-2 text-xs text-muted-foreground">{categoryLabel(website.category)}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </WorkspaceGuard>
  );
}
