import { useState } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdServerOrigin } from "@/hooks/use-publisher";

export function PublisherSdkInstallCard() {
  const { data, isLoading, error } = useAdServerOrigin();
  const [copied, setCopied] = useState(false);
  const code = data ? `<script async src="${data.origin}/ad/loader.js"></script>` : "";

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Installation code copied.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy the installation code.");
    }
  }

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Connect your website once</CardTitle>
        <CardDescription>
          Add this small script once. After that, TradeMall can apply your selected placements automatically. You won't need to paste a separate ad snippet for every placement.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Preparing installation code…</div>
        ) : error ? (
          <p className="text-sm text-destructive">Couldn't prepare the installation code.</p>
        ) : (
          <>
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3">
              <code className="min-w-0 flex-1 overflow-x-auto text-xs">{code}</code>
              <Button size="sm" variant="outline" onClick={() => void copy()}>
                {copied ? <Check className="mr-1 size-3" /> : <Copy className="mr-1 size-3" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              WordPress and other managed integrations can provide a no-code connector later. For custom websites, this is the only code installation required.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
