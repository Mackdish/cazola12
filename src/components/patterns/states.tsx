import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-14 text-center",
        className,
      )}
    >
      <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon ?? <Inbox className="size-5" />}
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold">{title}</h3>
        {description ? (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function LoadingState({ rows = 3, label }: { rows?: number; label?: string }) {
  return (
    <div className="space-y-3" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label ?? "Loading"}</span>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="panel space-y-3 p-5">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-3 w-full max-w-md" />
        </div>
      ))}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  className,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/25 bg-destructive/5 px-6 py-12 text-center",
        className,
      )}
    >
      <div className="flex size-11 items-center justify-center rounded-full bg-destructive/12 text-destructive">
        <AlertTriangle className="size-5" />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">{message}</p>
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="size-4" />
          Try again
        </Button>
      ) : null}
    </div>
  );
}
