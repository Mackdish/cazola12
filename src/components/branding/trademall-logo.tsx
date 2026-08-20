import { Building2 } from "lucide-react";

export function TradeMallLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Building2 className="size-4" />
      </span>
      <span className="text-sm font-semibold tracking-tight">TradeMall</span>
    </span>
  );
}
