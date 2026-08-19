import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable, type DataTableColumn } from "@/components/patterns/data-table";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import {
  fetchSandboxOrigin,
  fetchSandboxZones,
  fetchZoneDiagnostics,
} from "@/lib/ad-sandbox.functions";
import { toFriendlyError } from "@/lib/errors";

const REASON_COPY: Record<string, string> = {
  zone_inactive: "Ad zone is suspended",
  website_inactive: "Website is not active",
  website_unapproved: "Website is not approved",
  website_unverified: "Website ownership is not verified",
  publisher_inactive: "Publisher account is not active",
  publisher_unapproved: "Publisher is not approved",
  campaign_not_approved: "Campaign is not approved",
  campaign_not_active: "Campaign is paused, draft or completed",
  campaign_not_started: "Campaign has not started yet",
  campaign_ended: "Campaign has expired",
  budget_exhausted: "Campaign budget is spent",
  ad_not_approved: "Advertisement is not approved",
  ad_not_active: "Advertisement is disabled",
  no_creative: "Advertisement has no creative",
  format_mismatch: "Creative format doesn't fit this zone",
  targeting_mismatch: "Targeting rules exclude this request",
  eligible: "Eligible",
  unknown_zone: "Zone key not recognised",
  zone_unavailable: "Zone or website is not cleared to serve",
  no_ad: "No eligible advertisement",
};

type Diagnostics = Awaited<ReturnType<typeof fetchZoneDiagnostics>>;
type CandidateRow = Diagnostics["candidates"][number];

export const Route = createFileRoute("/_authenticated/publisher/sandbox")({
  head: () => ({
    meta: [
      { title: "Delivery Sandbox — Publisher — TradeMall" },
      {
        name: "description",
        content:
          "Test the full ad delivery path end to end: zone request, rendering, impression and click tracking.",
      },
      { property: "og:title", content: "Delivery Sandbox — Publisher — TradeMall" },
      {
        property: "og:description",
        content:
          "Test the full ad delivery path end to end: zone request, rendering, impression and click tracking.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <WorkspaceGuard workspace="publisher">
      <SandboxPage />
    </WorkspaceGuard>
  );
}

function SandboxPage() {
  const loadZones = useServerFn(fetchSandboxZones);
  const loadOrigin = useServerFn(fetchSandboxOrigin);
  const diagnose = useServerFn(fetchZoneDiagnostics);

  const zonesQuery = useQuery({ queryKey: ["sandbox-zones"], queryFn: () => loadZones() });
  const originQuery = useQuery({ queryKey: ["sandbox-origin"], queryFn: () => loadOrigin() });

  const zones = zonesQuery.data?.zones ?? [];
  const [zoneKey, setZoneKey] = useState("");
  const activeZoneKey = zoneKey || zones[0]?.zoneKey || "";
  const selectedZone = zones.find((zone) => zone.zoneKey === activeZoneKey) ?? null;

  const diagnostics = useMutation({
    mutationFn: (key: string) => diagnose({ data: { zoneKey: key } }),
  });

  const [rawResponse, setRawResponse] = useState<string | null>(null);
  const origin = originQuery.data?.origin ?? "";

  async function inspectRawResponse(key: string) {
    try {
      const response = await fetch(`/api/public/ad?zone=${encodeURIComponent(key)}`);
      setRawResponse(JSON.stringify(await response.json(), null, 2));
    } catch (error) {
      setRawResponse(toFriendlyError(error).message);
    }
  }

  const columns: DataTableColumn<CandidateRow>[] = useMemo(
    () => [
      {
        id: "ad",
        header: "Advertisement",
        cell: (row) => (
          <div className="space-y-0.5">
            <p className="font-medium">{row.adName}</p>
            <p className="text-numeric text-xs text-muted-foreground">{row.adFormat}</p>
          </div>
        ),
      },
      {
        id: "verdict",
        header: "Eligibility",
        cell: (row) => (
          <Badge variant={row.verdict === "eligible" ? "default" : "outline"}>
            {REASON_COPY[row.verdict] ?? row.verdict}
          </Badge>
        ),
      },
      {
        id: "score",
        header: "Score",
        cell: (row) => (
          <span className="text-numeric">{row.score === null ? "—" : row.score.toFixed(5)}</span>
        ),
      },
      {
        id: "winner",
        header: "Selected",
        cell: (row) =>
          row.winner ? <Badge>Winner</Badge> : <span className="text-muted-foreground">—</span>,
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Delivery sandbox"
        description="A test publisher page served by the live ad stack: real zone request, real rendering, real impression and click tracking."
      />

      <Card>
        <CardHeader>
          <CardTitle>1. Pick an ad zone</CardTitle>
          <CardDescription>
            Zones from your own websites. Approval and verification state decide whether the zone
            may serve at all.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {zonesQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading your ad zones…</p>
          ) : zones.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You don't have any ad zones yet. Create one from Ad Zones first.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {zones.map((zone) => (
                <Button
                  key={zone.zoneKey}
                  variant={zone.zoneKey === activeZoneKey ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setZoneKey(zone.zoneKey);
                    setRawResponse(null);
                    diagnostics.reset();
                  }}
                >
                  {zone.zoneName} · {zone.format}
                </Button>
              ))}
            </div>
          )}

          {selectedZone ? (
            <dl className="grid gap-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-muted-foreground">Website</dt>
                <dd className="font-medium">{selectedZone.websiteDomain}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Zone status</dt>
                <dd className="font-medium capitalize">{selectedZone.zoneStatus}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Approval</dt>
                <dd className="font-medium capitalize">{selectedZone.websiteApproval}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Verification</dt>
                <dd className="font-medium capitalize">{selectedZone.websiteVerification}</dd>
              </div>
            </dl>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Live slot</CardTitle>
          <CardDescription>
            Rendered by <code className="text-numeric">{origin}/ad/loader.js</code> exactly as it
            would be on your site. Scroll it into view to fire the impression, then click the
            creative to test the tracked redirect.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdSlot zoneKey={activeZoneKey} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Raw ad response</CardTitle>
          <CardDescription>
            What the browser is allowed to see. No campaign, bid or budget data ever leaves the
            server.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            size="sm"
            variant="outline"
            disabled={!activeZoneKey}
            onClick={() => inspectRawResponse(activeZoneKey)}
          >
            Send ad request
          </Button>
          {rawResponse ? (
            <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs">
              {rawResponse}
            </pre>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>4. Eligibility trace</CardTitle>
          <CardDescription>
            Every candidate advertisement with the exact reason it was kept or dropped — disabled
            campaigns, expired dates, exhausted budgets, wrong formats, unverified websites and
            targeting misses all show up here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            size="sm"
            disabled={!activeZoneKey || diagnostics.isPending}
            onClick={() => diagnostics.mutate(activeZoneKey)}
          >
            {diagnostics.isPending ? "Running…" : "Run eligibility check"}
          </Button>

          {diagnostics.error ? (
            <p className="text-sm text-destructive">{toFriendlyError(diagnostics.error).message}</p>
          ) : null}

          {diagnostics.data ? (
            <div className="space-y-4">
              <div className="rounded-md border p-3 text-sm">
                <p className="font-medium">
                  Zone gate:{" "}
                  {diagnostics.data.zone.serveable
                    ? "open"
                    : `blocked — ${REASON_COPY[diagnostics.data.zone.blockedBy ?? ""] ?? diagnostics.data.zone.blockedBy}`}
                </p>
                <p className="text-muted-foreground">
                  Signals: {diagnostics.data.signals.device} · {diagnostics.data.signals.os} ·{" "}
                  {diagnostics.data.signals.browser} · {diagnostics.data.zone.websiteCategory} ·{" "}
                  {diagnostics.data.signals.weekday} {diagnostics.data.signals.hour}:00 UTC
                </p>
              </div>

              {diagnostics.data.candidates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No advertisements reached the candidate pool for this format.
                </p>
              ) : (
                <DataTable
                  columns={columns}
                  rows={diagnostics.data.candidates}
                  rowKey={(row) => row.adId}
                />
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

/** Mounts a real publisher slot and (re)loads the embed SDK for it. */
function AdSlot({ zoneKey }: { zoneKey: string }) {
  const slotRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"idle" | "filled" | "empty">("idle");

  useEffect(() => {
    const slot = slotRef.current;
    if (!slot || !zoneKey) return;

    setState("idle");
    slot.removeAttribute("data-trademall-filled");
    slot.style.removeProperty("display");
    slot.replaceChildren();

    const onEmpty = () => setState("empty");
    slot.addEventListener("trademall:empty", onEmpty);

    const observer = new MutationObserver(() => {
      if (slot.querySelector("a img")) setState("filled");
    });
    observer.observe(slot, { childList: true, subtree: true });

    const refresh = (window as unknown as { TradeMall?: { refresh: () => void } }).TradeMall;
    let script: HTMLScriptElement | null = null;
    if (refresh) {
      refresh.refresh();
    } else {
      script = document.createElement("script");
      script.src = "/ad/loader.js";
      script.async = true;
      document.body.appendChild(script);
    }

    return () => {
      slot.removeEventListener("trademall:empty", onEmpty);
      observer.disconnect();
      if (script) script.remove();
    };
  }, [zoneKey]);

  return (
    <div className="space-y-2">
      <div className="rounded-md border border-dashed bg-muted/30 p-4">
        <div
          ref={slotRef}
          data-trademall-zone={zoneKey || undefined}
          style={{ minHeight: 60, width: "100%" }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {state === "filled"
          ? "Advertisement rendered — impression recorded on view."
          : state === "empty"
            ? "No eligible advertisement. The slot collapses without affecting the page."
            : "Waiting for the ad request…"}
      </p>
    </div>
  );
}
