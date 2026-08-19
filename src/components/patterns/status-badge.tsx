import { cn } from "@/lib/utils";

export type StatusTone = "active" | "pending" | "suspended" | "neutral" | "info";

const TONE_CLASSES: Record<StatusTone, string> = {
  active: "bg-success/12 text-success border-success/25",
  pending: "bg-warning/14 text-warning border-warning/30",
  suspended: "bg-destructive/12 text-destructive border-destructive/25",
  info: "bg-info/12 text-info border-info/25",
  neutral: "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: StatusTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
        TONE_CLASSES[tone],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {children}
    </span>
  );
}

export function statusTone(status: string): StatusTone {
  if (status === "active") return "active";
  if (status === "pending") return "pending";
  if (status === "suspended") return "suspended";
  return "neutral";
}
