import { useState } from "react";
import { Layers, Monitor, Smartphone } from "lucide-react";

import { cn } from "@/lib/utils";

const FORMATS = [
  {
    id: "banner",
    icon: Monitor,
    title: "Banner",
    size: "728×90",
    description: "Classic horizontal display ad placed above or within content.",
    aspect: "aspect-[728/90]",
  },
  {
    id: "rectangle",
    icon: Layers,
    title: "Rectangle",
    size: "300×250",
    description: "High-impact medium rectangle, popular within articles and sidebars.",
    aspect: "aspect-[300/250]",
  },
  {
    id: "mobile",
    icon: Smartphone,
    title: "Mobile Banner",
    size: "320×50",
    description: "Compact banner optimized for small mobile screens.",
    aspect: "aspect-[320/50]",
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
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
          <div
            key={active.id}
            className={cn(
              "w-full max-w-xs rounded-lg border-2 border-dashed border-primary/40 bg-gradient-to-br from-primary/15 to-accent/15 flex items-center justify-center text-xs font-medium text-primary transition-all duration-300",
              active.aspect,
            )}
          >
            {active.size} · illustrative
          </div>
        </div>
      </div>
    </div>
  );
}
