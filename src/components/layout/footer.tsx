import { Link } from "@tanstack/react-router";
import { Building2, HelpCircle, Mail, Phone } from "lucide-react";

import { TradeMallLogo } from "@/components/branding/trademall-logo";

export function Footer() {
  return (
    <footer className="bg-[#0B1220] text-slate-300">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <Link to="/" className="flex items-center gap-2.5 text-white">
              <TradeMallLogo />
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
              <li><Link to="/policies/publisher-guidelines" className="text-sm text-slate-400 hover:text-white transition-colors">Publisher Guidelines</Link></li>
              <li><Link to="/publishers" className="text-sm text-slate-400 hover:text-white transition-colors">Monetization</Link></li>
              <li><Link to="/policies/invalid-traffic" className="text-sm text-slate-400 hover:text-white transition-colors">Traffic Quality</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">Resources</h3>
            <ul className="mt-4 space-y-3">
              <li><Link to="/help" className="text-sm text-slate-400 hover:text-white transition-colors">Help Center</Link></li>
              <li><Link to="/blog" className="text-sm text-slate-400 hover:text-white transition-colors">Blog & How-To Guides</Link></li>
              <li><Link to="/contact" className="text-sm text-slate-400 hover:text-white transition-colors">Contact Us</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">Contact</h3>
            <ul className="mt-4 space-y-3">
              <li>
                <a
                  href="mailto:support@trademall.co.ke"
                  className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
                >
                  <Mail className="size-4" />
                  support@trademall.co.ke
                </a>
              </li>
              <li>
                <a
                  href="tel:+254705186502"
                  className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
                >
                  <Phone className="size-4" />
                  +254 705 186 502
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <h3 className="text-sm font-semibold text-white">Company</h3>
            <ul className="mt-4 space-y-3">
              <li><Link to="/about" className="text-sm text-slate-400 hover:text-white transition-colors">About TradeMall</Link></li>
              <li><Link to="/contact" className="text-sm text-slate-400 hover:text-white transition-colors">Contact Us</Link></li>
              <li><Link to="/policies" className="text-sm text-slate-400 hover:text-white transition-colors">All Policies</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Legal</h3>
            <ul className="mt-4 space-y-3">
              <li><Link to="/privacy" className="text-sm text-slate-400 hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="text-sm text-slate-400 hover:text-white transition-colors">Terms of Service</Link></li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-800">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} TradeMall. All rights reserved.
          </p>
          <p className="text-xs text-slate-500">
            Built for Africa's digital advertising ecosystem.
          </p>
        </div>
      </div>
    </footer>
  );
}
