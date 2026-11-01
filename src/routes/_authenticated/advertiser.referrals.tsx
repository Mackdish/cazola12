import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/patterns/page-header";
import { ReferralDashboard } from "@/components/referral/referral-dashboard";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import { useAdvertiserOrg } from "@/hooks/use-billing";

export const Route = createFileRoute("/_authenticated/advertiser/referrals")({
  head: () => ({
    meta: [
      { title: "Refer & Earn — Advertiser — TradeMall" },
      { name: "description", content: "Invite advertisers and publishers to TradeMall and earn ad credit." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdvertiserReferrals,
});

function AdvertiserReferrals() {
  const org = useAdvertiserOrg();
  return (
    <WorkspaceGuard workspace="advertiser">
      <PageHeader
        eyebrow="Advertiser"
        title="Refer & Earn"
        description="Invite advertisers and publishers to TradeMall. You earn ad credit from the revenue they bring in."
      />
      <ReferralDashboard audience="advertiser" organizationId={org.organizationId} loadingOrganization={org.loading} />
    </WorkspaceGuard>
  );
}
