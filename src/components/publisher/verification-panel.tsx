import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CodeBlock } from "@/components/publisher/copy-button";
import { StatusBadge } from "@/components/patterns/status-badge";
import { useBeginVerification, useCheckVerification } from "@/hooks/use-publisher";
import { toFriendlyError } from "@/lib/errors";
import {
  VERIFICATION_METHODS,
  verificationInstructions,
  verificationTone,
  verificationLabel,
  type DomainVerification,
  type VerificationMethod,
  type VerificationStatus,
} from "@/lib/publisher-domain";

export function VerificationPanel({
  websiteId,
  domain,
  verificationStatus,
  verifications,
  onVerified,
}: {
  websiteId: string;
  domain: string;
  verificationStatus: VerificationStatus;
  verifications: DomainVerification[];
  onVerified?: () => void;
}) {
  const [method, setMethod] = useState<VerificationMethod>(verifications[0]?.method ?? "dns_txt");
  const begin = useBeginVerification();
  const check = useCheckVerification();

  const record = verifications.find(
    (entry) => entry.method === method && entry.status !== "failed",
  );
  const instructions = record
    ? verificationInstructions(method, domain, record.verification_token)
    : null;

  async function start(regenerate: boolean) {
    try {
      await begin.mutateAsync({ websiteId, method, regenerate });
      toast.success(regenerate ? "New token generated." : "Verification started.");
    } catch (error) {
      toast.error(toFriendlyError(error, "We couldn't start verification").message);
    }
  }

  async function runCheck() {
    try {
      const result = await check.mutateAsync({ websiteId, method });
      if (result.verified) {
        toast.success(result.message);
        onVerified?.();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error(toFriendlyError(error, "We couldn't run the check").message);
    }
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="space-y-1.5">
          <CardTitle className="text-base">Domain ownership</CardTitle>
          <CardDescription>
            Pick one method. Every check runs server-side against {domain}.
          </CardDescription>
        </div>
        <StatusBadge tone={verificationTone(verificationStatus)}>
          {verificationLabel(verificationStatus)}
        </StatusBadge>
      </CardHeader>
      <CardContent>
        <Tabs value={method} onValueChange={(value) => setMethod(value as VerificationMethod)}>
          <TabsList className="w-full">
            {VERIFICATION_METHODS.map((entry) => (
              <TabsTrigger key={entry.method} value={entry.method} className="flex-1">
                {entry.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {VERIFICATION_METHODS.map((entry) => (
            <TabsContent key={entry.method} value={entry.method} className="space-y-4 pt-4">
              <p className="text-sm text-muted-foreground">{entry.summary}</p>

              {!record || method !== entry.method ? (
                <Button size="sm" onClick={() => void start(false)} disabled={begin.isPending}>
                  {begin.isPending ? "Preparing…" : "Generate token"}
                </Button>
              ) : (
                <div className="space-y-4">
                  <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
                    {instructions?.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                  {instructions ? (
                    <CodeBlock value={instructions.snippet} label={instructions.snippetLabel} />
                  ) : null}
                  {record.last_error ? (
                    <p className="rounded-md border border-destructive/25 bg-destructive/10 p-3 text-xs text-destructive">
                      Last check: {record.last_error}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" onClick={() => void runCheck()} disabled={check.isPending}>
                      {check.isPending ? "Checking…" : "Run check"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void start(true)}
                      disabled={begin.isPending}
                    >
                      Regenerate token
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {record.attempts} check{record.attempts === 1 ? "" : "s"} so far
                    </span>
                  </div>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
