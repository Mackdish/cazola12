import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/patterns/page-header";
import { ErrorState, LoadingState } from "@/components/patterns/states";
import { StatusBadge, statusTone } from "@/components/patterns/status-badge";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import {
  useAdvertiserOrg,
  useAdvertiserProfile,
  useSaveAdvertiserProfile,
} from "@/hooks/use-advertiser";
import { useAuth } from "@/lib/auth-context";
import { roleLabel } from "@/lib/authorization";
import { toFriendlyError } from "@/lib/errors";

export const Route = createFileRoute("/_authenticated/advertiser/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Advertiser — TradeMall" },
      { name: "description", content: "Organization profile, billing details and team members." },
      { property: "og:title", content: "Settings — Advertiser — TradeMall" },
      {
        property: "og:description",
        content: "Organization profile, billing details and team members.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

function Page() {
  const { organizationId, organization, role, canManage } = useAdvertiserOrg();
  const { data: profile, isLoading, error, refetch } = useAdvertiserProfile(organizationId);

  return (
    <WorkspaceGuard workspace="advertiser">
      <PageHeader
        eyebrow="Advertiser"
        title="Settings"
        description="Organization profile, billing details and team members."
      />

      {isLoading ? (
        <LoadingState rows={3} label="Loading advertiser settings" />
      ) : error ? (
        <ErrorState
          title="Couldn't load settings"
          message={error.message}
          onRetry={() => void refetch()}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <ProfileForm
              key={(profile as { id?: string } | null)?.id ?? "new"}
              organizationId={organizationId}
              initial={(profile as ProfileRow | null) ?? null}
              canManage={canManage}
            />
          </div>

          <div className="space-y-6 lg:col-span-1">
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle className="text-base">Organization</CardTitle>
                <CardDescription>Read-only workspace details.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Row label="Name" value={organization?.name ?? "—"} />
                <Row label="Slug" value={organization?.slug ?? "—"} />
                <Row label="Your role" value={role ? roleLabel(role) : "—"} />
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Org status</span>
                  <StatusBadge tone={statusTone(organization?.status ?? "")}>
                    {organization?.status ?? "unknown"}
                  </StatusBadge>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Approval</span>
                  <StatusBadge
                    tone={statusTone((profile as ProfileRow | null)?.approval_status ?? "")}
                  >
                    {(profile as ProfileRow | null)?.approval_status ?? "not submitted"}
                  </StatusBadge>
                </div>
                {(profile as ProfileRow | null)?.rejection_reason ? (
                  <p className="rounded-md border border-destructive/25 bg-destructive/10 p-2 text-xs text-destructive">
                    {(profile as ProfileRow).rejection_reason}
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <TeamCard organizationId={organizationId} />
          </div>
        </div>
      )}
    </WorkspaceGuard>
  );
}

type ProfileRow = {
  id?: string;
  business_name: string;
  contact_email: string;
  industry?: string | null;
  contact_phone?: string | null;
  approval_status?: string;
  rejection_reason?: string | null;
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function ProfileForm({
  organizationId,
  initial,
  canManage,
}: {
  organizationId: string | null;
  initial: ProfileRow | null;
  canManage: boolean;
}) {
  const [businessName, setBusinessName] = useState(initial?.business_name ?? "");
  const [contactEmail, setContactEmail] = useState(initial?.contact_email ?? "");
  const [industry, setIndustry] = useState(initial?.industry ?? "");
  const [contactPhone, setContactPhone] = useState(initial?.contact_phone ?? "");
  const save = useSaveAdvertiserProfile();

  const { user } = useAuth();
  useEffect(() => {
    if (!initial && !contactEmail && user?.email) setContactEmail(user.email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

  async function submit() {
    if (!organizationId) {
      toast.error("No advertiser organization selected.");
      return;
    }
    if (businessName.trim().length < 2) {
      toast.error("Enter a business name.");
      return;
    }
    if (!contactEmail.includes("@")) {
      toast.error("Enter a valid contact email.");
      return;
    }
    try {
      await save.mutateAsync({
        organizationId,
        businessName: businessName.trim(),
        contactEmail: contactEmail.trim(),
        industry: industry.trim() || null,
        contactPhone: contactPhone.trim() || null,
      });
      toast.success("Advertiser profile saved.");
    } catch (error) {
      toast.error(toFriendlyError(error, "We couldn't save your profile").message);
    }
  }

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Advertiser profile</CardTitle>
        <CardDescription>
          Required before you can launch campaigns. The platform team reviews these details.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="business-name">Business name</Label>
          <Input
            id="business-name"
            value={businessName}
            onChange={(event) => setBusinessName(event.target.value)}
            disabled={!canManage}
            placeholder="Acme Media Inc."
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
              value={contactPhone ?? ""}
              onChange={(event) => setContactPhone(event.target.value)}
              disabled={!canManage}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="industry">Industry</Label>
          <Input
            id="industry"
            value={industry ?? ""}
            onChange={(event) => setIndustry(event.target.value)}
            disabled={!canManage}
            placeholder="Retail, SaaS, Finance…"
          />
        </div>
        {!canManage ? (
          <p className="text-xs text-muted-foreground">
            Only organization owners, admins and managers can edit these details.
          </p>
        ) : null}
        <div className="flex justify-end">
          <Button onClick={() => void submit()} disabled={!canManage || save.isPending}>
            {save.isPending ? "Saving…" : initial ? "Save profile" : "Create profile"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TeamCard({ organizationId }: { organizationId: string | null }) {
  const { memberships, profile } = useAuth();
  const membership = memberships.find((m) => m.organization.id === organizationId) ?? null;

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Your membership</CardTitle>
        <CardDescription>Ask an owner to invite additional team members.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <Row label="Name" value={profile?.full_name ?? "—"} />
        <Row label="Role" value={membership ? roleLabel(membership.role) : "—"} />
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Status</span>
          <StatusBadge tone={statusTone(membership?.status ?? "")}>
            {membership?.status ?? "—"}
          </StatusBadge>
        </div>
      </CardContent>
    </Card>
  );
}
