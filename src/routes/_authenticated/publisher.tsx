import { createFileRoute, Outlet } from "@tanstack/react-router";

import { assertWorkspaceAccess } from "@/lib/workspace-access";

export const Route = createFileRoute("/_authenticated/publisher")({
  ssr: false,
  beforeLoad: () => assertWorkspaceAccess("publisher"),
  component: () => <Outlet />,
});
