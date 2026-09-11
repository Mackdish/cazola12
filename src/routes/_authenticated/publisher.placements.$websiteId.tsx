import { createFileRoute, Link } from "@tanstack/react-router";

import { PlacementManager } from "@/components/publisher/placement-manager";
import { PublisherSdkInstallCard } from "@/components/publisher/publisher-sdk-install-card";
import { PageHeader } from "@/components/patterns/page-header";
import { LoadingState, ErrorState } from "@/components/patterns/states";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import { Button } from "@/components/ui/button";
import { usePublisherOrg, useWebsites } from "@/hooks/use-publisher";

export const Route = createFileRoute("/_authenticated/publisher/placements/$websiteId")({
  head: () => ({ meta: [{ title: "Website placements — Publisher — TradeMall" }, { name: "robots", content: "noindex" }] }),
  component: WebsitePlacementsPage,
});

function WebsitePlacementsPage() {
  const { websiteId } = Route.useParams();
  const { organizationId } = usePublisherOrg();
  const { data: websites, isLoading, error } = useWebsites(organizationId);
  const website = websites?.find((site) => site.id === websiteId);
  const ready = website?.verification_status === "verified" && website?.approval_status === "approved";

  return (
    <WorkspaceGuard workspace="publisher">
      {isLoading ? <LoadingState rows={3} label="Loading website" /> : error ? <ErrorState title="Couldn't load website" message={error.message} /> : !website ? <ErrorState title="Website not found" message="That website doesn't exist or you don't have access to it." /> : (
        <div className="space-y-6">
          <PageHeader eyebrow="Publisher · Placements" title={website.name} description={`Choose where TradeMall ads should appear on ${website.domain}.`} actions={<Button asChild variant="ghost" size="sm"><Link to="/publisher/websites/$websiteId" params={{ websiteId }}>Website settings</Link></Button>} />
          <PlacementManager websiteId={website.id} ready={Boolean(ready)} />
          <PublisherSdkInstallCard />
        </div>
      )}
    </WorkspaceGuard>
  );
}
