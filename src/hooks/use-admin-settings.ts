import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { fetchPlatformSettings, updatePlatformSettingsFn } from "@/lib/settings.functions";
import type { PlatformSettings } from "@/lib/settings-service.server";

export function usePlatformSettings() {
  const fn = useServerFn(fetchPlatformSettings);
  return useQuery({
    queryKey: ["admin", "settings"],
    queryFn: async () => (await fn({ data: {} })) as PlatformSettings,
  });
}

export function useUpdatePlatformSettings() {
  const fn = useServerFn(updatePlatformSettingsFn as any);
  const invalidate = usePlatformSettingsInvalidate();
  return useMutation({
    mutationFn: (input: Partial<PlatformSettings>) => fn({ data: input }),
    onSuccess: invalidate,
  });
}

export function usePlatformSettingsInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
  };
}
