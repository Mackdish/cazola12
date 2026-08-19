import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function CopyButton({
  value,
  label = "Copy",
  size = "sm",
  variant = "outline",
}: {
  value: string;
  label?: string;
  size?: "sm" | "default";
  variant?: "outline" | "secondary" | "default" | "ghost";
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <Button type="button" size={size} variant={variant} onClick={() => void copy()}>
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

export function CodeBlock({ value, label }: { value: string; label?: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        {label ? <p className="text-eyebrow">{label}</p> : <span />}
        <CopyButton value={value} />
      </div>
      <pre className="overflow-x-auto rounded-md border border-border bg-muted/50 p-3 text-xs leading-relaxed">
        <code>{value}</code>
      </pre>
    </div>
  );
}
