import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  fetchAdminUserDetail,
  reactivateAdminUser,
  setAdminUserPlatformRole,
  suspendAdminUser,
  updateAdminUser,
  fetchAdminUsers,
} from "@/lib/user.functions";
import type { AdminUser } from "@/lib/user-service.server";

export function useAdminUsers(
  filters: { search?: string; role?: string; page?: number; pageSize?: number } = {},
) {
  const fn = useServerFn(fetchAdminUsers);
  return useQuery({
    queryKey: ["admin", "users", filters],
    queryFn: async () => (await fn({ data: filters })) as unknown as AdminUser[],
  });
}

export function useAdminUserDetail(userId: string) {
  const fn = useServerFn(fetchAdminUserDetail);
  return useQuery({
    queryKey: ["admin", "users", userId],
    queryFn: async () => (await fn({ data: { userId } })) as unknown as AdminUser,
    enabled: Boolean(userId),
  });
}

export function useAdminSuspendUser() {
  const fn = useServerFn(suspendAdminUser);
  const invalidate = useAdminUsersInvalidate();
  return useMutation({
    mutationFn: (userId: string) => fn({ data: { userId } }),
    onSuccess: invalidate,
  });
}

export function useAdminReactivateUser() {
  const fn = useServerFn(reactivateAdminUser);
  const invalidate = useAdminUsersInvalidate();
  return useMutation({
    mutationFn: (userId: string) => fn({ data: { userId } }),
    onSuccess: invalidate,
  });
}

export function useAdminUpdateUser() {
  const fn = useServerFn(updateAdminUser);
  const invalidate = useAdminUsersInvalidate();
  return useMutation({
    mutationFn: (input: {
      userId: string;
      email?: string | null;
      fullName?: string | null;
      phone?: string | null;
      status?: string;
    }) => fn({ data: input }),
    onSuccess: invalidate,
  });
}

export function useAdminSetPlatformRole() {
  const fn = useServerFn(setAdminUserPlatformRole);
  const invalidate = useAdminUsersInvalidate();
  return useMutation({
    mutationFn: (input: { userId: string; role: "super_admin" | "admin" | "analyst" }) =>
      fn({ data: input }),
    onSuccess: invalidate,
  });
}

export function useAdminUsersInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
  };
}
