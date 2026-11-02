import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/patterns/page-header";
import { ReferralDashboard } from "@/components/referral/referral-dashboard";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import { usePublisherOrg } from "@/hooks/use-publisher";

export const Route = createFileRoute("/_authenticated/publisher/referrals")({
  head: () => ({
    meta: [
      { title: "Refer & Earn — Publisher — TradeMall" },
      { name: "description", content: "Invite advertisers and publishers to TradeMall and earn cash." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PublisherReferrals,
});

function PublisherReferrals() {
  const org = usePublisherOrg();
  return (
    <WorkspaceGuard workspace="publisher">
      <PageHeader
        eyebrow="Publisher"
        title="Refer & Earn"
        description="Invite advertisers and publishers to TradeMall. You earn cash from the revenue they bring in."
      />
      <ReferralDashboard audience="publisher" organizationId={org.organizationId} loadingOrganization={org.loading} />
    </WorkspaceGuard>
  );
}
