import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Globe, CheckCircle2, XCircle, AlertTriangle, Download, Copy, RefreshCw, Shield, TrendingUp, Gauge } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DataTableColumn } from "@/components/patterns/data-table";
import { DataTable } from "@/components/patterns/data-table";
import { EmptyState, ErrorState, LoadingState } from "@/components/patterns/states";
import { StatusBadge } from "@/components/patterns/status-badge";
import { AdZoneDialog } from "@/components/publisher/ad-zone-dialog";
import { EmbedCodePanel } from "@/components/publisher/embed-code-panel";
import { VerificationPanel } from "@/components/publisher/verification-panel";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import {
  useAdServerOrigin,
  useSaveWebsite,
  useSetAdZoneStatus,
  useWebsiteDetail,
  useAdsTxtRecord,
  useAutoAdsConfig,
  useUpdateAutoAdsConfig,
  useUpsertAutoAdsConfig,
  useUpsertAdsTxtRecord,
  useVerifyAdsTxt,
  useAdControls,
  useUpsertAdControls,
  usePatchAdControls,
  useWebsiteHealthChecks,
  useRunWebsiteHealthChecks,
} from "@/hooks/use-publisher";
import { fetchWebsiteDetail } from "@/lib/publisher.functions";
import { toFriendlyError } from "@/lib/errors";
import {
  AdZone,
  approvalLabel,
  approvalTone,
  categoryLabel,
  WEBSITE_CATEGORIES,
  type WebsiteCategory,
} from "@/lib/publisher-domain";

export const Route = createFileRoute("/_authenticated/publisher/websites/$websiteId")({
  head: () => ({
    meta: [
      { title: "Website details — Publisher — TradeMall" },
      { name: "description", content: "Verify a domain, manage ad zones and copy embed code." },
      { property: "og:title", content: "Website details — Publisher — TradeMall" },
      {
        property: "og:description",
        content: "Verify a domain, manage ad zones and copy embed code.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WebsiteDetailPage,
});

type WebsiteDetail = Awaited<ReturnType<typeof fetchWebsiteDetail>>;

function WebsiteDetailPage() {
  const { websiteId } = Route.useParams();
  const { data: detail, isLoading, error, refetch } = useWebsiteDetail(websiteId);

  if (isLoading) {
    return (
      <WorkspaceGuard workspace="publisher">
        <LoadingState rows={3} label="Loading website details" />
      </WorkspaceGuard>
    );
  }

  if (error || !detail) {
    return (
      <WorkspaceGuard workspace="publisher">
        <ErrorState
          title="Couldn't load website"
          message={error?.message ?? "That website doesn't exist or you don't have access to it."}
          onRetry={() => void refetch()}
        />
      </WorkspaceGuard>
    );
  }

  const ready =
    detail.website.verification_status === "verified" &&
    detail.website.approval_status === "approved";

  return (
    <WorkspaceGuard workspace="publisher">
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/publisher/websites">
              <ArrowLeft className="mr-1 size-4" />
              Websites
            </Link>
          </Button>
        </div>

        <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <p className="text-eyebrow">Website</p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {detail.website.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {detail.website.domain} · {categoryLabel(detail.website.category)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={approvalTone(detail.website.approval_status)}>
              {approvalLabel(detail.website.approval_status)}
            </StatusBadge>
          </div>
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="verification">Verification</TabsTrigger>
          <TabsTrigger value="zones">Ad zones</TabsTrigger>
          <TabsTrigger value="health">Health</TabsTrigger>
          <TabsTrigger value="ads-txt">Ads.txt</TabsTrigger>
          <TabsTrigger value="auto-ads">Auto Ads</TabsTrigger>
          <TabsTrigger value="controls">Controls</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <OverviewTab website={detail.website} zones={detail.zones} />
          </TabsContent>

          <TabsContent value="verification" className="space-y-4">
            <VerificationPanel
              websiteId={detail.website.id}
              domain={detail.website.domain}
              verificationStatus={detail.website.verification_status}
              verifications={detail.verifications}
              verificationToken={detail.website.verification_token}
              onVerified={() => void refetch()}
            />
          </TabsContent>

          <TabsContent value="zones" className="space-y-4">
            <AdZonesTab website={detail.website} zones={detail.zones} ready={ready} />
          </TabsContent>

          <TabsContent value="health" className="space-y-4">
            <HealthTab websiteId={detail.website.id} organizationId={detail.website.organization_id} />
          </TabsContent>

          <TabsContent value="ads-txt" className="space-y-4">
            <AdsTxtTab website={detail.website} />
          </TabsContent>

          <TabsContent value="auto-ads" className="space-y-4">
            <AutoAdsTab websiteId={detail.website.id} domain={detail.website.domain} />
          </TabsContent>

          <TabsContent value="controls" className="space-y-4">
            <AdControlsTab websiteId={detail.website.id} />
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <WebsiteSettingsTab website={detail.website} />
          </TabsContent>
        </Tabs>
      </div>
    </WorkspaceGuard>
  );
}

function OverviewTab({
  website,
  zones,
}: {
  website: WebsiteDetail["website"];
  zones: WebsiteDetail["zones"];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Domain</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm font-medium">{website.domain}</p>
          <p className="text-xs text-muted-foreground">
            {verificationStatusDescription(website.verification_status)}
          </p>
        </CardContent>
      </Card>
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Ad zones</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-numeric text-2xl font-semibold">{zones.length}</p>
          <p className="text-xs text-muted-foreground">
            {zones.filter((zone) => zone.status === "active").length} active
          </p>
        </CardContent>
      </Card>
      <Card className="shadow-none sm:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">About</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {website.description ?? "No description added yet."}
          </p>
          {website.monthly_pageviews > 0 ? (
            <p className="mt-3 text-sm">
              <span className="text-eyebrow">Monthly pageviews</span>
              <span className="text-numeric ml-2 font-medium">
                {website.monthly_pageviews.toLocaleString()}
              </span>
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function verificationStatusDescription(status: string): string {
  if (status === "verified") return "Domain ownership is confirmed.";
  if (status === "pending") return "Ownership verification is in progress.";
  return "Verify ownership before this website can serve ads.";
}

function AdZonesTab({
  website,
  zones,
  ready,
}: {
  website: WebsiteDetail["website"];
  zones: WebsiteDetail["zones"];
  ready: boolean;
}) {
  const { data: originData } = useAdServerOrigin();
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const setStatus = useSetAdZoneStatus();
  const selectedZone = zones.find((zone) => zone.id === selectedZoneId);

  const columns: DataTableColumn<AdZone>[] = [
    { id: "name", header: "Name", cell: (zone) => zone.name },
    { id: "format", header: "Format", cell: (zone) => zone.format },
    {
      id: "status",
      header: "Status",
      cell: (zone) => (
        <StatusBadge tone={zone.status === "active" ? "active" : "suspended"}>
          {zone.status}
        </StatusBadge>
      ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (zone) => (
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setSelectedZoneId(zone.id)}>
            Embed
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              void setStatus.mutateAsync({
                zoneId: zone.id,
                status: zone.status === "active" ? "suspended" : "active",
              })
            }
            disabled={setStatus.isPending}
          >
            {zone.status === "active" ? "Suspend" : "Activate"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Ad zones</p>
          <p className="text-xs text-muted-foreground">
            Placements on this website and their embed snippets.
          </p>
        </div>
        <AdZoneDialog
          websiteId={website.id}
          onCreated={() => setTimeout(() => window.location.reload(), 300)}
          trigger={<Button size="sm">Add ad zone</Button>}
        />
      </div>

      <DataTable
        columns={columns}
        rows={zones}
        rowKey={(zone) => zone.id}
        emptyTitle="No ad zones yet"
        emptyDescription="Add your first ad zone to get an embed snippet."
        emptyAction={
          <AdZoneDialog websiteId={website.id} trigger={<Button size="sm">Add ad zone</Button>} />
        }
      />

      {selectedZone && originData ? (
        <EmbedCodePanel
          zone={selectedZone}
          domain={website.domain}
          origin={originData.origin}
          ready={ready}
        />
      ) : null}
    </div>
  );
}

function WebsiteSettingsTab({ website }: { website: WebsiteDetail["website"] }) {
  const [name, setName] = useState(website.name);
  const [description, setDescription] = useState(website.description ?? "");
  const [category, setCategory] = useState<WebsiteCategory>(website.category);
  const [monthlyPageviews, setMonthlyPageviews] = useState(website.monthly_pageviews.toString());
  const save = useSaveWebsite();

  async function submit() {
    if (name.trim().length < 2) {
      toast.error("Give the website a display name.");
      return;
    }
    try {
      await save.mutateAsync({
        websiteId: website.id,
        name: name.trim(),
        description: description.trim() || null,
        category,
        monthlyPageviews: monthlyPageviews ? Number(monthlyPageviews) : 0,
      });
      toast.success("Website details saved.");
    } catch (error) {
      const friendly = toFriendlyError(error, "We couldn't save those details");
      toast.error(friendly.message);
    }
  }

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Website settings</CardTitle>
        <CardDescription>
          Update the display name, category and pageview estimate for {website.domain}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="edit-name">Display name</Label>
          <Input id="edit-name" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="edit-category">Category</Label>
            <Select
              value={category}
              onValueChange={(value) => setCategory(value as WebsiteCategory)}
            >
              <SelectTrigger id="edit-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEBSITE_CATEGORIES.map((entry) => (
                  <SelectItem key={entry.value} value={entry.value}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-pageviews">Monthly pageviews</Label>
            <Input
              id="edit-pageviews"
              inputMode="numeric"
              value={monthlyPageviews}
              onChange={(event) => setMonthlyPageviews(event.target.value.replace(/[^0-9]/g, ""))}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-description">Description</Label>
          <textarea
            id="edit-description"
            rows={3}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={() => void submit()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function HealthTab({ websiteId, organizationId }: { websiteId: string; organizationId: string }) {
  const { data: checks, isLoading, error, refetch } = useWebsiteHealthChecks(websiteId);
  const runChecks = useRunWebsiteHealthChecks();

  async function handleRun() {
    try {
      await runChecks.mutateAsync({ websiteId, organizationId });
      await refetch();
      toast.success("Health checks completed");
    } catch (err) {
      toast.error(toFriendlyError(err as Error, "Failed to run health checks").message);
    }
  }

  if (isLoading) return <LoadingState rows={3} label="Running health checks" />;
  if (error) return <ErrorState title="Health check failed" message={error.message} onRetry={handleRun} />;

  const latestChecks = checks ?? [];
  const score = latestChecks.length > 0
    ? Math.round(latestChecks.reduce((sum, c) => sum + c.score, 0) / latestChecks.length)
    : 0;

  const checkLabels: Record<string, string> = {
    domain_verification: "Domain Verification",
    https: "HTTPS",
    privacy_policy: "Privacy Policy",
    terms_page: "Terms Page",
    ads_txt: "Ads.txt",
    website_status: "Website Status",
    policy_status: "Policy Status",
    ad_placement: "Ad Placement",
    traffic_quality: "Traffic Quality",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Website Health</p>
          <p className="text-xs text-muted-foreground">
            Automated checks to ensure your website is ready for ads.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={handleRun} disabled={runChecks.isPending}>
          <RefreshCw className="mr-1 size-4" />
          {runChecks.isPending ? "Checking..." : "Run checks"}
        </Button>
      </div>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Gauge className="size-4" />
            Health Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className={`text-4xl font-bold ${score >= 80 ? "text-success" : score >= 50 ? "text-yellow-600" : "text-destructive"}`}>
              {score}
            </div>
            <div className="text-sm text-muted-foreground">out of 100</div>
          </div>
          <div className="mt-3 h-2 w-full rounded-full bg-muted">
            <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${score}%` }} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {latestChecks.map((check) => (
          <Card key={check.id} className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                {check.passed ? (
                  <CheckCircle2 className="size-4 text-success" />
                ) : (
                  <XCircle className="size-4 text-destructive" />
                )}
                {checkLabels[check.check_type] ?? check.check_type}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Score: {check.score}/20
              </p>
              {check.details && typeof check.details === "object" && "note" in check.details && (
                <p className="text-xs text-muted-foreground mt-1">
                  {(check.details as { note?: string }).note}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function AdsTxtTab({ website }: { website: WebsiteDetail["website"] }) {
  const { data: record, isLoading, error, refetch } = useAdsTxtRecord(website.id);
  const createRecord = useUpsertAdsTxtRecord();
  const verify = useVerifyAdsTxt();
  const [domain] = useState(website.domain);

  async function handleCreate() {
    try {
      await createRecord.mutateAsync({
        websiteId: website.id,
        organizationId: website.organization_id,
        domain,
        publisherId: website.publisher_id,
      });
      toast.success("Ads.txt record created");
      refetch();
    } catch (err) {
      toast.error(toFriendlyError(err as Error, "Failed to create ads.txt record").message);
    }
  }

  async function handleVerify() {
    try {
      const result = await verify.mutateAsync({ websiteId: website.id, domain });
      if (result.verified) {
        toast.success("Ads.txt verified successfully");
      } else {
        toast.error(result.error || "Ads.txt verification failed");
      }
      refetch();
    } catch (err) {
      toast.error(toFriendlyError(err as Error, "Failed to verify ads.txt").message);
    }
  }

  if (isLoading) return <LoadingState rows={2} label="Loading ads.txt" />;
  if (error) return <ErrorState title="Failed to load ads.txt" message={error.message} onRetry={refetch} />;

  if (!record) {
    return (
      <div className="space-y-4">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Ads.txt</p>
          <p className="text-xs text-muted-foreground">
            Generate and publish your ads.txt file to improve transparency.
          </p>
        </div>
        <Button onClick={handleCreate} disabled={createRecord.isPending}>
          Generate ads.txt record
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">Ads.txt</p>
        <p className="text-xs text-muted-foreground">
          Add this record to your ads.txt file.
        </p>
      </div>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Your Seller Record</CardTitle>
          <CardDescription>
            Add the following line to <code className="text-xs">https://{domain}/ads.txt</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md bg-muted p-3 font-mono text-sm">
            {record.seller_record}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(record.seller_record);
                toast.success("Copied to clipboard");
              }}
            >
              <Copy className="mr-1 size-4" />
              Copy
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const blob = new Blob([record.seller_record + "\n"], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "ads.txt";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="mr-1 size-4" />
              Download
            </Button>
            <Button
              size="sm"
              onClick={handleVerify}
              disabled={verify.isPending}
            >
              <RefreshCw className="mr-1 size-4" />
              {verify.isPending ? "Verifying..." : "Verify"}
            </Button>
          </div>
          {record.is_verified ? (
            <p className="text-xs text-success">Verified on {new Date(record.last_verified_at!).toLocaleString()}</p>
          ) : record.verification_error ? (
            <p className="text-xs text-destructive">{record.verification_error}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function AutoAdsTab({ websiteId, domain }: { websiteId: string; domain: string }) {
  const { data: config, isLoading, error, refetch } = useAutoAdsConfig(websiteId);
  const upsertConfig = useUpsertAutoAdsConfig();
  const updateConfig = useUpdateAutoAdsConfig();
  const [enabled, setEnabled] = useState(false);
  const [adLoad, setAdLoad] = useState("balanced");
  const [excludedPages, setExcludedPages] = useState("");
  const [excludedSelectors, setExcludedSelectors] = useState("");
  const [minSpacing, setMinSpacing] = useState(300);

  useState(() => {
    if (config) {
      setEnabled(config.status === "enabled");
      setAdLoad(config.ad_load);
      setExcludedPages((config.excluded_pages as string[])?.join("\n") ?? "");
      setExcludedSelectors((config.excluded_selectors as string[])?.join("\n") ?? "");
      setMinSpacing(config.min_spacing ?? 300);
    }
  });

  async function handleSave() {
    try {
      await updateConfig.mutateAsync({
        websiteId,
        status: enabled ? "enabled" : "disabled",
        adLoad,
        enabledFormats: [],
        excludedPages: excludedPages.split("\n").filter(Boolean),
        excludedSelectors: excludedSelectors.split("\n").filter(Boolean),
        minSpacing,
        anchorAdsEnabled: true,
        overlayAdsEnabled: true,
        mobileAdsEnabled: true,
        bannerAdsEnabled: true,
        responsiveAdsEnabled: true,
      });
      toast.success("Auto Ads settings saved");
      refetch();
    } catch (err) {
      toast.error(toFriendlyError(err as Error, "Failed to save Auto Ads settings").message);
    }
  }

  if (isLoading) return <LoadingState rows={3} label="Loading Auto Ads" />;
  if (error) return <ErrorState title="Failed to load Auto Ads" message={error.message} onRetry={refetch} />;

  return (
    <div className="space-y-4">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">Auto Ads</p>
        <p className="text-xs text-muted-foreground">
          Automatically place ads on your website.
        </p>
      </div>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Auto Ads Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Enable Auto Ads</p>
              <p className="text-xs text-muted-foreground">
                Automatically insert ads into your pages.
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="space-y-2">
            <Label>Ad Load</Label>
            <Select value={adLoad} onValueChange={setAdLoad}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="balanced">Balanced</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Minimum Spacing (px)</Label>
            <Slider
              value={[minSpacing]}
              onValueChange={([value]) => setMinSpacing(value ?? 300)}
              min={0}
              max={1000}
              step={50}
            />
            <p className="text-xs text-muted-foreground">{minSpacing}px between ads</p>
          </div>

          <div className="space-y-2">
            <Label>Excluded Pages (one per line)</Label>
            <Textarea
              value={excludedPages}
              onChange={(e) => setExcludedPages(e.target.value)}
              placeholder="/checkout\n/account"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Excluded CSS Selectors (one per line)</Label>
            <Textarea
              value={excludedSelectors}
              onChange={(e) => setExcludedSelectors(e.target.value)}
              placeholder=".sidebar\n.related-posts"
              rows={3}
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={updateConfig.isPending}>
              {updateConfig.isPending ? "Saving..." : "Save settings"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AdControlsTab({ websiteId }: { websiteId: string }) {
  const { data: controls, isLoading, error, refetch } = useAdControls(websiteId);
  const updateControls = usePatchAdControls();

  const [blockedCategories, setBlockedCategories] = useState("");
  const [blockedAdvertisers, setBlockedAdvertisers] = useState("");
  const [maxFrequency, setMaxFrequency] = useState(3);
  const [lazyLoading, setLazyLoading] = useState(true);
  const [refreshMode, setRefreshMode] = useState("none");
  const [refreshInterval, setRefreshInterval] = useState(60);

  useState(() => {
    if (controls) {
      setBlockedCategories((controls.blocked_categories as string[])?.join("\n") ?? "");
      setBlockedAdvertisers((controls.blocked_advertisers as string[])?.join("\n") ?? "");
      setMaxFrequency(controls.max_frequency ?? 3);
      setLazyLoading(controls.lazy_loading_enabled);
      setRefreshMode(controls.refresh_mode);
      setRefreshInterval(controls.refresh_interval_seconds ?? 60);
    }
  });

  async function handleSave() {
    if (!controls) return;
    try {
      await updateControls.mutateAsync({
        controlsId: controls.id,
        blockedCategories: blockedCategories.split("\n").filter(Boolean),
        blockedAdvertisers: blockedAdvertisers.split("\n").filter(Boolean),
        maxFrequency,
        lazyLoadingEnabled: lazyLoading,
        refreshMode: refreshMode as "none" | "time_based" | "scroll_based",
        refreshIntervalSeconds: refreshMode === "time_based" ? refreshInterval : undefined,
      });
      toast.success("Ad controls saved");
      refetch();
    } catch (err) {
      toast.error(toFriendlyError(err as Error, "Failed to save ad controls").message);
    }
  }

  if (isLoading) return <LoadingState rows={3} label="Loading ad controls" />;
  if (error) return <ErrorState title="Failed to load ad controls" message={error.message} onRetry={refetch} />;

  if (!controls) {
    return (
      <div className="space-y-4">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Ad Controls</p>
          <p className="text-xs text-muted-foreground">
            Configure ad controls for this website.
          </p>
        </div>
        <Button onClick={() => {}} disabled>No controls configured</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">Ad Controls</p>
        <p className="text-xs text-muted-foreground">
          Manage ad formats, categories, and refresh settings.
        </p>
      </div>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Ad Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Blocked Categories (one per line)</Label>
            <Textarea
              value={blockedCategories}
              onChange={(e) => setBlockedCategories(e.target.value)}
              placeholder="adult\nviolence"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Blocked Advertisers (one per line)</Label>
            <Textarea
              value={blockedAdvertisers}
              onChange={(e) => setBlockedAdvertisers(e.target.value)}
              placeholder="competitor1\ncompetitor2"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Maximum Ad Frequency (impressions per session)</Label>
            <Input
              type="number"
              value={maxFrequency}
              onChange={(e) => setMaxFrequency(Number(e.target.value))}
              min={1}
              max={20}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Lazy Loading</p>
              <p className="text-xs text-muted-foreground">
                Load ads only when they enter the viewport.
              </p>
            </div>
            <Switch checked={lazyLoading} onCheckedChange={setLazyLoading} />
          </div>

          <div className="space-y-2">
            <Label>Refresh Mode</Label>
            <Select value={refreshMode} onValueChange={setRefreshMode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Refresh</SelectItem>
                <SelectItem value="time_based">Time Based</SelectItem>
                <SelectItem value="scroll_based">Scroll Based</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {refreshMode === "time_based" && (
            <div className="space-y-2">
              <Label>Refresh Interval (seconds)</Label>
              <Input
                type="number"
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                min={10}
                max={300}
              />
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={updateControls.isPending}>
              {updateControls.isPending ? "Saving..." : "Save controls"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
