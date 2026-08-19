import { redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import type { Workspace } from "@/lib/authorization";

/**
 * Route-level workspace gate.
 *
 * Runs in `beforeLoad` of the `/admin`, `/publisher` and `/advertiser` layout
 * routes, so a hand-typed URL never renders a workspace the account cannot
 * use. This is a UX boundary — the enforced boundaries are Row Level Security
 * and the server-side assertions in the `*.server.ts` services.
 */
export async function assertWorkspaceAccess(workspace: Workspace): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (userError || !userId) throw redirect({ to: "/auth" });

  if (workspace === "admin") {
    const { data, error } = await supabase.rpc("is_platform_staff", { _user_id: userId });
    if (error) return; // Network/permission hiccup: let the in-page guard decide.
    if (!data) throw redirect({ to: await fallbackPath(userId) });
    return;
  }

  const { data, error } = await supabase
    .from("organization_members")
    .select("status, organizations!inner(type, status)")
    .eq("status", "active")
    .eq("organizations.type", workspace)
    .limit(1);
  if (error) return;
  const usable = (data ?? []).some((row) => row.organizations?.status !== "suspended");
  if (!usable) throw redirect({ to: await fallbackPath(userId) });
}

/** Where to send someone who lacks the requested workspace. */
async function fallbackPath(userId: string): Promise<string> {
  const [staff, memberships] = await Promise.all([
    supabase.rpc("is_platform_staff", { _user_id: userId }),
    supabase
      .from("organization_members")
      .select("status, organizations!inner(type, status)")
      .eq("status", "active"),
  ]);

  if (staff.data) return "/admin";

  const types = new Set(
    (memberships.data ?? [])
      .filter((row) => row.organizations?.status !== "suspended")
      .map((row) => row.organizations?.type),
  );
  if (types.has("advertiser")) return "/advertiser";
  if (types.has("publisher")) return "/publisher";
  return "/onboarding";
}
