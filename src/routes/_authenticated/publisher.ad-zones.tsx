import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable, type DataTableColumn } from "@/components/patterns/data-table";
import { StatusBadge } from "@/components/patterns/status-badge";
import { EmbedCodePanel } from "@/components/publisher/embed-code-panel";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import {
  useAdServerOrigin,
  useAdZones,
  usePublisherOrg,
  useSetAdZoneStatus,
} from "@/hooks/use-publisher";
import { toFriendlyError } from "@/lib/errors";
import { formatDimensions, type AdZone, type Website } from "@/lib/publisher-domain";

type ZoneRow = AdZone & {
  websites: Pick<
    Website,
    "id" | "domain" | "name" | "verification_status" | "approval_status"
  > | null;
};

export const Route = createFileRoute("/_authenticated/publisher/ad-zones")({
  head: () => ({
    meta: [
      { title: "Ad Zones — Publisher — TradeMall" },
      {
        name: "description",
        content: "Every placement across your websites, with formats, status and embed snippets.",
      },
      { property: "og:title", content: "Ad Zones — Publisher — TradeMall" },
      {
        property: "og:description",
        content: "Every placement across your websites, with formats, status and embed snippets.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <WorkspaceGuard workspace="publisher">
      <AdZonesPage />
    </WorkspaceGuard>
  );
}

function AdZonesPage() {
  const { organizationId } = usePublisherOrg();
  const { data, isLoading, error, refetch } = useAdZones(organizationId);
  const { data: originData } = useAdServerOrigin();
  const setStatus = useSetAdZoneStatus();
  const [query, setQuery] = useState("");
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  const zones = (data ?? []) as ZoneRow[];

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return zones;
    return zones.filter((zone) =>
      [
        zone.name,
        zone.zone_key,
        zone.format,
        zone.websites?.domain ?? "",
        zone.websites?.name ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [zones, query]);

  const selectedZone = zones.find((zone) => zone.id === selectedZoneId) ?? null;
  const activeCount = zones.filter((zone) => zone.status === "active").length;

  const columns: DataTableColumn<ZoneRow>[] = [
    {
      id: "name",
      header: "Ad zone",
      cell: (zone) => (
        <div className="space-y-0.5">
          <p className="font-medium">{zone.name}</p>
          <p className="text-numeric text-xs text-muted-foreground">{zone.zone_key}</p>
        </div>
      ),
    },
    {
      id: "website",
      header: "Website",
      cell: (zone) =>
        zone.websites ? (
          <Link
            to="/publisher/websites/$websiteId"
            params={{ websiteId: zone.websites.id }}
            className="text-sm underline-offset-4 hover:underline"
          >
            {zone.websites.domain}
          </Link>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      id: "format",
      header: "Format",
      cell: (zone) => <span className="text-sm">{formatDimensions(zone)}</span>,
    },
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
      id: "serving",
      header: "Serving",
      cell: (zone) => {
        const ready =
          zone.websites?.verification_status === "verified" &&
          zone.websites?.approval_status === "approved";
        return (
          <StatusBadge tone={ready ? "active" : "pending"}>
            {ready ? "Eligible" : "Awaiting review"}
          </StatusBadge>
        );
      },
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
            disabled={setStatus.isPending}
            onClick={() =>
              void setStatus.mutateAsync({
                zoneId: zone.id,
                status: zone.status === "active" ? "suspended" : "active",
              })
            }
          >
            {zone.status === "active" ? "Suspend" : "Activate"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Publisher"
        title="Ad Zones"
        description="Placements, sizes and the embed snippets that serve them."
        actions={
          <Button asChild size="sm" variant="outline">
            <Link to="/publisher/websites">Manage websites</Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by zone, key, format or domain"
          aria-label="Search ad zones"
          className="sm:max-w-sm"
        />
        <p className="text-xs text-muted-foreground">
          <span className="text-numeric">{activeCount}</span> active of{" "}
          <span className="text-numeric">{zones.length}</span> zones
        </p>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(zone) => zone.id}
        isLoading={isLoading}
        error={error ? toFriendlyError(error).message : null}
        onRetry={() => void refetch()}
        caption="Ad zones across all of your websites"
        emptyTitle={query ? "No matching ad zones" : "No ad zones yet"}
        emptyDescription={
          query
            ? "Try a different search term."
            : "Open a website and add your first placement to get an embed snippet."
        }
        emptyAction={
          query ? undefined : (
            <Button asChild size="sm">
              <Link to="/publisher/websites">Go to websites</Link>
            </Button>
          )
        }
      />

      {selectedZone && originData ? (
        <EmbedCodePanel
          zone={selectedZone}
          domain={selectedZone.websites?.domain ?? ""}
          origin={originData.origin}
          ready={
            selectedZone.websites?.verification_status === "verified" &&
            selectedZone.websites?.approval_status === "approved"
          }
        />
      ) : null}
    </div>
  );
}
