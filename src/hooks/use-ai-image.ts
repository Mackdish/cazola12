import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { aiGenerateAdImage } from "@/lib/ai-image.functions";

export function useAiGenerateAdImage() {
  const fn = useServerFn(aiGenerateAdImage);
  return useMutation({
    mutationFn: (input: {
      organizationId: string;
      campaignId: string;
      productFocus: string;
      productHighlights: string[];
      concept: string;
      brandName?: string;
      headline?: string;
      cta?: string;
      format?: string;
    }) => fn({ data: input }),
  });
}
