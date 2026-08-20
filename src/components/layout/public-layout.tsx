import { Link, Outlet } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Globe,
  HelpCircle,
  LayoutDashboard,
  Megaphone,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Footer } from "@/components/layout/footer";

const NAV_LINKS = [
  { to: "/", label: "Home", icon: LayoutDashboard },
  { to: "/advertisers", label: "Advertisers", icon: Megaphone },
  { to: "/publishers", label: "Publishers", icon: Globe },
  { to: "/pricing", label: "Pricing", icon: BarChart3 },
  { to: "/help", label: "Help", icon: HelpCircle },
];

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <img
              src="/trademall-logo.png"
              alt="TradeMall logo"
              className="size-8 rounded-md object-cover"
            />
            <span className="text-sm font-semibold tracking-tight">TradeMall</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                activeProps={{ className: "text-foreground bg-muted" }}
              >
                <link.icon className="size-4" />
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Button asChild size="sm" variant="ghost">
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/auth">
                Get started
                <ArrowRight className="ml-1.5 size-4" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Mobile nav */}
        <div className="md:hidden border-t border-border px-4 py-2 flex gap-2 overflow-x-auto">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              activeProps={{ className: "text-foreground bg-muted" }}
            >
              <link.icon className="size-3.5" />
              {link.label}
            </Link>
          ))}
        </div>
      </header>

      <main>{children}</main>

      <Footer />
    </div>
  );
}
