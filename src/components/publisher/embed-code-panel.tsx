import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CodeBlock } from "@/components/publisher/copy-button";
import {
  buildEmbedCode,
  embedInstallSteps,
  formatDimensions,
  type AdZone,
} from "@/lib/publisher-domain";

export function EmbedCodePanel({
  zone,
  domain,
  origin,
  ready,
}: {
  zone: AdZone;
  domain: string;
  origin: string;
  ready: boolean;
}) {
  const snippet = buildEmbedCode({
    origin,
    zoneKey: zone.zone_key,
    format: zone.format,
    width: zone.width,
    height: zone.height,
    responsive: zone.responsive,
  });

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Embed code — {zone.name}</CardTitle>
        <CardDescription>
          {formatDimensions(zone)} · zone key <span className="text-numeric">{zone.zone_key}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <CodeBlock value={snippet} label="Snippet" />
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
          {embedInstallSteps(domain).map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        {!ready ? (
          <p className="rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
            You can install this snippet now, but ads only start serving once this website is
            verified and approved by the platform.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
