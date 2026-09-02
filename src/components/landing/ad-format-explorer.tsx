import { useState } from "react";
import { Layers, Monitor, Smartphone, Square, Tablet } from "lucide-react";

import { cn } from "@/lib/utils";

const FORMATS = [
  {
    id: "banner",
    icon: Monitor,
    title: "Banner",
    size: "728×90",
    description: "Classic horizontal display ad placed above or within content.",
    image: "/ad-mockups/banner-728x90.svg",
  },
  {
    id: "rectangle",
    icon: Square,
    title: "Rectangle",
    size: "300×250",
    description: "High-impact medium rectangle, popular within articles and sidebars.",
    image: "/ad-mockups/rectangle-300x250.svg",
  },
  {
    id: "mobile",
    icon: Smartphone,
    title: "Mobile Banner",
    size: "320×50",
    description: "Compact banner optimized for small mobile screens.",
    image: "/ad-mockups/mobile-banner-320x50.svg",
  },
  {
    id: "leaderboard",
    icon: Monitor,
    title: "Leaderboard",
    size: "970×90",
    description: "Large horizontal leaderboard for maximum visibility.",
    image: "/ad-mockups/leaderboard-970x90.svg",
  },
  {
    id: "skyscraper",
    icon: Tablet,
    title: "Skyscraper",
    size: "160×600",
    description: "Tall vertical format for side placements.",
    image: "/ad-mockups/skyscraper-160x600.svg",
  },
  {
    id: "interstitial",
    icon: Layers,
    title: "Interstitial",
    size: "Full page",
    description: "Full-screen format for high-impact campaigns.",
    image: "/ad-mockups/interstitial.svg",
  },
  {
    id: "responsive",
    icon: Layers,
    title: "Responsive",
    size: "Auto",
    description: "Automatically adapts to fit any container size on the page.",
    aspect: "aspect-[4/3]",
  },
];

/** Lets visitors switch between ad formats and see a live scaled preview. */
export function AdFormatExplorer() {
  const [activeId, setActiveId] = useState(FORMATS[0]!.id);
  const active = FORMATS.find((f) => f.id === activeId) ?? FORMATS[0]!;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-10">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
        {FORMATS.map((format) => (
          <button
            key={format.id}
            type="button"
            onClick={() => setActiveId(format.id)}
            className={cn(
              "group flex flex-col items-start gap-3 rounded-xl border p-4 text-left transition-all cursor-pointer",
              activeId === format.id
                ? "border-primary/50 bg-primary/5 shadow-md"
                : "border-border bg-card hover:border-primary/30 hover:shadow-sm",
            )}
          >
            <div
              className={cn(
                "flex size-9 items-center justify-center rounded-lg transition-colors",
                activeId === format.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-primary/10 text-primary",
              )}
            >
              <format.icon className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">{format.title}</h3>
              <p className="text-xs font-mono text-muted-foreground">{format.size}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-lg sm:p-8">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <div className="text-sm font-medium text-foreground">{active.title} preview</div>
            <div className="text-xs text-muted-foreground">{active.description}</div>
          </div>
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-mono text-muted-foreground">
            {active.size}
          </span>
        </div>
        <div className="mt-6 flex min-h-40 items-center justify-center rounded-xl bg-muted/50 p-6">
          {active.image ? (
            <img
              key={active.id}
              src={active.image}
              alt={active.title}
              className="h-full max-h-64 w-auto rounded-lg object-contain transition-all duration-300"
            />
          ) : (
            <div
              key={active.id}
              className={cn(
                "flex w-full max-w-xs items-center justify-center rounded-lg border-2 border-dashed border-primary/40 bg-gradient-to-br from-primary/15 to-accent/15 text-xs font-medium text-primary transition-all duration-300",
                active.aspect,
              )}
            >
              {active.size} · illustrative
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
