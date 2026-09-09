import { useMemo, useState } from "react";
import {
  Bot,
  CheckCircle2,
  ImageIcon,
  Lightbulb,
  Loader2,
  Search,
  Sparkles,
  Target,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useAdvertiserOrg,
  useAiAnalyzeCreative,
  useAiAuditWebsite,
  useAiBuildCampaignPlan,
  useAiOptimizeCampaign,
  useCampaigns,
  useCreateCampaign,
  useCreatives,
  useSaveTargeting,
} from "@/hooks/use-advertiser";
import { formatCurrency } from "@/lib/advertiser-domain";

export function AiCopilotDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { organizationId } = useAdvertiserOrg();
  const creatives = useCreatives(organizationId);
  const campaigns = useCampaigns(organizationId);
  const createCampaign = useCreateCampaign();
  const saveTargeting = useSaveTargeting();
  const build = useAiBuildCampaignPlan();
  const audit = useAiAuditWebsite();
  const creativeAudit = useAiAnalyzeCreative();
  const optimize = useAiOptimizeCampaign();

  const [websiteUrl, setWebsiteUrl] = useState("");
  const [goal, setGoal] = useState("Drive sales and enquiries");
  const [budget, setBudget] = useState("20000");
  const [duration, setDuration] = useState("14");
  const [campaignId, setCampaignId] = useState("");
  const [assetId, setAssetId] = useState("");

  const selectedCreative = useMemo(
    () => (creatives.data ?? []).find((item) => item.id === assetId),
    [creatives.data, assetId],
  );

  const providerLabel = (provider?: string) =>
    provider
      ? provider === "claude"
        ? "Claude"
        : provider === "grok"
          ? "Grok"
          : provider.charAt(0).toUpperCase() + provider.slice(1)
      : "AI";

  async function buildPlan() {
    if (!organizationId) return toast.error("Your advertiser organization could not be found.");
    try {
      await build.mutateAsync({
        organizationId,
        websiteUrl,
        goal,
        budget: Number(budget),
        durationDays: Number(duration),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We couldn't build the campaign plan.");
    }
  }

  async function runAudit() {
    if (!organizationId) return toast.error("Your advertiser organization could not be found.");
    try {
      await audit.mutateAsync({ organizationId, websiteUrl });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Website audit failed.");
    }
  }

  async function runCreativeAudit() {
    if (!organizationId || !assetId) return toast.error("Select a creative first.");
    try {
      await creativeAudit.mutateAsync({ organizationId, assetId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Creative analysis failed.");
    }
  }

  async function runOptimization() {
    if (!organizationId) return toast.error("Your advertiser organization could not be found.");
    try {
      await optimize.mutateAsync({ organizationId, campaignId: campaignId || null, days: 30 });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Campaign optimization failed.");
    }
  }

  const plan = build.data;
  const auditResult = audit.data;
  const creativeResult = creativeAudit.data;
  const optimization = optimize.data;

  async function createDraftFromPlan() {
    if (!organizationId || !plan) return;
    try {
      const created = await createCampaign.mutateAsync({
        organizationId,
        name: plan.campaignName.slice(0, 120),
        objective: plan.objective,
        bidType: plan.bidType,
        bidAmount: plan.bidAmount,
        totalBudget: plan.totalBudget,
        dailyBudget: plan.dailyBudget,
        startDate: null,
        endDate: null,
        landingPageUrl: plan.landingPageUrl,
      });
      await saveTargeting.mutateAsync({
        campaignId: created.id,
        countries: plan.targeting.countries,
        counties: plan.targeting.counties,
        cities: plan.targeting.cities,
        devices: plan.targeting.devices,
        operatingSystems: [],
        browsers: [],
        websiteCategories: plan.targeting.websiteCategories as never,
        schedule: {},
      });
      toast.success(
        "AI campaign draft created. Add a creative, review targeting and submit it when ready.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "We couldn't create the AI campaign draft.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[92svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5" /> TradeMall AI Copilot
          </DialogTitle>
          <DialogDescription>
            Build campaigns, audit websites, improve creatives and find optimization opportunities
            using your TradeMall data.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="campaign" className="mt-2">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="campaign">
              <Target className="mr-1 size-4" /> Campaign
            </TabsTrigger>
            <TabsTrigger value="website">
              <Search className="mr-1 size-4" /> Website
            </TabsTrigger>
            <TabsTrigger value="creative">
              <ImageIcon className="mr-1 size-4" /> Creative
            </TabsTrigger>
            <TabsTrigger value="optimize">
              <Lightbulb className="mr-1 size-4" /> Optimize
            </TabsTrigger>
          </TabsList>

          <TabsContent value="campaign" className="space-y-5 pt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Business / landing page URL</Label>
                <Input
                  placeholder="https://yourbusiness.co.ke"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>What do you want to achieve?</Label>
                <Textarea
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="Describe the offer, product or result you want."
                />
              </div>
              <div className="space-y-2">
                <Label>Total budget (KES)</Label>
                <Input
                  inputMode="decimal"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value.replace(/[^0-9.]/g, ""))}
                />
              </div>
              <div className="space-y-2">
                <Label>Duration (days)</Label>
                <Input
                  inputMode="numeric"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value.replace(/\D/g, ""))}
                />
              </div>
            </div>
            <Button
              onClick={() => void buildPlan()}
              disabled={build.isPending || !websiteUrl || !budget || !duration}
            >
              {build.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 size-4" />
              )}{" "}
              Build campaign plan
            </Button>
            {plan && (
              <div className="rounded-xl border p-5 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Recommended campaign
                    </p>
                    <h3 className="text-xl font-semibold">{plan.campaignName}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium">
                      {Math.round(plan.confidence * 100)}% confidence
                    </span>
                    <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                      {providerLabel(plan.provider)} · {plan.model}
                    </span>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-4">
                  {[
                    ["Objective", plan.objective],
                    [
                      "Bid",
                      `${plan.bidType.toUpperCase()} ${formatCurrency(plan.bidAmount, "KES")}`,
                    ],
                    ["Budget", formatCurrency(plan.totalBudget, "KES")],
                    ["Duration", `${plan.durationDays} days`],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="font-medium capitalize">{value}</p>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="font-medium">Audience</p>
                  <p className="text-sm text-muted-foreground">{plan.audience.summary}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {plan.audience.locations.map((item) => (
                      <span key={item} className="rounded-full border px-2 py-1 text-xs">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="font-medium">Recommended publishers</p>
                  <div className="mt-2 space-y-2">
                    {plan.publisherRecommendations.map((item) => (
                      <div
                        key={item.websiteId}
                        className="flex items-center justify-between gap-3 rounded-lg border p-3"
                      >
                        <div>
                          <p className="font-medium">{item.websiteName}</p>
                          <p className="text-xs text-muted-foreground">{item.reason}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{Math.round(item.matchScore)}% match</p>
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(item.budgetAllocation, "KES")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="font-medium">Creative direction</p>
                  <p className="text-sm text-muted-foreground">
                    CTA: <strong>{plan.creative.cta}</strong>
                  </p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {plan.creative.headlines.slice(0, 3).map((item) => (
                      <li key={item} className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 size-4 text-primary" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg bg-muted/40 p-3 text-sm">
                  <p className="font-medium">Why Copilot recommends this</p>
                  <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                    {plan.reasoning.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <Button
                  onClick={() => void createDraftFromPlan()}
                  disabled={createCampaign.isPending || saveTargeting.isPending}
                >
                  <CheckCircle2 className="mr-2 size-4" />{" "}
                  {createCampaign.isPending || saveTargeting.isPending
                    ? "Creating draft…"
                    : "Create draft campaign"}
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="website" className="space-y-5 pt-4">
            <div className="flex gap-2">
              <Input
                placeholder="https://yourbusiness.co.ke"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
              />
              <Button onClick={() => void runAudit()} disabled={audit.isPending || !websiteUrl}>
                {audit.isPending ? <Loader2 className="size-4 animate-spin" /> : "Audit"}
              </Button>
            </div>
            {auditResult && (
              <div className="space-y-4">
                <div className="flex items-center gap-4 rounded-xl border p-4">
                  <div className="text-3xl font-bold">
                    {auditResult.score}
                    <span className="text-base text-muted-foreground">/100</span>
                  </div>
                  <div>
                    <p className="font-semibold">
                      Website campaign readiness{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        · {providerLabel(auditResult.provider)}
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground">{auditResult.businessSummary}</p>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {auditResult.issues.map((issue) => (
                    <div key={`${issue.area}-${issue.finding}`} className="rounded-lg border p-4">
                      <div className="flex justify-between gap-2">
                        <p className="font-medium">{issue.area}</p>
                        <span className="text-xs uppercase text-muted-foreground">
                          {issue.severity}
                        </span>
                      </div>
                      <p className="mt-1 text-sm">{issue.finding}</p>
                      <p className="mt-2 text-sm text-muted-foreground">{issue.recommendation}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="creative" className="space-y-5 pt-4">
            <div className="flex gap-2">
              <select
                className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
              >
                <option value="">Select a creative</option>
                {(creatives.data ?? []).map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.file_name}{" "}
                    {asset.width && asset.height ? `(${asset.width}×${asset.height})` : ""}
                  </option>
                ))}
              </select>
              <Button
                onClick={() => void runCreativeAudit()}
                disabled={creativeAudit.isPending || !selectedCreative}
              >
                {creativeAudit.isPending ? <Loader2 className="size-4 animate-spin" /> : "Analyze"}
              </Button>
            </div>
            {creativeResult && (
              <div className="space-y-4">
                <div className="text-xs text-muted-foreground">
                  Analyzed with {providerLabel(creativeResult.provider)} · {creativeResult.model}
                </div>
                <div className="grid gap-3 sm:grid-cols-5">
                  {[
                    ["Score", creativeResult.score],
                    ["Product", creativeResult.productVisibility],
                    ["Text", creativeResult.textReadability],
                    ["Brand", creativeResult.branding],
                    ["Mobile", creativeResult.mobileSuitability],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border p-3 text-center">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-xl font-semibold">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="font-medium">Issues</p>
                    <ul className="mt-2 space-y-2 text-sm">
                      {creativeResult.issues.map((item) => (
                        <li key={item} className="rounded-lg bg-muted/50 p-3">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium">Recommendations</p>
                    <ul className="mt-2 space-y-2 text-sm">
                      {creativeResult.recommendations.map((item) => (
                        <li key={item} className="rounded-lg bg-primary/5 p-3">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="optimize" className="space-y-5 pt-4">
            <div className="flex gap-2">
              <select
                className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
              >
                <option value="">Active/latest campaign</option>
                {(campaigns.data ?? []).map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </select>
              <Button onClick={() => void runOptimization()} disabled={optimize.isPending}>
                {optimize.isPending ? <Loader2 className="size-4 animate-spin" /> : "Analyze"}
              </Button>
            </div>
            {optimization && (
              <div className="space-y-4">
                <div className="rounded-xl border p-4">
                  <p className="text-sm text-muted-foreground">{optimization.campaign.name}</p>
                  <p className="mt-1 font-semibold">{optimization.overallAssessment}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Analyzed with {providerLabel(optimization.provider)} · {optimization.model}
                  </p>
                  <span className="mt-2 inline-block rounded-full bg-muted px-3 py-1 text-xs uppercase">
                    {optimization.priority} priority
                  </span>
                </div>
                <div className="space-y-3">
                  {optimization.recommendations.map((item) => (
                    <div key={item.title} className="rounded-lg border p-4">
                      <p className="font-medium">{item.title}</p>
                      <p className="mt-1 text-sm">{item.reason}</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        <strong>Action:</strong> {item.action}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Expected impact: {item.expectedImpact}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
