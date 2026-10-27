import { Link, Outlet } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Globe,
  HelpCircle,
  Info,
  LayoutDashboard,
  Menu,
  Megaphone,
} from "lucide-react";

import { TradeMallLogo } from "@/components/branding/trademall-logo";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/layout/footer";
import { AutoAdsLoader } from "@/components/layout/auto-ads-loader";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV_LINKS = [
  { to: "/", label: "Home", icon: LayoutDashboard },
  { to: "/about", label: "About", icon: Info },
  { to: "/advertisers", label: "Advertisers", icon: Megaphone },
  { to: "/publishers", label: "Publishers", icon: Globe },
  { to: "/pricing", label: "Pricing", icon: BarChart3 },
  { to: "/blog", label: "Blog", icon: BookOpen },
  { to: "/help", label: "Help", icon: HelpCircle },
];

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg"
      >
        Skip to main content
      </a>
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <TradeMallLogo />
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
            <ThemeToggle />
            <Button asChild size="sm" variant="ghost" className="hidden md:inline-flex">
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button asChild size="sm" className="hidden md:inline-flex">
              <Link to="/auth">
                Get started
                <ArrowRight className="ml-1.5 size-4" />
              </Link>
            </Button>
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="md:hidden"
                  aria-label="Open navigation menu"
                >
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="flex w-[min(20rem,85vw)] flex-col">
                <SheetHeader>
                  <SheetTitle>Navigation</SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-1">
                  {NAV_LINKS.map((link) => (
                    <SheetClose key={link.to} asChild>
                      <Link
                        to={link.to}
                        className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        activeProps={{ className: "bg-muted text-foreground" }}
                      >
                        <link.icon className="size-4" />
                        {link.label}
                      </Link>
                    </SheetClose>
                  ))}
                </nav>
                <div className="mt-auto grid gap-2 border-t border-border pt-4">
                  <SheetClose asChild>
                    <Button asChild variant="outline">
                      <Link to="/auth">Sign in</Link>
                    </Button>
                  </SheetClose>
                  <SheetClose asChild>
                    <Button asChild>
                      <Link to="/auth">
                        Get started
                        <ArrowRight className="ml-1.5 size-4" />
                      </Link>
                    </Button>
                  </SheetClose>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="outline-none">
        {children}
      </main>

      <Footer />
      <AutoAdsLoader />
    </div>
  );
}
