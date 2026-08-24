import { createFileRoute } from "@tanstack/react-router";
import { siteUrl } from "@/lib/seo";

export const Route = createFileRoute("/sitemap/xml")({
  server: {
    handlers: {
      GET: () => {
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
