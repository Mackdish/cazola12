import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  adminGetUserDetail,
  adminListUsers,
  adminReactivateUser,
  adminSetPlatformRole,
  adminSuspendUser,
  adminUpdateUser,
  type AdminUser,
} from "@/lib/user-service.server";

const uuid = z.string().uuid();

export const fetchAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        search: z.string().optional().nullable(),
        role: z.string().optional().nullable(),
        page: z.number().int().positive().optional().nullable(),
        pageSize: z.number().int().positive().optional().nullable(),
      })
      .parse(data),
  )
  .handler(({ data, context }) => {
    const filters: Record<string, unknown> = {};
    const d = data as any;
    if (d.search) filters["search"] = d.search;
    if (d.role && d.role !== "all") filters["role"] = d.role;
    if (d.page) filters["page"] = d.page;
    if (d.pageSize) filters["pageSize"] = d.pageSize;
    return adminListUsers(context, filters as never);
  });

export const fetchAdminUserDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ userId: uuid }).parse(data))
  .handler(({ data, context }) => adminGetUserDetail(context, data.userId));

export const updateAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        userId: uuid,
        email: z.string().trim().email().optional().nullable(),
        fullName: z.string().trim().optional().nullable(),
        phone: z.string().trim().optional().nullable(),
        status: z.enum(["active", "suspended", "pending"]).optional().nullable(),
      })
      .parse(data),
  )
  .handler(({ data, context }) => {
    const input: Record<string, unknown> = { userId: data.userId };
    const d = data as any;
    if (d.email !== undefined && d.email !== null) input["email"] = d.email;
    if (d.fullName !== undefined && d.fullName !== null) input["fullName"] = d.fullName;
    if (d.phone !== undefined && d.phone !== null) input["phone"] = d.phone;
    if (d.status !== undefined && d.status !== null) input["status"] = d.status;
    return adminUpdateUser(context, input as never);
  });

export const suspendAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ userId: uuid }).parse(data))
  .handler(({ data, context }) => adminSuspendUser(context, data.userId));

export const reactivateAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ userId: uuid }).parse(data))
  .handler(({ data, context }) => adminReactivateUser(context, data.userId));

export const setAdminUserPlatformRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        userId: uuid,
        role: z.enum(["super_admin", "admin", "analyst"]),
      })
      .parse(data),
  )
  .handler(({ data, context }) =>
    adminSetPlatformRole(context, { userId: data.userId, role: data.role }),
  );
