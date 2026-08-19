/**
 * Server-only user management service.
 *
 * Uses the Supabase service-role client for auth operations and
 * platform-scoped database queries. Every mutation is guarded by
 * `assertPlatformAdmin` so regular staff can inspect but not alter accounts.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAuditEvent } from "@/lib/audit-log.server";
import type { Ctx } from "@/lib/advertiser-service.server";

type Client = SupabaseClient<Database>;
type PlatformRole = Database["public"]["Enums"]["platform_role"];
type OrganizationRole = Database["public"]["Enums"]["organization_role"];

export class UserServiceError extends Error {}

function fail(message: string): never {
  throw new UserServiceError(message);
}

async function adminDb(): Promise<Client> {
  return supabaseAdmin as unknown as Client;
}

// ----------------------------------------------------------------------- auth

export type AdminUser = {
  id: string;
  email: string | null;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  confirmed: boolean;
  profile: {
    full_name: string | null;
    phone: string | null;
    avatar_url: string | null;
    status: string;
  } | null;
  platformRoles: PlatformRole[];
  memberships: Array<{
    organizationId: string;
    organizationName: string;
    organizationType: string;
    role: OrganizationRole;
    status: string;
  }>;
};

export async function adminListUsers(
  ctx: Ctx,
  filters: { search?: string; role?: string; page?: number; pageSize?: number } = {},
) {
  await assertPlatformAdmin(ctx);
  const db = await adminDb();

  let authUsers: Array<{
    id: string;
    email: string | null;
    email_confirmed_at: string | null;
    last_sign_in_at: string | null;
  }> = [];
  try {
    const { data } = await supabaseAdmin.auth.admin.listUsers({
      page: filters.page ?? 1,
      perPage: filters.pageSize ?? 20,
    });
    authUsers = data.users.map((u) => ({
      id: u.id,
      email: u.email ?? null,
      email_confirmed_at: u.email_confirmed_at ?? null,
      last_sign_in_at: u.last_sign_in_at ?? null,
    }));
  } catch {
    fail("We couldn't load users from auth.");
  }

  const searchLower = (filters.search ?? "").trim().toLowerCase();
  let filtered = authUsers;
  if (searchLower) {
    filtered = filtered.filter((u) => (u.email ?? "").toLowerCase().includes(searchLower));
  }
  if (filters.role && filters.role !== "all") {
    const roleUsers = await db
      .from("platform_roles")
      .select("user_id")
      .eq("role", filters.role as PlatformRole);
    const allowed = new Set((roleUsers.data ?? []).map((r) => r.user_id));
    filtered = filtered.filter((u) => allowed.has(u.id));
  }

  const userIds = filtered.map((u) => u.id);
  const [profilesRes, platformRolesRes, membershipsRes] = await Promise.all([
    userIds.length
      ? db.from("profiles").select("*").in("id", userIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    userIds.length
      ? db.from("platform_roles").select("*").in("user_id", userIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    userIds.length
      ? db
          .from("organization_members")
          .select("*, organizations(id, name, type)")
          .in("user_id", userIds)
      : Promise.resolve({ data: [] as any[], error: null }),
  ]);

  if (profilesRes.error || platformRolesRes.error || membershipsRes.error) {
    fail("We couldn't load user metadata.");
  }

  const profiles = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));
  const platformRolesMap = new Map<string, PlatformRole[]>();
  for (const pr of platformRolesRes.data ?? []) {
    const arr = platformRolesMap.get(pr.user_id) ?? [];
    arr.push(pr.role as PlatformRole);
    platformRolesMap.set(pr.user_id, arr);
  }
  const membershipsMap = new Map<string, AdminUser["memberships"]>();
  for (const m of membershipsRes.data ?? []) {
    const org = m.organizations as { id: string; name: string; type: string } | null;
    const arr = membershipsMap.get(m.user_id) ?? [];
    arr.push({
      organizationId: m.organization_id,
      organizationName: org?.name ?? "—",
      organizationType: org?.type ?? "—",
      role: m.role as OrganizationRole,
      status: m.status,
    });
    membershipsMap.set(m.user_id, arr);
  }

  return filtered.map((u) => ({
    id: u.id,
    email: u.email,
    email_confirmed_at: u.email_confirmed_at,
    last_sign_in_at: u.last_sign_in_at,
    confirmed: !!u.email_confirmed_at,
    profile: profiles.get(u.id) ?? null,
    platformRoles: platformRolesMap.get(u.id) ?? [],
    memberships: membershipsMap.get(u.id) ?? [],
  }));
}

export async function adminGetUserDetail(ctx: Ctx, userId: string) {
  await assertPlatformAdmin(ctx);
  const db = await adminDb();

  let authUser: {
    id: string;
    email: string | null;
    email_confirmed_at: string | null;
    last_sign_in_at: string | null;
  } | null = null;
  try {
    const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
    const user = (data as any)?.user;
    if (user) {
      authUser = {
        id: user.id,
        email: user.email ?? null,
        email_confirmed_at: user.email_confirmed_at ?? null,
        last_sign_in_at: user.last_sign_in_at ?? null,
      };
    }
  } catch {
    fail("We couldn't load that user.");
  }
  if (!authUser) fail("That user doesn't exist.");

  const [profilesRes, platformRolesRes, membershipsRes] = await Promise.all([
    db.from("profiles").select("*").eq("id", userId).maybeSingle(),
    db.from("platform_roles").select("*").eq("user_id", userId),
    db
      .from("organization_members")
      .select("*, organizations(id, name, type, status)")
      .eq("user_id", userId),
  ]);

  if (profilesRes.error || platformRolesRes.error || membershipsRes.error) {
    fail("We couldn't load user metadata.");
  }

  return {
    id: authUser.id,
    email: authUser.email,
    email_confirmed_at: authUser.email_confirmed_at,
    last_sign_in_at: authUser.last_sign_in_at,
    confirmed: !!authUser.email_confirmed_at,
    profile: profilesRes.data ?? null,
    platformRoles: (platformRolesRes.data ?? []).map((r) => r.role as PlatformRole),
    memberships: (membershipsRes.data ?? []).map((m) => {
      const org = m.organizations as {
        id: string;
        name: string;
        type: string;
        status: string;
      } | null;
      return {
        organizationId: m.organization_id,
        organizationName: org?.name ?? "—",
        organizationType: org?.type ?? "—",
        role: m.role as OrganizationRole,
        status: m.status,
      };
    }),
  };
}

export async function adminUpdateUser(
  ctx: Ctx,
  input: {
    userId: string;
    email?: string | null;
    fullName?: string | null;
    phone?: string | null;
    status?: string;
  },
) {
  await assertPlatformAdmin(ctx);
  const db = await adminDb();
  const patch: Record<string, unknown> = {};

  if (input.email !== undefined && input.email !== null) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(input.userId, {
      email: input.email,
    });
    if (error) fail("We couldn't update that user's email.");
  }
  if (input.fullName !== undefined || input.phone !== undefined) {
    const profilePatch: Record<string, unknown> = {};
    if (input.fullName !== undefined) profilePatch["full_name"] = input.fullName;
    if (input.phone !== undefined) profilePatch["phone"] = input.phone;
    const { error } = await (db as any)
      .from("profiles")
      .update(profilePatch)
      .eq("id", input.userId);
    if (error) fail("We couldn't update that user's profile.");
  }
  if (input.status !== undefined) {
    const { error } = await (db as any)
      .from("profiles")
      .update({ status: input.status })
      .eq("id", input.userId);
    if (error) fail("We couldn't update that user's status.");
  }

  const { logAuditEvent } = await import("@/lib/audit-log.server");
  await logAuditEvent(ctx, {
    action: "user.update",
    targetType: "user",
    targetId: input.userId,
    metadata: patch,
  });

  return { ok: true };
}

export async function adminSuspendUser(ctx: Ctx, userId: string) {
  await assertPlatformAdmin(ctx);
  const db = await adminDb();

  await db.from("profiles").update({ status: "suspended" }).eq("id", userId);

  const { logAuditEvent } = await import("@/lib/audit-log.server");
  await logAuditEvent(ctx, {
    action: "user.suspend",
    targetType: "user",
    targetId: userId,
  });

  return { ok: true };
}

export async function adminReactivateUser(ctx: Ctx, userId: string) {
  await assertPlatformAdmin(ctx);
  const db = await adminDb();

  await db.from("profiles").update({ status: "active" }).eq("id", userId);

  const { logAuditEvent } = await import("@/lib/audit-log.server");
  await logAuditEvent(ctx, {
    action: "user.reactivate",
    targetType: "user",
    targetId: userId,
  });

  return { ok: true };
}

export async function adminSetPlatformRole(
  ctx: Ctx,
  input: { userId: string; role: PlatformRole },
) {
  await assertPlatformAdmin(ctx);
  const db = await adminDb();

  const { data: existing, error: fetchError } = await db
    .from("platform_roles")
    .select("*")
    .eq("user_id", input.userId)
    .maybeSingle();
  if (fetchError) fail("We couldn't check existing roles.");

  if (existing) {
    const { error } = await db
      .from("platform_roles")
      .update({ role: input.role })
      .eq("id", existing.id);
    if (error) fail("We couldn't update that role.");
  } else {
    const { error } = await db
      .from("platform_roles")
      .insert({ user_id: input.userId, role: input.role });
    if (error) fail("We couldn't assign that role.");
  }

  const { logAuditEvent } = await import("@/lib/audit-log.server");
  await logAuditEvent(ctx, {
    action: "user.set_platform_role",
    targetType: "user",
    targetId: input.userId,
    metadata: { role: input.role },
  });

  return { ok: true };
}

export async function assertPlatformAdmin(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("is_platform_admin", { _user_id: ctx.userId });
  if (error) fail("We couldn't verify your permissions.");
  if (!data) fail("This action requires platform admin access.");
}

export async function assertPlatformStaff(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("is_platform_staff", { _user_id: ctx.userId });
  if (error) fail("We couldn't verify your permissions.");
  if (!data) fail("This area requires platform staff access.");
}
