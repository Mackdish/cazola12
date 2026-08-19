import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  ChevronDown,
  CreditCard,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  User2,
  Wallet,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import logoAsset from "@/assets/trademall-logo.png.asset.json";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth-context";
import { WORKSPACE_NAV } from "@/lib/navigation";
import {
  WORKSPACE_LABELS,
  membershipsOfType,
  roleLabel,
  type Workspace,
} from "@/lib/authorization";
import { cn } from "@/lib/utils";

function initialsOf(name: string | null, email: string | null): string {
  const source = name?.trim() || email?.split("@")[0] || "AD";
  return source
    .split(/[\s._-]+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <img
        src={logoAsset.url}
        alt="TradeMall logo"
        className="size-8 rounded-md object-cover"
      />
      <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">TradeMall</span>
    </Link>
  );
}

function SidebarNav({ workspace, onNavigate }: { workspace: Workspace; onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <nav aria-label={`${WORKSPACE_LABELS[workspace]} navigation`} className="space-y-6">
      {WORKSPACE_NAV[workspace].map((section) => (
        <div key={section.title} className="space-y-1">
          <p className="px-3 pb-1 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/50">
            {section.title}
          </p>
          {section.items.map((item) => {
            const isActive = pathname === item.to || pathname.startsWith(`${item.to}/`);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/75 transition-colors",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                  isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
                )}
              >
                <item.icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function WorkspaceSwitcher() {
  const { workspaces } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (workspaces.length < 2) return null;

  return (
    <div className="flex flex-wrap gap-1.5 px-3">
      {workspaces.map((workspace) => {
        const isActive = pathname.startsWith(`/${workspace}`);
        return (
          <Link
            key={workspace}
            to={`/${workspace}`}
            className={cn(
              "rounded-md px-2 py-1 text-xs font-medium transition-colors",
              isActive
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "bg-sidebar-accent/60 text-sidebar-foreground/80 hover:text-sidebar-accent-foreground",
            )}
          >
            {WORKSPACE_LABELS[workspace]}
          </Link>
        );
      })}
    </div>
  );
}

function ProfileMenu() {
  const { profile, user, signOut, platformRoles } = useAuth();
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-md p-1 pr-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Open profile menu"
        >
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary text-xs text-primary-foreground">
              {initialsOf(profile?.full_name ?? null, user?.email ?? null)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-36 truncate text-sm font-medium sm:block">
            {profile?.full_name || user?.email}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="space-y-1">
          <p className="truncate text-sm font-semibold">{profile?.full_name || "Account"}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">{user?.email}</p>
          {platformRoles.length > 0 ? (
            <Badge variant="secondary" className="mt-1 gap-1">
              <ShieldCheck className="size-3" />
              {platformRoles.map(roleLabel).join(", ")}
            </Badge>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/account">
            <User2 className="size-4" />
            Profile & account
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await signOut();
            void navigate({ to: "/auth", replace: true });
          }}
        >
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Notifications() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
        </div>
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          You're all caught up. Network alerts will appear here.
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TopBar({
  workspace,
  orgName,
  onOpenNav,
}: {
  workspace: Workspace;
  orgName: string | null;
  onOpenNav: () => void;
}) {
  return (
    <header className="sticky top-0 z-40 grid h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-surface/85 px-3 backdrop-blur sm:px-6">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open navigation"
          className="shrink-0 lg:hidden"
          onClick={onOpenNav}
        >
          <Menu className="size-5" />
        </Button>
        <span className="hidden shrink-0 text-eyebrow sm:inline">{WORKSPACE_LABELS[workspace]}</span>
        <Separator orientation="vertical" className="hidden h-4 shrink-0 sm:block" />
        <span className="truncate text-sm font-medium text-muted-foreground">{orgName ?? "—"}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <div className="hidden md:flex items-center relative">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search..."
            className="h-9 w-64 pl-8 text-xs"
          />
        </div>
        <Notifications />
        <ProfileMenu />
      </div>
    </header>
  );
}


export function WorkspaceShell({
  workspace,
  children,
}: {
  workspace: Workspace;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { memberships } = useAuth();
  const orgName =
    workspace === "admin"
      ? "Platform Operations"
      : membershipsOfType(memberships, workspace)[0]?.organization.name;

  return (
    <div className="min-h-screen bg-background">
      <div className="lg:grid lg:grid-cols-[16rem_1fr]">
        <aside
          className={cn(
            "hidden bg-sidebar lg:flex lg:h-screen lg:flex-col lg:sticky lg:top-0 transition-all",
            collapsed && "lg:w-[4.5rem]"
          )}
        >
          <div className="flex h-14 items-center border-b border-sidebar-border px-5">
            <Brand />
          </div>
          <div className="flex-1 space-y-5 overflow-y-auto px-2 py-5">
            <WorkspaceSwitcher />
            <SidebarNav workspace={workspace} />
          </div>
          <div className="border-t border-sidebar-border px-5 py-4">
            <p className="text-[0.6875rem] uppercase tracking-[0.12em] text-sidebar-foreground/50">
              {WORKSPACE_LABELS[workspace]}
            </p>
            <p className="truncate text-sm font-medium text-sidebar-foreground">{orgName ?? "—"}</p>
          </div>
        </aside>

        {mobileOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              className="absolute inset-0 bg-foreground/40"
              onClick={() => setMobileOpen(false)}
            />
            <div className="relative flex h-full w-72 max-w-[85vw] flex-col bg-sidebar shadow-raise">
              <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-5">
                <Brand />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Close navigation"
                  onClick={() => setMobileOpen(false)}
                  className="text-sidebar-foreground hover:bg-sidebar-accent"
                >
                  <X className="size-4" />
                </Button>
              </div>
              <div className="flex-1 space-y-5 overflow-y-auto px-2 py-5">
                <WorkspaceSwitcher />
                <SidebarNav workspace={workspace} onNavigate={() => setMobileOpen(false)} />
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex min-h-screen min-w-0 flex-col">
          <TopBar
            workspace={workspace}
            orgName={orgName ?? null}
            onOpenNav={() => setMobileOpen(true)}
          />
          <main className="flex-1 px-3 py-5 sm:px-6 lg:px-8 lg:py-8">
            <div className="mx-auto w-full min-w-0 max-w-7xl space-y-6">{children}</div>
          </main>
        </div>

      </div>
    </div>
  );
}