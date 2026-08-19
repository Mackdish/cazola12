import { createFileRoute, Outlet } from "@tanstack/react-router";

import { assertWorkspaceAccess } from "@/lib/workspace-access";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: () => assertWorkspaceAccess("admin"),
  component: () => <Outlet />,
});
