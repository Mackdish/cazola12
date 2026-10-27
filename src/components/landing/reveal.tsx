import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Fades + lifts its children into place as they scroll into view.
 * Pass `delay` (ms) to stagger a group of Reveal siblings.
 *
 * Content is VISIBLE BY DEFAULT. It is only hidden after the page has hydrated,
 * and only for blocks that are still below the fold. Hiding everything up front
 * (the old behaviour) left whole sections blank on slow connections until the
 * JavaScript bundle arrived, and permanently blank with JS off or for crawlers.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  as: As = "div",
}: {
  children: ReactNode;
  className?: string | undefined;
  delay?: number | undefined;
  as?: "div" | "li";
}) {
  const ref = useRef<HTMLElement>(null);
  // "armed" = this block is below the fold and waiting to animate in.
  const [armed, setArmed] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    // Already on screen: leave it as-is, no hide-then-show flash.
    if (node.getBoundingClientRect().top < window.innerHeight * 0.9) return;

    setArmed(true);
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const hidden = armed && !revealed;

  return (
    <As
      ref={ref as never}
      className={cn(
        "transition-all duration-700 ease-out motion-reduce:transition-none",
        hidden ? "opacity-0 translate-y-6" : "opacity-100 translate-y-0",
        className,
      )}
      style={{ transitionDelay: revealed ? `${delay}ms` : "0ms" }}
    >
      {children}
    </As>
  );
}

/** Wraps a list of items, staggering each child's Reveal delay automatically. */
export function RevealGroup({
  children,
  className,
  step = 80,
  itemClassName,
}: {
  children: ReactNode[];
  className?: string;
  step?: number;
  itemClassName?: string;
}) {
  return (
    <div className={className}>
      {children.map((child, index) => (
        <Reveal key={index} delay={index * step} className={itemClassName}>
          {child}
        </Reveal>
      ))}
    </div>
  );
}
