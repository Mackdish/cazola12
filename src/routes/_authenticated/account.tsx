import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/patterns/page-header";
import { StatusBadge, statusTone } from "@/components/patterns/status-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/patterns/states";
import { useAuth } from "@/lib/auth-context";
import { WORKSPACE_LABELS, roleLabel } from "@/lib/authorization";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "Your account — TradeMall" },
      {
        name: "description",
        content: "Review your TradeMall profile, organization memberships and platform access.",
      },
      { property: "og:title", content: "Your account — TradeMall" },
      {
        property: "og:description",
        content: "Review your profile, organization memberships and platform access.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const {
    user,
    profile,
    memberships,
    platformRoles,
    loadingIdentity,
    identityError,
    refreshIdentity,
    homePath,
  } = useAuth();

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="Account"
        title={profile?.full_name || "Your account"}
        {...(user?.email ? { description: user.email } : {})}
        actions={
          <Button asChild size="sm" variant="outline">
            <Link to={homePath}>Back to workspace</Link>
          </Button>
        }
      />

      {identityError ? (
        <ErrorState
          title={identityError.title}
          message={identityError.message}
          onRetry={() => void refreshIdentity()}
        />
      ) : null}

      {loadingIdentity && !profile ? <LoadingState rows={3} label="Loading your account" /> : null}

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Platform access</CardTitle>
          <CardDescription>
            Access is enforced by database policies, not only by this interface.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {platformRoles.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No platform-level roles. You only see data from organizations you belong to.
            </p>
          ) : (
            platformRoles.map((role) => (
              <Badge key={role} variant="secondary" className="gap-1.5">
                <ShieldCheck className="size-3.5" />
                {roleLabel(role)}
              </Badge>
            ))
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Organizations
        </h2>
        {memberships.length === 0 ? (
          <EmptyState
            icon={<Building2 className="size-5" />}
            title="No organization memberships"
            description="Create an organization to start advertising or monetizing, or ask an owner to invite you."
            action={
              <Button asChild size="sm">
                <Link to="/onboarding">Create an organization</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {memberships.map((membership) => (
              <Card key={membership.membershipId} className="shadow-none">
                <CardContent className="space-y-2 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium">{membership.organization.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {WORKSPACE_LABELS[
                          membership.organization.type as keyof typeof WORKSPACE_LABELS
                        ] ?? membership.organization.type}
                        {" · "}
                        {roleLabel(membership.role)}
                      </p>
                    </div>
                    <StatusBadge tone={statusTone(membership.organization.status)}>
                      {membership.organization.status}
                    </StatusBadge>
                  </div>
                  <p className="text-xs text-muted-foreground">Membership: {membership.status}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
