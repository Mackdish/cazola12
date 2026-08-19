import { createServerFn } from "@tanstack/react-start";

export type PlatformStats = {
  advertisers: number;
  publishers: number;
  websites: number;
  monthlyImpressions: number;
};

export const fetchPlatformStats = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const [advertisersRes, publishersRes, websitesRes, impressionsRes] = await Promise.all([
      db.from("advertisers").select("id", { count: "exact", head: true }),
      db.from("publishers").select("id", { count: "exact", head: true }),
      db.from("websites").select("id", { count: "exact", head: true }),
      db
        .from("impressions")
        .select("id", { count: "exact", head: true })
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    ]);

    return {
      advertisers: advertisersRes.count ?? 0,
      publishers: publishersRes.count ?? 0,
      websites: websitesRes.count ?? 0,
      monthlyImpressions: impressionsRes.count ?? 0,
    } satisfies PlatformStats;
  });
