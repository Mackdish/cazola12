import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { deleteAdminCreative, fetchAdminCreatives } from "@/lib/advertiser.functions";
import type { MediaAsset } from "@/lib/advertiser-domain";

export function useAdminCreatives(
  filters: {
    organizationId?: string;
    status?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  } = {},
) {
  const fn = useServerFn(fetchAdminCreatives);
  return useQuery({
    queryKey: ["admin", "creatives", filters],
    queryFn: async () =>
      (await fn({ data: filters })) as unknown as {
        creatives: MediaAsset[];
        total: number;
        page: number;
        pageSize: number;
        pageCount: number;
      },
  });
}

export function useAdminDeleteCreative() {
  const fn = useServerFn(deleteAdminCreative);
  const invalidate = useAdminCreativesInvalidate();
  return useMutation({
    mutationFn: (assetId: string) => fn({ data: { assetId } }),
    onSuccess: invalidate,
  });
}

export function useAdminCreativesInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "creatives"] });
  };
}
