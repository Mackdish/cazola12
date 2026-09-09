import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { updateAd } from "@/lib/ad-edit.functions";
import type { AdFormat } from "@/lib/advertiser-domain";

export function useUpdateAd() {
  const fn = useServerFn(updateAd);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      adId: string;
      name: string;
      format: AdFormat;
      destinationUrl: string;
      mediaAssetId: string;
      brandName?: string | null;
      logoMediaAssetId?: string | null;
      headlines: string[];
      longHeadline?: string | null;
      descriptions: string[];
      cta?: string | null;
      trackingUrl?: string | null;
      optimization?: string | null;
    }) => fn({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["advertiser"] });
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
  });
}
