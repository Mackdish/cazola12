import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { archiveAdminAd, fetchAdminAdDetail, fetchAdminAds } from "@/lib/advertiser.functions";
import type { Ad } from "@/lib/advertiser-domain";

export function useAdminAds(
  filters: {
    campaignId?: string;
    status?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  } = {},
) {
  const fn = useServerFn(fetchAdminAds);
  return useQuery({
    queryKey: ["admin", "ads", filters],
    queryFn: async () =>
      (await fn({ data: filters })) as unknown as {
        ads: Ad[];
        total: number;
        page: number;
        pageSize: number;
        pageCount: number;
      },
  });
}

export function useAdminAdDetail(adId: string) {
  const fn = useServerFn(fetchAdminAdDetail);
  return useQuery({
    queryKey: ["admin", "ads", adId],
    queryFn: async () => (await fn({ data: { adId } })) as unknown as { ad: Ad; performance: any[] },
    enabled: Boolean(adId),
  });
}

export function useAdminArchiveAd() {
  const fn = useServerFn(archiveAdminAd);
  const invalidate = useAdminAdsInvalidate();
  return useMutation({
    mutationFn: (adId: string) => fn({ data: { adId } }),
    onSuccess: invalidate,
  });
}

export function useAdminAdsInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "ads"] });
  };
}
