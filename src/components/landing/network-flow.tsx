import { Megaphone, Globe2, Users, Building2 } from "lucide-react";

const NODES = [
  {
    icon: Megaphone,
    title: "Advertisers",
    description: "Launch campaigns, set budgets, upload creatives.",
  },
  {
    icon: Building2,
    title: "TradeMall",
    description: "Matches campaigns to inventory, tracks every event.",
    isCore: true,
  },
  {
    icon: Globe2,
    title: "Publishers",
    description: "Serve ads across verified websites and apps.",
  },
  {
    icon: Users,
    title: "Audiences",
    description: "See relevant ads across the publisher network.",
  },
];

/**
 * Visualizes how value flows through the marketplace:
 * Advertiser -> TradeMall -> Publisher -> Audience.
 * Pure CSS/SVG-free animation; respects prefers-reduced-motion via CSS.
 */
export function NetworkFlow() {
  return (
    <div className="relative">
      <div className="grid grid-cols-4 gap-2 sm:gap-4">
        {NODES.map((node, index) => (
          <div key={node.title} className="relative flex flex-col items-center text-center">
            {index < NODES.length && (
              <div className="absolute left-1/2 top-6 hidden h-px w-full sm:block" aria-hidden>
                {index < NODES.length - 1 && (
                  <div className="mkt-connector w-full">
                    <span
                      className="mkt-connector-dot"
                      style={{ animationDelay: `${index * 0.6}s` }}
                    />
                  </div>
                )}
              </div>
            )}

            <div
              className={`relative z-10 flex size-12 items-center justify-center rounded-2xl border sm:size-14 ${
                node.isCore
                  ? "border-mkt-emerald/40 bg-mkt-emerald/15 text-mkt-emerald shadow-[0_0_24px_-4px_var(--color-mkt-emerald)]"
                  : "border-white/15 bg-white/5 text-white"
              } animate-mkt-float`}
              style={{ animationDelay: `${index * 0.4}s` }}
            >
              <node.icon className="size-5 sm:size-6" />
            </div>
            <h3 className="mt-3 text-xs font-semibold text-white sm:text-sm">{node.title}</h3>
            <p className="mt-1 hidden text-xs leading-relaxed text-slate-400 sm:block">
              {node.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
