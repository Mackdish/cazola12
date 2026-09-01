import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { useInView } from "@/hooks/use-in-view";

/**
 * Fades + lifts its children into place once scrolled into view.
 * Pass `delay` (ms) to stagger a group of Reveal siblings.
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
  const { ref, inView } = useInView();

  return (
    <As
      ref={ref as never}
      className={cn(
        "transition-all duration-700 ease-out motion-reduce:transition-none",
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
        className,
      )}
      style={{ transitionDelay: inView ? `${delay}ms` : "0ms" }}
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
