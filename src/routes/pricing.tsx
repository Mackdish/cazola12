import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ChevronRight, Globe, HelpCircle, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PublicLayout } from "@/components/layout/public-layout";
import { useBillingSettings } from "@/hooks/use-billing";
import { pageMetadata } from "@/lib/seo";
import { AD_FORMATS } from "@/lib/publisher-domain";
import {
  currentMinimumPayoutPhrase,
  describeMinimumPayout,
  equivalentCpm,
  formatSharePercent,
} from "@/lib/public-terms";

export const Route = createFileRoute("/pricing")({
  head: () => pageMetadata({
    title: "Pricing — TradeMall",
    description:
      "Transparent pricing for advertisers and publishers on TradeMall. No hidden fees. Pay only for results.",
    path: "/pricing",
    image: "/trademall-logo.png",
  }),
  component: PricingPage,
});

function PricingPage() {
  const settings = useBillingSettings();
  const [budget, setBudget] = useState("300");
  const [model, setModel] = useState("cpc");

  const currency = settings.data?.currency ?? "KES";
  const startingCpc = settings.data?.startingCpc ?? 5;
  const assumedCtr = settings.data?.assumedCtr ?? 0.01;
  // No separate CPM rate card exists: the ad server scores a CPC bid as
  // cpc * ctr per impression, so this is the CPM that competes with the starting CPC.
  const cpmRate = equivalentCpm(startingCpc, assumedCtr);
  const holdDays = settings.data?.earningsHoldDays;
  const publisherTermsLoaded = Boolean(settings.data);
  const estimate = useMemo(() => {
    const b = Number(budget || 0);
    if (b <= 0) return null;
    if (model === "cpc" && startingCpc > 0) {
      const clicks = Math.floor(b / startingCpc);
      return { clicks, impressions: null };
    }
    if (model === "cpm" && cpmRate > 0) {
      const impressions = Math.floor((b / cpmRate) * 1000);
      return { clicks: null, impressions };
    }
    return null;
  }, [budget, model, startingCpc, cpmRate]);

  return (
    <PublicLayout>
      <div className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto">
            <p className="text-eyebrow">Pricing</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              Start advertising from {currency} {startingCpc.toLocaleString()}
            </h1>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
              No monthly subscription. No long-term contracts. Set your own campaign budget.
              Pay based on campaign performance.
            </p>
          </div>

          <div className="mt-16 grid gap-8 lg:grid-cols-2">
            <Card className="relative overflow-hidden">
              <CardHeader>
                <CardTitle className="text-2xl">For Advertisers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Pricing Models</h3>
                  <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <ChevronRight className="size-4 text-accent" />
                      <span>
                        <strong className="text-foreground">CPC</strong> — Starting from {currency} {startingCpc}/click
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <ChevronRight className="size-4 text-accent" />
                      <span>
                        <strong className="text-foreground">CPM</strong> — You set the bid per 1,000
                        impressions (about {currency} {Math.round(cpmRate).toLocaleString()} per 1,000
                        competes with the {currency} {startingCpc} starting CPC)
                      </span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-foreground">Minimum Campaign Budget</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Start from {currency} {settings.data?.campaignMinimumBudget?.toLocaleString() ?? "300"}. Daily budgets from{" "}
                    {currency} {settings.data?.minimumDailyBudget?.toLocaleString() ?? "100"}.
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-foreground">Supported Targeting</h3>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <li>Country, county, and city</li>
                    <li>Device, browser, and OS</li>
                    <li>Website category</li>
                    <li>Schedule campaigns by date and time</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-foreground">Supported Ad Formats</h3>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {AD_FORMATS.map((f) => (
                      <li key={f.format}>
                        {f.label}
                        {f.width && f.height ? ` (${f.width}×${f.height})` : ""}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-4">
                  <Button asChild size="lg" className="h-11 px-8">
                    <Link to="/auth">
                      Create Campaign
                      <ChevronRight className="ml-1.5 size-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden">
              <CardHeader>
                <CardTitle className="text-2xl">For Publishers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Revenue Share</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {publisherTermsLoaded
                      ? `Publishers earn ${formatSharePercent(settings.data!.publisherRevenueShare)} of eligible advertising revenue. Invalid traffic earns nothing.`
                      : "Loading current revenue share…"}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-foreground">Minimum Payout</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {publisherTermsLoaded
                      ? describeMinimumPayout(settings.data!.minimumPayoutAmount, currency)
                      : "Loading current payout terms…"}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-foreground">Payment Schedule</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {publisherTermsLoaded
                      ? `Earnings become available after a ${holdDays}-day hold. Once your available earnings reach the minimum, you can request a payout from your dashboard.`
                      : "Loading current payout terms…"}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-foreground">Payment Methods</h3>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <li>Local payment methods supported in Africa</li>
                    <li>Details shown in publisher dashboard after approval</li>
                  </ul>
                </div>

                <div className="pt-4">
                  <Button asChild size="lg" variant="outline" className="h-11 px-8">
                    <Link to="/auth">
                      Become a Publisher
                      <ChevronRight className="ml-1.5 size-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-16">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Campaign Calculator</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="calc-budget">Campaign budget ({currency})</Label>
                      <Input
                        id="calc-budget"
                        inputMode="decimal"
                        value={budget}
                        onChange={(e) => setBudget(e.target.value.replace(/[^0-9.]/g, ""))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="calc-model">Pricing model</Label>
                      <Select value={model} onValueChange={setModel}>
                        <SelectTrigger id="calc-model">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cpc">CPC</SelectItem>
                          <SelectItem value="cpm">CPM</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex flex-col justify-center">
                    {estimate ? (
                      <div className="rounded-lg border p-4">
                        <p className="text-xs text-muted-foreground">Estimated results</p>
                        <p className="mt-2 text-2xl font-semibold">
                          {model === "cpc"
                            ? `~${estimate.clicks?.toLocaleString()} clicks`
                            : `~${estimate.impressions?.toLocaleString()} impressions`}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Estimates are based on starting rates. Actual results and costs vary based
                          on auction competition, targeting, placement, audience and campaign
                          performance.
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Enter a budget above to see estimates.
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-16">
            <h2 className="text-2xl font-semibold text-center">How pricing works</h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-3">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm font-semibold">Set your budget</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Choose a total budget and optional daily cap. Minimums apply.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm font-semibold">Choose your bid</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Starting from {currency} {startingCpc}/click for CPC. Actual costs may vary based
                    on auction competition.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm font-semibold">Pay for results</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    You only pay for clicks or impressions. No hidden fees.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="mt-16">
            <h2 className="text-2xl font-semibold text-center">Frequently asked questions</h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              <Card>
                <CardContent className="pt-6 space-y-2">
                  <p className="text-sm font-semibold">What is the minimum campaign budget?</p>
                  <p className="text-sm text-muted-foreground">
                    Minimum total budget is {currency} {settings.data?.campaignMinimumBudget?.toLocaleString() ?? "300"}. Minimum daily
                    budget is {currency} {settings.data?.minimumDailyBudget?.toLocaleString() ?? "100"}.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 space-y-2">
                  <p className="text-sm font-semibold">What is the starting CPC?</p>
                  <p className="text-sm text-muted-foreground">
                    Starting CPC is {currency} {startingCpc}/click. Actual CPC may vary based on
                    auction competition, targeting, placement, audience and campaign performance.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 space-y-2">
                  <p className="text-sm font-semibold">How are publisher earnings calculated?</p>
                  <p className="text-sm text-muted-foreground">
                    Publisher earnings are calculated from eligible advertising revenue multiplied
                    by the platform revenue share percentage
                    {publisherTermsLoaded
                      ? ` (currently ${formatSharePercent(settings.data!.publisherRevenueShare)})`
                      : ""}
                    . Invalid traffic does not generate publisher revenue.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 space-y-2">
                  <p className="text-sm font-semibold">What happens with invalid traffic?</p>
                  <p className="text-sm text-muted-foreground">
                    Invalid or fraudulent traffic is filtered out and does not generate publisher
                    revenue or advertiser charges.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 space-y-2">
                  <p className="text-sm font-semibold">How do refunds work?</p>
                  <p className="text-sm text-muted-foreground">
                    Refunds adjust eligible revenue and publisher earnings accordingly. Refunded
                    transactions do not generate publisher revenue.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 space-y-2">
                  <p className="text-sm font-semibold">Will pricing become auction-based?</p>
                  <p className="text-sm text-muted-foreground">
                    The platform is structured to support auction-based pricing in the future.
                    Current starting rates may evolve as the marketplace matures.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 space-y-2">
                  <p className="text-sm font-semibold">When can publishers request payouts?</p>
                  <p className="text-sm text-muted-foreground">
                    Earnings become available after the{" "}
                    {publisherTermsLoaded ? `${holdDays}-day` : ""} hold period. Publishers can
                    request payouts once available earnings reach the minimum payout threshold
                    {publisherTermsLoaded
                      ? ` (${currentMinimumPayoutPhrase(settings.data!.minimumPayoutAmount, currency)})`
                      : ""}
                    .
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 space-y-2">
                  <p className="text-sm font-semibold">Are there long-term contracts?</p>
                  <p className="text-sm text-muted-foreground">
                    No. Advertisers control their campaign budget and can pause or stop campaigns
                    at any time. No monthly subscription.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

           <div className="mt-16 text-center">
             <p className="text-sm text-muted-foreground">
               Competitive advertising rates designed for African businesses.
             </p>
           </div>
        </div>
      </div>
    </PublicLayout>
  );
}
