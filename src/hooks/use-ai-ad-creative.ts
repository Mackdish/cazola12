import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { aiGenerateAdCreative } from "@/lib/ai-ad-creative.functions";

export function useAiGenerateAdCreative() {
  const fn = useServerFn(aiGenerateAdCreative);
  return useMutation({
    mutationFn: (input: { organizationId: string; websiteUrl: string; format: string; brandName?: string; goal?: string }) => fn({ data: input }),
  });
}
