import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/patterns/states";
import { WorkspaceShell } from "@/components/shell/workspace-shell";
import { useAuth } from "@/lib/auth-context";
import { canAccessWorkspace, WORKSPACE_LABELS, type Workspace } from "@/lib/authorization";

/**
 * UI-level workspace gate. The real boundary is Row Level Security in the
 * database — this only prevents showing navigation the user cannot use.
 */
export function WorkspaceGuard({
  workspace,
  children,
}: {
  workspace: Workspace;
  children: ReactNode;
}) {
  const { loadingIdentity, memberships, platformRoles, identityError, refreshIdentity, homePath } =
    useAuth();

  if (identityError) {
    return (
      <div className="mx-auto flex min-h-screen max-w-xl items-center px-4">
        <ErrorState
          title={identityError.title}
          message={identityError.message}
          onRetry={() => void refreshIdentity()}
          className="w-full"
        />
      </div>
    );
  }

  if (loadingIdentity && memberships.length === 0 && platformRoles.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16">
        <LoadingState rows={3} label="Loading your workspace" />
      </div>
    );
  }

  if (!canAccessWorkspace(workspace, memberships, platformRoles)) {
    return (
      <div className="mx-auto flex min-h-screen max-w-xl items-center px-4">
        <EmptyState
          className="w-full"
          icon={<Lock className="size-5" />}
          title={`No access to the ${WORKSPACE_LABELS[workspace]} workspace`}
          description="Your account isn't a member of an organization with this level of access. Ask an owner to invite you, or switch to a workspace you belong to."
          action={
            <Button asChild variant="outline" size="sm">
              <Link to={homePath}>Go to my workspace</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return <WorkspaceShell workspace={workspace}>{children}</WorkspaceShell>;
}
