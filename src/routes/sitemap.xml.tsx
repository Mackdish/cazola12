import { createFileRoute } from "@tanstack/react-router";
import { blogPosts } from "@/lib/blog";
import { siteUrl } from "@/lib/seo";

export const Route = createFileRoute("/sitemap/xml")({
  server: {
    handlers: {
      GET: async () => {
        // Published blog articles, so search engines discover them. If the database is
        // unreachable the sitemap still serves (built-in articles only).
        const published: { slug: string; updated_at: string | null }[] = await (async () => {
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { data } = await (supabaseAdmin as any)
              .from("blog_posts")
              .select("slug, updated_at")
              .eq("is_published", true);
            return data ?? [];
          } catch {
            return [];
          }
        })();
        const blogSlugs = [...new Set([...blogPosts.map((post) => post.slug), ...published.map((post) => post.slug)])];

        const publicRoutes = [
          { path: "/", priority: 1.0, changefreq: "weekly" },
          { path: "/about", priority: 0.8, changefreq: "monthly" },
          { path: "/advertisers", priority: 0.9, changefreq: "weekly" },
          { path: "/contact", priority: 0.8, changefreq: "monthly" },
          { path: "/publishers", priority: 0.9, changefreq: "weekly" },
          { path: "/pricing", priority: 0.8, changefreq: "weekly" },
          { path: "/help", priority: 0.7, changefreq: "monthly" },
          { path: "/terms", priority: 0.5, changefreq: "yearly" },
          { path: "/privacy", priority: 0.5, changefreq: "yearly" },
          { path: "/policies", priority: 0.7, changefreq: "monthly" },
          { path: "/policies/publisher-guidelines", priority: 0.7, changefreq: "monthly" },
          { path: "/policies/invalid-traffic", priority: 0.7, changefreq: "monthly" },
          { path: "/policies/ad-placement", priority: 0.7, changefreq: "monthly" },
          { path: "/blog", priority: 0.8, changefreq: "weekly" },
          ...blogSlugs.map((slug) => ({ path: `/blog/${slug}`, priority: 0.6, changefreq: "monthly" })),
        ];

        const urls = publicRoutes
          .map(
            (route) => `  <url>
    <loc>${siteUrl(route.path)}</loc>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority.toFixed(1)}</priority>
  </url>`
          )
          .join("\n");

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
