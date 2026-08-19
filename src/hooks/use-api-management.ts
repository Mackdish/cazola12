import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { useAuth } from "@/lib/auth-context";
import { membershipsOfType } from "@/lib/authorization";
import {
  createApiKey,
  fetchApiKeys,
  fetchApiRequestLogs,
  fetchApiStats,
  logApiRequestFn,
  revokeApiKey,
} from "@/lib/api-management.functions";

export function useApiOrg() {
  const { memberships, loadingIdentity } = useAuth();
  const apiMemberships = membershipsOfType(memberships, "advertiser").concat(
    membershipsOfType(memberships, "publisher"),
  );
  const primary = apiMemberships[0] ?? null;
  return {
    loading: loadingIdentity,
    organizationId: primary?.organization.id ?? null,
    organization: primary?.organization ?? null,
    role: primary?.role ?? null,
  };
}

export function useApiKeys(organizationId: string | null) {
  const fn = useServerFn(fetchApiKeys);
  return useQuery({
    queryKey: ["api", "keys", organizationId],
    enabled: Boolean(organizationId),
    queryFn: () => fn({ data: { organizationId: organizationId! } }),
  });
}

export function useApiStats(organizationId: string | null) {
  const fn = useServerFn(fetchApiStats);
  return useQuery({
    queryKey: ["api", "stats", organizationId],
    enabled: Boolean(organizationId),
    queryFn: () => fn({ data: { organizationId: organizationId! } }),
  });
}

export function useApiRequestLogs(
  organizationId: string | null,
  filters?: {
    endpoint?: string;
    status?: string;
    from?: string;
    to?: string;
    limit?: number;
  },
) {
  const fn = useServerFn(fetchApiRequestLogs);
  return useQuery({
    queryKey: ["api", "logs", organizationId, filters],
    enabled: Boolean(organizationId),
    queryFn: () => fn({ data: { organizationId: organizationId!, ...filters } }),
  });
}

export function useCreateApiKey() {
  const fn = useServerFn(createApiKey);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      organizationId: string;
      name?: string;
      permissions?: Record<string, string[]>;
      expiresAt?: string | null;
    }) => fn({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["api"] });
    },
  });
}

export function useRevokeApiKey() {
  const fn = useServerFn(revokeApiKey);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { organizationId: string; keyId: string }) => fn({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["api"] });
    },
  });
}

export function useLogApiRequest() {
  const fn = useServerFn(logApiRequestFn);
  return useMutation({
    mutationFn: (input: {
      organizationId: string;
      endpoint: string;
      method: string;
      statusCode: number;
      status: string;
      responseTimeMs?: number | null;
      ipAddress?: string | null;
      userAgent?: string | null;
      requestBody?: unknown | null;
      responseBody?: unknown | null;
      errorMessage?: string | null;
    }) => fn({ data: input as never }),
  });
}
