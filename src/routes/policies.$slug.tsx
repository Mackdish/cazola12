import { createFileRoute } from "@tanstack/react-router";
import { PolicyDetailPage } from "@/components/policies/policy-page";

export const Route = createFileRoute("/policies/$slug")({
  head: ({ params }) => ({
    meta: [
      {
        title: `${params.slug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())} — TradeMall Policies`,
      },
      { name: "description", content: "TradeMall platform policies and guidelines." },
    ],
  }),
  component: PolicyDetailPage,
});
