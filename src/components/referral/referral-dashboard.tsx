import { Check, Copy, Gift, Mail, MessageCircle, Users, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DataTable, type DataTableColumn } from "@/components/patterns/data-table";
import { MetricCard } from "@/components/patterns/metric-card";
import { EmptyState, ErrorState, LoadingState } from "@/components/patterns/states";
import { StatusBadge, type StatusTone } from "@/components/patterns/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useReferralOverview } from "@/hooks/use-referral";
import {
  COMMISSION_STATUS_LABEL,
  REFERRAL_STATUS_LABEL,
  buildReferralLink,
  emailShareUrl,
  formatKes,
  referralShareText,
  whatsappShareUrl,
  type CommissionStatus,
  type ReferralStatus,
} from "@/lib/referral-domain";
import type { ReferralOverview, ReferralSettingsView } from "@/lib/referral.functions";

export type ReferralAudience = "advertiser" | "publisher";

const REFERRAL_TONE: Record<ReferralStatus, StatusTone> = { pending: "pending", qualified: "active", void: "suspended" };
const COMMISSION_TONE: Record<CommissionStatus, StatusTone> = {
  pending: "pending",
  available: "info",
  paid: "active",
  void: "suspended",
};

/** How a referrer is paid depends on who they are: ad credit for advertisers, cash for publishers. */
export function referralRewardCopy(audience: ReferralAudience) {
  return audience === "advertiser"
    ? {
        paidAs: "ad credit added straight to your wallet",
        earnedHint: "Added to your wallet as ad credit",
        icon: Wallet,
      }
    : {
        paidAs: "cash, added to your withdrawable earnings and paid out with your normal payouts",
        earnedHint: "Added to your withdrawable earnings",
        icon: Wallet,
      };
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

export function ReferralLinkCard({
  code,
  link,
  audience,
}: {
  code: string;
  link: string;
  audience: ReferralAudience;
}) {
  const [copied, setCopied] = useState(false);
  const shareText = referralShareText(audience);

  async function copy() {
    const ok = await copyToClipboard(link);
    if (ok) {
      setCopied(true);
      toast.success("Referral link copied.");
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Couldn't copy automatically — select the link and copy it.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="size-5 text-primary" />
          Your referral link
        </CardTitle>
        <CardDescription>
          Share this link. Anyone who signs up through it is linked to you automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input readOnly value={link} aria-label="Your referral link" onFocus={(e) => e.currentTarget.select()} className="font-mono text-sm" />
          <Button type="button" onClick={() => void copy()} className="sm:w-32">
            {copied ? <Check className="mr-2 size-4" /> : <Copy className="mr-2 size-4" />}
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={whatsappShareUrl(link, shareText)} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="mr-2 size-4" />
              Share on WhatsApp
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={emailShareUrl(link, shareText)}>
              <Mail className="mr-2 size-4" />
              Share by email
            </a>
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">
            Your code: <span className="font-mono font-semibold text-foreground">{code}</span>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function HowItWorksCard({
  audience,
  settings,
}: {
  audience: ReferralAudience;
  settings: ReferralSettingsView;
}) {
  const reward = referralRewardCopy(audience);
  const window =
    settings.windowMonths === 0 ? "with no time limit" : `for ${settings.windowMonths} month${settings.windowMonths === 1 ? "" : "s"}`;
  return (
    <Card>
      <CardHeader>
        <CardTitle>How it works</CardTitle>
        <CardDescription>Earn a share of TradeMall's revenue from the people you bring in.</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3 text-sm text-muted-foreground">
          <li>
            <span className="font-semibold text-foreground">1. Share your link.</span> Advertisers and publishers who sign up
            with it are linked to you.
          </li>
          <li>
            <span className="font-semibold text-foreground">2. They get started.</span> Their rewards unlock once an
            advertiser has spent {formatKes(settings.advertiserMilestone)} on ads, or a publisher has earned{" "}
            {formatKes(settings.publisherMilestone)}.
          </li>
          <li>
            <span className="font-semibold text-foreground">3. You earn {settings.commissionPercent}%.</span> You receive{" "}
            {settings.commissionPercent}% of the revenue TradeMall makes from their activity {window}. It's paid by
            TradeMall — it never reduces what they earn or spend.
          </li>
          <li>
            <span className="font-semibold text-foreground">4. Get paid.</span> Your rewards are paid as {reward.paidAs}.
            Rewards are released after the normal earnings hold period, so refunded or invalid traffic doesn't count.
          </li>
        </ol>
      </CardContent>
    </Card>
  );
}

function ReferralContent({ audience, data }: { audience: ReferralAudience; data: ReferralOverview }) {
  const reward = referralRewardCopy(audience);
  const origin = typeof window !== "undefined" ? window.location.origin : "https://trademall.co.ke";
  const link = buildReferralLink(origin, data.code);
  const { summary, settings } = data;
  const earned = summary.commissions.paid + summary.commissions.available;

  const referralColumns: DataTableColumn<ReferralOverview["referrals"][number]>[] = [
    {
      id: "who",
      header: "Referred",
      cell: (row) => (
        <div>
          <div className="font-medium">{row.maskedName}</div>
          <div className="text-xs capitalize text-muted-foreground">{row.kind}</div>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => <StatusBadge tone={REFERRAL_TONE[row.status]}>{REFERRAL_STATUS_LABEL[row.status]}</StatusBadge>,
    },
    { id: "joined", header: "Joined", cell: (row) => new Date(row.createdAt).toLocaleDateString("en-KE") },
    { id: "earned", header: "Earned", align: "right", cell: (row) => formatKes(row.earned) },
    { id: "pending", header: "Pending", align: "right", cell: (row) => formatKes(row.pending) },
  ];

  const commissionColumns: DataTableColumn<ReferralOverview["commissions"][number]>[] = [
    { id: "date", header: "Date", cell: (row) => new Date(row.createdAt).toLocaleDateString("en-KE") },
    {
      id: "from",
      header: "From",
      cell: (row) => <span className="capitalize">{row.sourceRole === "advertiser" ? "Ad spend" : "Site earnings"}</span>,
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => <StatusBadge tone={COMMISSION_TONE[row.status]}>{COMMISSION_STATUS_LABEL[row.status]}</StatusBadge>,
    },
    { id: "amount", header: "Amount", align: "right", cell: (row) => formatKes(row.amount) },
  ];

  return (
    <div className="mt-6 space-y-6">
      <ReferralLinkCard code={data.code} link={link} audience={audience} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="People referred" value={summary.referrals.total} hint={`${summary.referrals.pending} signed up, waiting to qualify`} icon={<Users className="size-4" />} />
        <MetricCard label="Qualified" value={summary.referrals.qualified} hint="Reached their milestone" icon={<Check className="size-4" />} />
        <MetricCard label="Pending rewards" value={formatKes(summary.commissions.pending)} hint="Unlocks as they qualify" />
        <MetricCard
          label="Total earned"
          value={formatKes(earned)}
          hint={audience === "publisher" && summary.commissions.available > 0 ? `${formatKes(summary.commissions.available)} ready to withdraw` : reward.earnedHint}
          icon={<reward.icon className="size-4" />}
        />
      </div>

      <HowItWorksCard audience={audience} settings={settings} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">People you referred</h2>
        {data.referrals.length ? (
          <DataTable columns={referralColumns} rows={data.referrals} rowKey={(row) => row.id} caption="People you referred" />
        ) : (
          <EmptyState title="No referrals yet" description="Share your link — people who sign up with it will appear here." />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Reward history</h2>
        {data.commissions.length ? (
          <DataTable columns={commissionColumns} rows={data.commissions} rowKey={(row) => row.id} caption="Reward history" />
        ) : (
          <EmptyState title="No rewards yet" description="Rewards appear here as the people you referred start spending or earning." />
        )}
      </section>
    </div>
  );
}

/** The "Refer & Earn" page body, shared by the advertiser and publisher dashboards. */
export function ReferralDashboard({
  audience,
  organizationId,
  loadingOrganization,
}: {
  audience: ReferralAudience;
  organizationId: string | null;
  loadingOrganization: boolean;
}) {
  const overview = useReferralOverview(organizationId);

  if (loadingOrganization || overview.isLoading) return <LoadingState rows={4} label="Loading referrals" />;
  if (!organizationId) {
    return (
      <EmptyState
        title="Set up your account first"
        description={`Create your ${audience} account to get your referral link.`}
      />
    );
  }
  if (overview.error) {
    return (
      <ErrorState
        title="Couldn't load referrals"
        message={overview.error.message}
        onRetry={() => void overview.refetch()}
      />
    );
  }
  const data = overview.data!;
  if (!data.settings.enabled) {
    return (
      <div className="mt-6">
        <EmptyState
          title="The referral program opens soon"
          description="We're getting it ready. Your personal link will appear here the moment it launches."
        />
      </div>
    );
  }
  return <ReferralContent audience={audience} data={data} />;
}

