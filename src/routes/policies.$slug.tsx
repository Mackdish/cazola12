import { createFileRoute } from "@tanstack/react-router";
import { PolicyDetailPage } from "@/components/policies/policy-page";
import { pageMetadata } from "@/lib/seo";

export const Route = createFileRoute("/policies/$slug")({
  head: ({ params }) => pageMetadata({
    title: `${params.slug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())} — TradeMall Policies`,
    description: "TradeMall platform policies and guidelines.",
    path: `/policies/${params.slug}`,
    image: "/trademall-logo.png",
  }),
  component: PolicyDetailPage,
});
