import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Globe } from "lucide-react";

import { PlacementManager } from "@/components/publisher/placement-manager";
import { PageHeader } from "@/components/patterns/page-header";
import { LoadingState, EmptyState } from "@/components/patterns/states";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePublisherOrg, useWebsites } from "@/hooks/use-publisher";

export const Route = createFileRoute("/_authenticated/publisher/placements")({
  head: () => ({
    meta: [
      { title: "Placements — Publisher — TradeMall" },
      { name: "description", content: "Choose where TradeMall ads should appear on each publisher website." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PlacementsPage,
});

function PlacementsPage() {
  const { organizationId } = usePublisherOrg();
  const { data: websites, isLoading } = useWebsites(organizationId);
  const [websiteId, setWebsiteId] = useState<string>("");

  const selectedId = websiteId || websites?.[0]?.id || "";
  const selected = websites?.find((site) => site.id === selectedId);
  const ready = selected?.verification_status === "verified" && selected?.approval_status === "approved";

  return (
    <WorkspaceGuard workspace="publisher">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Publisher"
          title="Placements"
          description="Select the locations where TradeMall should place ads. No HTML snippets are required for this workflow."
        />

        {isLoading ? <LoadingState rows={3} label="Loading websites" /> : !websites?.length ? (
          <EmptyState
            icon={<Globe className="size-5" />}
            title="Add a website first"
            description="Once your website is registered, you can choose its ad placements here."
          />
        ) : (
          <div className="space-y-4">
            <div className="max-w-md space-y-2">
              <label className="text-sm font-medium" htmlFor="placement-website">Website</label>
              <Select value={selectedId} onValueChange={setWebsiteId}>
                <SelectTrigger id="placement-website"><SelectValue placeholder="Select a website" /></SelectTrigger>
                <SelectContent>
                  {websites.map((site) => <SelectItem key={site.id} value={site.id}>{site.name} — {site.domain}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {selected ? <PlacementManager websiteId={selected.id} ready={Boolean(ready)} /> : null}
          </div>
        )}
      </div>
    </WorkspaceGuard>
  );
}
