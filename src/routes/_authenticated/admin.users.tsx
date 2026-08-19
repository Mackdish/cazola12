import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { DataTable, type DataTableColumn } from "@/components/patterns/data-table";
import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/patterns/states";
import { StatusBadge } from "@/components/patterns/status-badge";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import {
  useAdminUsers,
  useAdminReactivateUser,
  useAdminSetPlatformRole,
  useAdminSuspendUser,
  useAdminUpdateUser,
  useAdminUserDetail,
} from "@/hooks/use-admin-users";
import { User, Shield } from "lucide-react";
import type { AdminUser } from "@/lib/user-service.server";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({
    meta: [
      { title: "Users — Platform Admin — TradeMall" },
      {
        name: "description",
        content: "Every account on the network, with platform roles and organization memberships.",
      },
      { property: "og:title", content: "Users — Platform Admin — TradeMall" },
      {
        property: "og:description",
        content: "Every account on the network, with platform roles and organization memberships.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

const PAGE_SIZE = 10;

function Page() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [page, setPage] = useState(1);
  const [detailUser, setDetailUser] = useState<AdminUser | null>(null);

  const usersQuery = useAdminUsers({
    search: search || undefined,
    role: role === "all" ? undefined : role,
    page,
    pageSize: PAGE_SIZE,
  } as Parameters<typeof useAdminUsers>[0]);
  const suspend = useAdminSuspendUser();
  const reactivate = useAdminReactivateUser();
  const setRoleMutation = useAdminSetPlatformRole();
  const updateUser = useAdminUpdateUser();
  const detailQuery = useAdminUserDetail(detailUser?.id ?? "");

  const rows: AdminUser[] = usersQuery.data ?? [];
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), pageCount);

  function act(user: AdminUser, action: "suspend" | "reactivate") {
    const fn = action === "suspend" ? suspend : reactivate;
    fn.mutate(user.id, {
      onSuccess: () => toast.success(`User ${action === "suspend" ? "suspended" : "reactivated"}.`),
      onError: (error: Error) => toast.error(error.message),
    });
  }

  function handleSetRole(userId: string, newRole: string) {
    setRoleMutation.mutate(
      { userId, role: newRole as "super_admin" | "admin" | "analyst" },
      {
        onSuccess: () => toast.success("Platform role updated."),
        onError: (error: Error) => toast.error(error.message),
      },
    );
  }

  const columns: DataTableColumn<AdminUser>[] = [
    {
      id: "user",
      header: "User",
      cell: (row) => (
        <div className="min-w-0">
          <p className="font-medium truncate">{row.profile?.full_name ?? row.email ?? "—"}</p>
          <p className="text-xs text-muted-foreground truncate">{row.email ?? "No email"}</p>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => (
        <StatusBadge
          tone={
            row.profile?.status === "active"
              ? "active"
              : row.profile?.status === "suspended"
                ? "suspended"
                : "pending"
          }
        >
          {row.profile?.status ?? "unknown"}
        </StatusBadge>
      ),
    },
    {
      id: "platformRoles",
      header: "Platform role",
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.platformRoles.length === 0 ? (
            <span className="text-xs text-muted-foreground">None</span>
          ) : (
            row.platformRoles.map((r) => (
              <span
                key={r}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium"
              >
                <Shield className="size-3" /> {r}
              </span>
            ))
          )}
        </div>
      ),
    },
    {
      id: "memberships",
      header: "Organizations",
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.memberships.length} org{row.memberships.length === 1 ? "" : "s"}
        </span>
      ),
    },
    {
      id: "lastSignIn",
      header: "Last sign in",
      cell: (row) => (
        <span className="text-sm tabular-nums">
          {row.last_sign_in_at ? new Date(row.last_sign_in_at).toLocaleString() : "Never"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (row) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setDetailUser(row)}>
            <User className="size-3.5 mr-1" /> View
          </Button>
          {row.profile?.status === "active" ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={suspend.isPending}
              onClick={() => act(row, "suspend")}
            >
              Suspend
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              disabled={reactivate.isPending}
              onClick={() => act(row, "reactivate")}
            >
              Reactivate
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <WorkspaceGuard workspace="admin">
      <PageHeader
        eyebrow="Platform Admin"
        title="Users"
        description="Every account on the network, with platform roles and organization memberships."
      />

      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Input
            placeholder="Search by email or name"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-3"
          />
        </div>
        <Select
          value={role}
          onValueChange={(value) => {
            setRole(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full md:w-44">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="super_admin">Super admin</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="analyst">Analyst</SelectItem>
            <SelectItem value="">No role</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {usersQuery.isLoading ? (
        <LoadingState rows={4} label="Loading users" />
      ) : usersQuery.error ? (
        <ErrorState title="Couldn't load users" message={usersQuery.error.message} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<User className="size-5" />}
          title="No users found"
          description="Users will appear here once they sign up."
        />
      ) : (
        <div className="space-y-3">
          <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} caption="Users" />
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Page {safePage} of {pageCount}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={safePage >= pageCount}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={!!detailUser} onOpenChange={(open) => !open && setDetailUser(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>User detail</DialogTitle>
            <DialogDescription>
              Inspect profile, roles and organization memberships.
            </DialogDescription>
          </DialogHeader>
          {detailQuery.isLoading || !detailUser ? (
            <LoadingState rows={4} label="Loading user" />
          ) : (
            <div className="space-y-5">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="font-medium">{detailUser.email ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <StatusBadge
                      tone={
                        detailUser.profile?.status === "active"
                          ? "active"
                          : detailUser.profile?.status === "suspended"
                            ? "suspended"
                            : "pending"
                      }
                    >
                      {detailUser.profile?.status ?? "unknown"}
                    </StatusBadge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Full name</p>
                    <p className="font-medium">{detailUser.profile?.full_name ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="font-medium">{detailUser.profile?.phone ?? "—"}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold">Platform roles</p>
                <div className="flex flex-wrap gap-2">
                  {detailUser.platformRoles.length === 0 ? (
                    <span className="text-sm text-muted-foreground">None</span>
                  ) : (
                    detailUser.platformRoles.map((r) => (
                      <span
                        key={r}
                        className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium"
                      >
                        <Shield className="size-3" /> {r}
                      </span>
                    ))
                  )}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Select
                    value={detailUser.platformRoles[0] ?? ""}
                    onValueChange={(newRole) => handleSetRole(detailUser.id, newRole)}
                    disabled={setRoleMutation.isPending}
                  >
                    <SelectTrigger className="w-full md:w-48">
                      <SelectValue placeholder="Set role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="super_admin">Super admin</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="analyst">Analyst</SelectItem>
                      <SelectItem value="">Remove role</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold">Organization memberships</p>
                {detailUser.memberships.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No memberships.</p>
                ) : (
                  <div className="space-y-2">
                    {detailUser.memberships.map((m) => (
                      <div
                        key={m.organizationId}
                        className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="font-medium">{m.organizationName}</p>
                          <p className="text-xs text-muted-foreground">{m.organizationType}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge tone={m.status === "active" ? "active" : "pending"}>
                            {m.status}
                          </StatusBadge>
                          <span className="text-xs text-muted-foreground">{m.role}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDetailUser(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkspaceGuard>
  );
}
