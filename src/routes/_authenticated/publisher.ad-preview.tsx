import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Monitor, Tablet, Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/patterns/states";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import { useAdZones, usePublisherOrg } from "@/hooks/use-publisher";

type DeviceSize = "desktop" | "tablet" | "mobile";

const DEVICE_WIDTHS: Record<DeviceSize, number> = {
  desktop: 1200,
  tablet: 768,
  mobile: 375,
};

const AD_SLOTS = ["header", "sidebar", "in-content", "footer"] as const;

export const Route = createFileRoute("/_authenticated/publisher/ad-preview")({
  head: () => ({
    meta: [
      { title: "Ad Preview — Publisher — TradeMall" },
      {
        name: "description",
        content: "Preview how your ad placements look across desktop, tablet and mobile.",
      },
      { property: "og:title", content: "Ad Preview — Publisher — TradeMall" },
      {
        property: "og:description",
        content: "Preview how your ad placements look across desktop, tablet and mobile.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <WorkspaceGuard workspace="publisher">
      <AdPreviewPage />
    </WorkspaceGuard>
  );
}

function AdPreviewPage() {
  const { organizationId } = usePublisherOrg();
  const { data: zones, isLoading, error, refetch } = useAdZones(organizationId);

  const [device, setDevice] = useState<DeviceSize>("desktop");
  const [selectedZoneId, setSelectedZoneId] = useState<string>("");
  const [enabledSlots, setEnabledSlots] = useState<Record<string, boolean>>({
    header: true,
    sidebar: true,
    "in-content": true,
    footer: true,
  });

  const zoneList = useMemo(() => zones ?? [], [zones]);

  const selectedZone = useMemo(
    () => zoneList.find((zone) => zone.id === selectedZoneId) ?? null,
    [zoneList, selectedZoneId],
  );

  useEffect(() => {
    if (!selectedZoneId && zoneList.length > 0) {
      setSelectedZoneId(zoneList[0]!.id);
    }
  }, [selectedZoneId, zoneList]);

  function toggleSlot(slot: string) {
    setEnabledSlots((prev) => ({ ...prev, [slot]: !prev[slot] }));
  }

  const previewHtml = useMemo(() => {
    const showHeader = enabledSlots["header"];
    const showSidebar = enabledSlots["sidebar"] && device !== "mobile";
    const showInContent = enabledSlots["in-content"];
    const showFooter = enabledSlots["footer"];

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #0f172a; line-height: 1.5; }
  .container { max-width: 1200px; margin: 0 auto; padding: 16px; display: flex; gap: 16px; }
  .main { flex: 1; min-width: 0; }
  .sidebar { width: 300px; flex-shrink: 0; }
  header { background: #ffffff; border-bottom: 1px solid #e2e8f0; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; }
  .logo { font-weight: 700; font-size: 18px; color: #0f172a; }
  .nav { display: flex; gap: 12px; }
  .nav a { color: #64748b; text-decoration: none; font-size: 14px; }
  .hero { background: linear-gradient(135deg, #1e293b, #334155); color: white; padding: 24px; border-radius: 8px; margin-bottom: 16px; }
  .hero h1 { font-size: 22px; margin-bottom: 8px; }
  .hero p { opacity: 0.9; font-size: 14px; }
  .card { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
  .card h2 { font-size: 16px; margin-bottom: 8px; }
  .card p { color: #475569; font-size: 14px; }
  .ad-slot { background: repeating-linear-gradient(45deg, #e2e8f0, #e2e8f0 8px, #f1f5f9 8px, #f1f5f9 16px); border: 1px dashed #94a3b8; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #64748b; font-size: 12px; font-weight: 500; margin: 12px 0; position: relative; }
  .ad-slot::before { content: attr(data-label); position: absolute; top: 6px; left: 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; }
  .slot-header { height: 90px; width: 100%; }
  .slot-sidebar { height: 250px; width: 100%; }
  .slot-in-content { height: 120px; width: 100%; }
  .slot-footer { height: 90px; width: 100%; }
  footer { background: #0f172a; color: #cbd5e1; padding: 16px; text-align: center; font-size: 12px; margin-top: 24px; border-radius: 8px; }
  .skeleton { background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 4px; }
  @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
  @media (max-width: 768px) {
    .container { flex-direction: column; }
    .sidebar { display: none; }
    .hero h1 { font-size: 18px; }
  }
</style>
</head>
<body>
  <header>
    <div class="logo">SampleSite</div>
    <nav class="nav">
      <a href="#">Home</a>
      <a href="#">Articles</a>
      <a href="#">About</a>
    </nav>
  </header>
  <div class="container">
    <div class="main">
      ${showHeader ? '<div class="ad-slot slot-header" data-label="Header Banner">728 x 90</div>' : ""}
      <div class="hero">
        <h1>Welcome to SampleSite</h1>
        <p>This is a sample publisher page used to preview ad placement rendering across device sizes.</p>
      </div>
      <div class="card">
        <h2>Latest Article</h2>
        <p>Sample publisher page content used to preview ad placement rendering across device sizes. Replace this with your actual article or page content.</p>
      </div>
      ${showInContent ? '<div class="ad-slot slot-in-content" data-label="In-Content">300 x 250</div>' : ""}
      <div class="card">
        <h2>More Content</h2>
        <p>More sample content below. This demonstrates how ads appear within article text on a typical publisher page.</p>
      </div>
      ${showFooter ? '<div class="ad-slot slot-footer" data-label="Footer">728 x 90</div>' : ""}
    </div>
    ${
      showSidebar
        ? `<div class="sidebar">
      <div class="card">
        <h2>About</h2>
        <p style="color: #475569; font-size: 14px;">SampleSite delivers the latest news and insights for developers and designers.</p>
      </div>
      <div class="ad-slot slot-sidebar" data-label="Sidebar">160 x 600</div>
      <div class="card">
        <h2>Trending</h2>
        <p style="color: #475569; font-size: 14px;">Top stories, curated daily for our readers.</p>
      </div>
    </div>`
        : ""
    }
  </div>
  <footer>
    SampleSite Demo · Ad Preview Mockup · Not a live production page
  </footer>
</body>
</html>`;
  }, [enabledSlots, device]);

  const containerWidth = DEVICE_WIDTHS[device];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Publisher"
        title="Ad Preview"
        description="Preview how your ad placements look across desktop, tablet and mobile."
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select value={selectedZoneId} onValueChange={setSelectedZoneId}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="Select an ad zone" />
            </SelectTrigger>
            <SelectContent>
              {zoneList.map((zone) => (
                <SelectItem key={zone.id} value={zone.id}>
                  {zone.name} · {zone.format}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Tabs value={device} onValueChange={(value) => setDevice(value as DeviceSize)}>
            <TabsList>
              <TabsTrigger value="desktop" className="gap-1.5">
                <Monitor className="size-4" />
                <span className="hidden sm:inline">Desktop</span>
              </TabsTrigger>
              <TabsTrigger value="tablet" className="gap-1.5">
                <Tablet className="size-4" />
                <span className="hidden sm:inline">Tablet</span>
              </TabsTrigger>
              <TabsTrigger value="mobile" className="gap-1.5">
                <Smartphone className="size-4" />
                <span className="hidden sm:inline">Mobile</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <Card className="w-full lg:w-auto">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Placement controls</CardTitle>
            <CardDescription>Toggle ad slots on or off.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {AD_SLOTS.map((slot) => (
                <Button
                  key={slot}
                  size="sm"
                  variant={enabledSlots[slot] ? "default" : "outline"}
                  onClick={() => toggleSlot(slot)}
                  className="capitalize"
                >
                  {slot.replace("-", " ")}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>
            {selectedZone
              ? `Simulated placement for "${selectedZone.name}" at ${containerWidth}px width.`
              : "Select an ad zone to preview its simulated placement."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingState rows={2} label="Loading preview" />
          ) : error ? (
            <ErrorState
              title="Couldn't load ad zones"
              message={error.message}
              onRetry={() => void refetch()}
            />
          ) : zoneList.length === 0 ? (
            <EmptyState
              title="No ad zones yet"
              description="Create an ad zone to preview its placement across devices."
              action={
                <Button asChild size="sm">
                  <a href="/publisher/websites">Go to websites</a>
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <div
                className="mx-auto bg-white transition-all duration-300"
                style={{
                  width: `${Math.min(containerWidth, 100)}%`,
                  maxWidth: `${containerWidth}px`,
                }}
              >
                <iframe
                  title="Ad placement preview"
                  sandbox=""
                  className="h-[520px] w-full rounded-md border-0"
                  srcDoc={previewHtml}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
