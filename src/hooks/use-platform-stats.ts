import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { fetchPlatformStats } from "@/lib/landing.functions";

/** Real, live platform counts for the public homepage. Never fabricated. */
export function usePlatformStats() {
  const fn = useServerFn(fetchPlatformStats);
  return useQuery({
    queryKey: ["landing", "platform-stats"],
    queryFn: () => fn({}),
    staleTime: 5 * 60 * 1000,
  });
}
