import {
  BarChart3,
  Banknote,
  Building2,
  Coins,
  CreditCard,
  Files,
  FileText,
  FlaskConical,
  Globe,
  Image,
  LayoutDashboard,
  Megaphone,
  Receipt,
  Rocket,
  Settings,
  ShieldAlert,
  Sparkles,
  Users,
  Wallet,
  TrendingUp,
  Target,
  LineChart,
  Gavel,
  Eye,
  Key,
  type LucideIcon,
} from "lucide-react";

import type { Workspace } from "@/lib/authorization";

export type NavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

export const WORKSPACE_NAV: Record<Workspace, NavSection[]> = {
  admin: [
    {
      title: "Network",
      items: [
        { label: "Dashboard", to: "/admin", icon: LayoutDashboard },
        { label: "Users", to: "/admin/users", icon: Users },
        { label: "Advertisers", to: "/admin/advertisers", icon: Megaphone },
        { label: "Publishers", to: "/admin/publishers", icon: Globe },
      ],
    },
    {
      title: "Inventory",
      items: [
        { label: "Campaigns", to: "/admin/campaigns", icon: Sparkles },
        { label: "Websites", to: "/admin/websites", icon: Building2 },
        { label: "Ad Zones", to: "/admin/ad-zones", icon: Image },
        { label: "Ads", to: "/admin/ads", icon: Target },
        { label: "Creatives", to: "/admin/creatives", icon: Files },
      ],
    },
    {
      title: "Safety",
      items: [
        { label: "Policy Center", to: "/admin/policies", icon: Gavel },
        { label: "Platform Policies", to: "/admin/policies/content", icon: FileText },
        { label: "Policy Violations", to: "/admin/violations", icon: ShieldAlert },
        { label: "Website Health", to: "/admin/health", icon: TrendingUp },
        { label: "Ads.txt", to: "/admin/ads-txt", icon: Files },
        { label: "Ad Reports", to: "/admin/ad-reports", icon: BarChart3 },
        { label: "Ad Safety", to: "/admin/ad-safety", icon: ShieldAlert },
      ],
    },
    {
      title: "Finance",
      items: [
        { label: "Transactions", to: "/admin/transactions", icon: Receipt },
        { label: "Payouts", to: "/admin/payouts", icon: Banknote },
        { label: "Analytics", to: "/admin/analytics", icon: LineChart },
      ],
    },
    {
      title: "Platform",
      items: [
        { label: "Settings", to: "/admin/settings", icon: Settings },
        { label: "Fraud Center", to: "/admin/fraud", icon: ShieldAlert },
        { label: "API Docs", to: "/admin/api-docs", icon: Files },
      ],
    },
  ],
  advertiser: [
    {
      title: "Demand",
      items: [
        { label: "Dashboard", to: "/advertiser", icon: LayoutDashboard },
        { label: "Campaigns", to: "/advertiser/campaigns", icon: Sparkles },
        { label: "Advertisements", to: "/advertiser/advertisements", icon: Target },
        { label: "Creatives", to: "/advertiser/creatives", icon: Files },
      ],
    },
    {
      title: "Finance",
      items: [
        { label: "Wallet", to: "/advertiser/wallet", icon: Wallet },
        { label: "Transactions", to: "/advertiser/transactions", icon: CreditCard },
        { label: "Analytics", to: "/advertiser/analytics", icon: LineChart },
      ],
    },
    {
      title: "Developer",
      items: [{ label: "API", to: "/advertiser/api", icon: Key }],
    },
    {
      title: "Account",
      items: [{ label: "Settings", to: "/advertiser/settings", icon: Settings }],
    },
  ],
  publisher: [
    {
      title: "Supply",
      items: [
        { label: "Dashboard", to: "/publisher", icon: LayoutDashboard },
        { label: "Get started", to: "/publisher/get-started", icon: Rocket },
        { label: "Websites", to: "/publisher/websites", icon: Globe },
        { label: "Ad Zones", to: "/publisher/ad-zones", icon: Image },
        { label: "Policy Center", to: "/publisher/policies", icon: Gavel },
        { label: "Ad Preview", to: "/publisher/ad-preview", icon: Eye },
        { label: "Delivery sandbox", to: "/publisher/sandbox", icon: FlaskConical },
      ],
    },
    {
      title: "Revenue",
      items: [
        { label: "Earnings", to: "/publisher/earnings", icon: Coins },
        { label: "Payouts", to: "/publisher/payouts", icon: Banknote },
        { label: "Analytics", to: "/publisher/analytics", icon: LineChart },
      ],
    },
    {
      title: "Developer",
      items: [{ label: "API", to: "/publisher/api", icon: Key }],
    },
    {
      title: "Account",
      items: [{ label: "Settings", to: "/publisher/settings", icon: Settings }],
    },
  ],
};
