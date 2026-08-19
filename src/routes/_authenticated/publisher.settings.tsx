import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/patterns/page-header";
import { ErrorState, LoadingState } from "@/components/patterns/states";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import {
  usePublisherOrg,
  usePublisherProfile,
  useSavePublisherProfile,
} from "@/hooks/use-publisher";
import { toFriendlyError } from "@/lib/errors";

export const Route = createFileRoute("/_authenticated/publisher/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Publisher — TradeMall" },
      {
        name: "description",
        content: "Organization profile, payout preferences and team members.",
      },
      { property: "og:title", content: "Settings — Publisher — TradeMall" },
      {
        property: "og:description",
        content: "Organization profile, payout preferences and team members.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PublisherSettingsPage,
});

function PublisherSettingsPage() {
  const { organizationId, canManage } = usePublisherOrg();
  const { data: profile, isLoading, error, refetch } = usePublisherProfile(organizationId);

  return (
    <WorkspaceGuard workspace="publisher">
      <PageHeader
        eyebrow="Publisher"
        title="Settings"
        description="Organization profile, payout preferences and team members."
      />

      {isLoading ? (
        <LoadingState rows={3} label="Loading profile" />
      ) : error ? (
        <ErrorState
          title="Couldn't load profile"
          message={error.message}
          onRetry={() => void refetch()}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ProfileForm
              organizationId={organizationId}
              initial={profile ?? null}
              canManage={canManage}
            />
          </div>
          <Card className="shadow-none lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">Need help?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Contact the platform team to update your business name, payout details or tax
                information.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </WorkspaceGuard>
  );
}

function ProfileForm({
  organizationId,
  initial,
  canManage,
}: {
  organizationId: string | null;
  initial: {
    business_name: string;
    contact_email: string;
    contact_phone?: string | null;
    website_url?: string | null;
  } | null;
  canManage: boolean;
}) {
  const [businessName, setBusinessName] = useState(initial?.business_name ?? "");
  const [contactEmail, setContactEmail] = useState(initial?.contact_email ?? "");
  const [contactPhone, setContactPhone] = useState(initial?.contact_phone ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(initial?.website_url ?? "");
  const save = useSavePublisherProfile();

  async function submit() {
    if (!organizationId) {
      toast.error("No publisher organization selected.");
      return;
    }
    if (!businessName.trim() || businessName.trim().length < 2) {
      toast.error("Enter a business name.");
      return;
    }
    if (!contactEmail.trim() || !contactEmail.includes("@")) {
      toast.error("Enter a valid contact email.");
      return;
    }
    try {
      await save.mutateAsync({
        organizationId,
        businessName: businessName.trim(),
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim() || null,
        websiteUrl: websiteUrl.trim() || null,
      });
      toast.success("Profile saved.");
    } catch (error) {
      const friendly = toFriendlyError(error, "We couldn't save your profile");
      toast.error(friendly.message);
    }
  }

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Publisher profile</CardTitle>
        <CardDescription>Public-facing details for your supply organization.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="business-name">Business name</Label>
          <Input
            id="business-name"
            value={businessName}
            onChange={(event) => setBusinessName(event.target.value)}
            disabled={!canManage}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="contact-email">Contact email</Label>
            <Input
              id="contact-email"
              type="email"
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
              disabled={!canManage}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-phone">Contact phone</Label>
            <Input
              id="contact-phone"
              value={contactPhone}
              onChange={(event) => setContactPhone(event.target.value)}
              disabled={!canManage}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="website-url">Publisher website URL</Label>
          <Input
            id="website-url"
            type="url"
            value={websiteUrl}
            onChange={(event) => setWebsiteUrl(event.target.value)}
            disabled={!canManage}
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={() => void submit()} disabled={!canManage || save.isPending}>
            {save.isPending ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
