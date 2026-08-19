import { Link } from "@tanstack/react-router";
import { BookOpen, Building2, HelpCircle } from "lucide-react";

import logoAsset from "@/assets/trademall-logo.png.asset.json";

export function Footer() {
  return (
    <footer className="bg-[#0B1220] text-slate-300">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <Link to="/" className="flex items-center gap-2.5">
              <img
                src={logoAsset.url}
                alt="TradeMall logo"
                className="size-8 rounded-md object-cover"
              />
              <span className="text-sm font-semibold tracking-tight text-white">TradeMall</span>
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-slate-400">
              Africa's advertising marketplace connecting advertisers with quality publishers.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">For Advertisers</h3>
            <ul className="mt-4 space-y-3">
              <li><Link to="/auth" className="text-sm text-slate-400 hover:text-white transition-colors">Advertiser Dashboard</Link></li>
              <li><Link to="/auth" className="text-sm text-slate-400 hover:text-white transition-colors">Create Campaign</Link></li>
              <li><Link to="/policies/$slug" params={{ slug: "advertiser-policies" }} className="text-sm text-slate-400 hover:text-white transition-colors">Advertiser Policies</Link></li>
              <li><Link to="/pricing" className="text-sm text-slate-400 hover:text-white transition-colors">Pricing</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">For Publishers</h3>
            <ul className="mt-4 space-y-3">
              <li><Link to="/auth" className="text-sm text-slate-400 hover:text-white transition-colors">Publisher Dashboard</Link></li>
              <li><Link to="/policies/$slug" params={{ slug: "publisher-guidelines" }} className="text-sm text-slate-400 hover:text-white transition-colors">Publisher Guidelines</Link></li>
              <li><Link to="/publishers" className="text-sm text-slate-400 hover:text-white transition-colors">Monetization</Link></li>
              <li><Link to="/policies/$slug" params={{ slug: "traffic-quality" }} className="text-sm text-slate-400 hover:text-white transition-colors">Traffic Quality</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">Resources</h3>
            <ul className="mt-4 space-y-3">
              <li><Link to="/help" className="text-sm text-slate-400 hover:text-white transition-colors">Help Center</Link></li>
              <li><Link to="/auth" className="text-sm text-slate-400 hover:text-white transition-colors">API</Link></li>
              <li><Link to="/help" className="text-sm text-slate-400 hover:text-white transition-colors">Documentation</Link></li>
              <li><Link to="/contact" className="text-sm text-slate-400 hover:text-white transition-colors">Contact Support</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">Legal</h3>
            <ul className="mt-4 space-y-3">
              <li><Link to="/privacy" className="text-sm text-slate-400 hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="text-sm text-slate-400 hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link to="/policies/$slug" params={{ slug: "data-privacy" }} className="text-sm text-slate-400 hover:text-white transition-colors">Cookie / Consent Policy</Link></li>
              <li><Link to="/policies/$slug" params={{ slug: "traffic-quality" }} className="text-sm text-slate-400 hover:text-white transition-colors">Invalid Traffic Policy</Link></li>
              <li><Link to="/policies/$slug" params={{ slug: "ad-policies" }} className="text-sm text-slate-400 hover:text-white transition-colors">Ad Placement Guidelines</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Company</h3>
            <ul className="mt-4 space-y-3">
              <li><Link to="/" className="text-sm text-slate-400 hover:text-white transition-colors">About TradeMall</Link></li>
              <li><Link to="/contact" className="text-sm text-slate-400 hover:text-white transition-colors">Contact</Link></li>
              <li><Link to="/contact" className="text-sm text-slate-400 hover:text-white transition-colors">Careers</Link></li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-800">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            © 2026 TradeMall. All rights reserved.
          </p>
          <p className="text-xs text-slate-500">
            Built for Africa's digital advertising ecosystem.
          </p>
        </div>
      </div>
    </footer>
  );
}
