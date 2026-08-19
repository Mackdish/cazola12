import type { Database } from "@/integrations/supabase/types";

export type OrganizationType = Database["public"]["Enums"]["organization_type"];
export type OrganizationRole = Database["public"]["Enums"]["organization_role"];
export type PlatformRole = Database["public"]["Enums"]["platform_role"];
export type EntityStatus = Database["public"]["Enums"]["entity_status"];

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Organization = Database["public"]["Tables"]["organizations"]["Row"];
export type OrganizationMember = Database["public"]["Tables"]["organization_members"]["Row"];

export type Membership = {
  membershipId: string;
  role: OrganizationRole;
  status: EntityStatus;
  organization: Organization;
};

export type Workspace = "admin" | "advertiser" | "publisher";

export const ORG_ROLE_RANK: Record<OrganizationRole, number> = {
  owner: 50,
  admin: 40,
  manager: 30,
  analyst: 20,
  member: 10,
};

export function activeMemberships(memberships: Membership[]): Membership[] {
  return memberships.filter((m) => m.status === "active" && m.organization.status !== "suspended");
}

export function membershipsOfType(memberships: Membership[], type: OrganizationType): Membership[] {
  return activeMemberships(memberships).filter((m) => m.organization.type === type);
}

export function hasPlatformRole(roles: PlatformRole[], ...allowed: PlatformRole[]): boolean {
  return roles.some((role) => allowed.includes(role));
}

export function isPlatformStaff(roles: PlatformRole[]): boolean {
  return roles.length > 0;
}

export function isPlatformAdmin(roles: PlatformRole[]): boolean {
  return hasPlatformRole(roles, "super_admin", "admin");
}

export function canAccessWorkspace(
  workspace: Workspace,
  memberships: Membership[],
  platformRoles: PlatformRole[],
): boolean {
  if (workspace === "admin") return isPlatformStaff(platformRoles);
  return membershipsOfType(memberships, workspace).length > 0;
}

export function availableWorkspaces(
  memberships: Membership[],
  platformRoles: PlatformRole[],
): Workspace[] {
  const workspaces: Workspace[] = [];
  if (isPlatformStaff(platformRoles)) workspaces.push("admin");
  if (membershipsOfType(memberships, "advertiser").length > 0) workspaces.push("advertiser");
  if (membershipsOfType(memberships, "publisher").length > 0) workspaces.push("publisher");
  return workspaces;
}

export function defaultWorkspacePath(
  memberships: Membership[],
  platformRoles: PlatformRole[],
): string {
  const [first] = availableWorkspaces(memberships, platformRoles);
  if (!first) return "/onboarding";
  return `/${first}`;
}

export const WORKSPACE_LABELS: Record<Workspace, string> = {
  admin: "Platform Admin",
  advertiser: "Advertiser",
  publisher: "Publisher",
};

export function roleLabel(role: OrganizationRole | PlatformRole): string {
  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
