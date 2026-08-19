import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  blockIpAddress,
  exportAuditLogs,
  fetchAuditLogDetail,
  fetchAuditLogs,
  fetchBlockedIps,
  fetchFraudEvents,
  unblockIpAddress,
  reviewFraudEvent,
} from "@/lib/fraud-center.functions";
import type { AuditLog, BlockedIp, FraudEvent } from "@/lib/fraud-center.server";

export type FraudEventFilters = {
  status?: string;
  severity?: string;
  eventType?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};

export function useFraudEvents(filters: FraudEventFilters = {}) {
  const fn = useServerFn(fetchFraudEvents);
  return useQuery({
    queryKey: ["fraud", "events", filters],
    queryFn: async () => {
      const result = await fn({ data: filters });
      return result as {
        events: FraudEvent[];
        total: number;
        page: number;
        pageSize: number;
        pageCount: number;
      };
    },
  });
}

export function useBlockedIps() {
  const fn = useServerFn(fetchBlockedIps);
  return useQuery({
    queryKey: ["fraud", "blocked-ips"],
    queryFn: async () => {
      const result = await fn({ data: undefined });
      return result as BlockedIp[];
    },
  });
}

export function useAuditLogs(
  filters: { action?: string; from?: string; to?: string; page?: number; pageSize?: number } = {},
) {
  const fn = useServerFn(fetchAuditLogs);
  return useQuery({
    queryKey: ["fraud", "audit-logs", filters],
    queryFn: async () => {
      const result = await fn({ data: filters });
      return result as {
        logs: AuditLog[];
        total: number;
        page: number;
        pageSize: number;
        pageCount: number;
      };
    },
  });
}

export function useBlockIp() {
  const fn = useServerFn(blockIpAddress);
  const invalidate = useFraudInvalidate();
  return useMutation({
    mutationFn: (input: { ipAddress: string; reason: string; durationHours?: number }) =>
      fn({ data: input }),
    onSuccess: invalidate,
  });
}

export function useUnblockIp() {
  const fn = useServerFn(unblockIpAddress);
  const invalidate = useFraudInvalidate();
  return useMutation({
    mutationFn: (ipAddress: string) => fn({ data: { ipAddress } }),
    onSuccess: invalidate,
  });
}

export function useUpdateFraudEventStatus() {
  const fn = useServerFn(reviewFraudEvent);
  const invalidate = useFraudInvalidate();
  return useMutation({
    mutationFn: (input: { eventId: string; status: string; reviewNotes?: string }) =>
      fn({ data: input }),
    onSuccess: invalidate,
  });
}

export function useFraudInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["fraud"] });
  };
}

export function useAuditLogDetail() {
  const fn = useServerFn(fetchAuditLogDetail);
  return useQuery({
    queryKey: ["fraud", "audit-log-detail"],
    queryFn: async ({ queryKey }) => {
      const [, logId] = queryKey as [string, string];
      return fn({ data: { logId } }) as Promise<any>;
    },
    enabled: false,
  });
}

export function useExportAuditLogs() {
  const fn = useServerFn(exportAuditLogs);
  const invalidate = useFraudInvalidate();
  return useMutation({
    mutationFn: (filters: { action?: string; from?: string; to?: string }) => fn({ data: filters }),
    onSuccess: invalidate,
  });
}
