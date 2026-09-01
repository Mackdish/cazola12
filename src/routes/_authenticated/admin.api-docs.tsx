import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Copy, ExternalLink, Key, Lock, Shield, BookOpen, Code2, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/patterns/page-header";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";

const BASE_URL = "https://trademall.co.ke/api/v1";

const ENDPOINTS = [
  {
    method: "GET",
    path: "/ads/serve",
    title: "Serve Ad",
    description: "Returns an eligible ad for a given zone and website.",
    params: [
      { name: "zone_id", type: "string", required: true, desc: "Ad zone key" },
      { name: "website_id", type: "string", required: true, desc: "Website ID" },
      { name: "device", type: "string", required: false, desc: "desktop | mobile | tablet" },
      { name: "page_url", type: "string", required: false, desc: "Full page URL" },
    ],
    response: `{
  "ok": true,
  "request_id": "uuid",
  "ad": {
    "ad_id": "uuid",
    "campaign_id": "uuid",
    "creative_url": "https://...",
    "format": "300x250",
    "width": 300,
    "height": 250,
    "click_url": "https://...",
    "impression_tracking_url": "https://..."
  }
}`,
  },
  {
    method: "POST",
    path: "/events/impression",
    title: "Record Impression",
    description: "Records an ad impression with server-side validation.",
    params: [
      { name: "request_id", type: "string", required: true, desc: "UUID from ad serve response" },
      { name: "ad_id", type: "string", required: true, desc: "Ad ID" },
      { name: "zone_id", type: "string", required: true, desc: "Ad zone key" },
      { name: "device", type: "string", required: false, desc: "desktop | mobile | tablet" },
      { name: "country", type: "string", required: false, desc: "ISO 3166 alpha-2" },
    ],
    response: `{
  "ok": true,
  "outcome": "recorded"
}`,
  },
  {
    method: "POST",
    path: "/events/click",
    title: "Record Click",
    description: "Records an ad click and returns the destination URL.",
    params: [
      { name: "request_id", type: "string", required: true, desc: "UUID from ad serve response" },
      { name: "ad_id", type: "string", required: true, desc: "Ad ID" },
      { name: "zone_id", type: "string", required: true, desc: "Ad zone key" },
    ],
    response: `{
  "ok": true,
  "destination": "https://advertiser.com/landing"
}`,
  },
  {
    method: "GET",
    path: "/campaigns",
    title: "List Campaigns",
    description: "Lists campaigns for the authenticated advertiser.",
    auth: true,
    params: [
      { name: "organization_id", type: "string", required: false, desc: "Filter by organization" },
    ],
    response: `{
  "ok": true,
  "data": [...]
}`,
  },
  {
    method: "POST",
    path: "/campaigns",
    title: "Create Campaign",
    description: "Creates a new campaign.",
    auth: true,
    params: [
      { name: "name", type: "string", required: true, desc: "Campaign name" },
      { name: "objective", type: "string", required: true, desc: "Campaign objective" },
      { name: "bid_type", type: "string", required: true, desc: "cpm | cpc" },
      { name: "bid_amount", type: "number", required: true, desc: "Bid amount" },
      { name: "total_budget", type: "number", required: true, desc: "Total budget" },
      { name: "daily_budget", type: "number", required: false, desc: "Daily budget" },
      { name: "start_date", type: "string", required: false, desc: "YYYY-MM-DD" },
      { name: "end_date", type: "string", required: false, desc: "YYYY-MM-DD" },
      { name: "landing_page_url", type: "string", required: true, desc: "Landing page URL" },
    ],
    response: `{
  "ok": true,
  "data": { "id": "uuid", ... }
}`,
  },
  {
    method: "GET",
    path: "/campaigns/:id",
    title: "Get Campaign",
    description: "Retrieves a specific campaign by ID.",
    auth: true,
    params: [],
    response: `{
  "ok": true,
  "data": { "id": "uuid", ... }
}`,
  },
  {
    method: "PATCH",
    path: "/campaigns/:id",
    title: "Update Campaign",
    description: "Updates a campaign.",
    auth: true,
    params: [
      { name: "name", type: "string", required: false, desc: "Campaign name" },
      { name: "bid_amount", type: "number", required: false, desc: "Bid amount" },
      { name: "total_budget", type: "number", required: false, desc: "Total budget" },
    ],
    response: `{
  "ok": true,
  "data": { "id": "uuid", ... }
}`,
  },
  {
    method: "POST",
    path: "/campaigns/:id/submit",
    title: "Submit Campaign",
    description: "Submits a campaign for review.",
    auth: true,
    params: [
      { name: "status", type: "string", required: true, desc: "pending_review" },
    ],
    response: `{
  "ok": true,
  "data": { "id": "uuid", ... }
}`,
  },
  {
    method: "GET",
    path: "/websites",
    title: "List Websites",
    description: "Lists websites for the authenticated publisher.",
    auth: true,
    params: [
      { name: "organization_id", type: "string", required: false, desc: "Filter by organization" },
    ],
    response: `{
  "ok": true,
  "data": [...]
}`,
  },
  {
    method: "POST",
    path: "/websites",
    title: "Create Website",
    description: "Creates a new website.",
    auth: true,
    params: [
      { name: "domain", type: "string", required: true, desc: "Website domain" },
      { name: "name", type: "string", required: true, desc: "Website name" },
      { name: "category", type: "string", required: true, desc: "Website category" },
      { name: "monthly_pageviews", type: "number", required: false, desc: "Estimated pageviews" },
    ],
    response: `{
  "ok": true,
  "data": { "id": "uuid", ... }
}`,
  },
  {
    method: "GET",
    path: "/websites/:id",
    title: "Get Website",
    description: "Retrieves a specific website by ID.",
    auth: true,
    params: [],
    response: `{
  "ok": true,
  "data": { "id": "uuid", ... }
}`,
  },
  {
    method: "POST",
    path: "/websites/:id/verify",
    title: "Verify Website",
    description: "Initiates domain verification for a website.",
    auth: true,
    params: [
      { name: "method", type: "string", required: true, desc: "dns_txt | meta_tag | html_file" },
    ],
    response: `{
  "ok": true,
  "data": { "verification_token": "...", ... }
}`,
  },
  {
    method: "GET",
    path: "/ad-zones",
    title: "List Ad Zones",
    description: "Lists ad zones for the authenticated publisher.",
    auth: true,
    params: [
      { name: "website_id", type: "string", required: false, desc: "Filter by website" },
      { name: "organization_id", type: "string", required: false, desc: "Filter by organization" },
    ],
    response: `{
  "ok": true,
  "data": [...]
}`,
  },
  {
    method: "POST",
    path: "/ad-zones",
    title: "Create Ad Zone",
    description: "Creates a new ad zone.",
    auth: true,
    params: [
      { name: "name", type: "string", required: true, desc: "Zone name" },
      { name: "website_id", type: "string", required: true, desc: "Website ID" },
      { name: "format", type: "string", required: true, desc: "Ad format" },
      { name: "width", type: "number", required: false, desc: "Width in pixels" },
      { name: "height", type: "number", required: false, desc: "Height in pixels" },
      { name: "responsive", type: "boolean", required: false, desc: "Responsive zone" },
    ],
    response: `{
  "ok": true,
  "data": { "id": "uuid", "zone_key": "...", ... }
}`,
  },
  {
    method: "GET",
    path: "/analytics",
    title: "Analytics",
    description: "Returns analytics data with filters.",
    auth: true,
    params: [
      { name: "from", type: "string", required: true, desc: "Start date (YYYY-MM-DD)" },
      { name: "to", type: "string", required: true, desc: "End date (YYYY-MM-DD)" },
      { name: "campaign_id", type: "string", required: false, desc: "Filter by campaign" },
      { name: "website_id", type: "string", required: false, desc: "Filter by website" },
      { name: "ad_zone_id", type: "string", required: false, desc: "Filter by ad zone" },
      { name: "country", type: "string", required: false, desc: "Filter by country" },
      { name: "device", type: "string", required: false, desc: "Filter by device" },
    ],
    response: `{
  "ok": true,
  "data": {
    "summary": {
      "impressions": 0,
      "clicks": 0,
      "ctr": 0,
      "spend": 0,
      "cpc": 0,
      "cpm": 0
    },
    "timeSeries": [...],
    ...
  }
}`,
  },
];

const ERROR_CODES = [
  { code: "invalid_request", status: 400, desc: "Missing or invalid parameters" },
  { code: "unauthorized", status: 401, desc: "Missing or invalid authentication" },
  { code: "forbidden", status: 403, desc: "Insufficient permissions" },
  { code: "not_found", status: 404, desc: "Resource not found" },
  { code: "rate_limited", status: 429, desc: "Too many requests" },
  { code: "server_error", status: 500, desc: "Internal server error" },
];

export const Route = createFileRoute("/_authenticated/admin/api-docs")({
  head: () => ({
    meta: [
      { title: "API Documentation — Platform Admin — TradeMall" },
      { name: "description", content: "TradeMall API v1 reference and integration guide." },
      { property: "og:title", content: "API Documentation — TradeMall" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ApiDocsPage,
});

function ApiDocsPage() {
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const copyToClipboard = (text: string, path: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  return (
    <div className="container mx-auto py-8">
      <PageHeader
        title="API Documentation"
        description="TradeMall Advertising Platform API v1"
      />

      <div className="mt-8 grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Base URL
            </CardTitle>
          </CardHeader>
          <CardContent>
            <code className="rounded bg-muted px-3 py-2 text-sm">{BASE_URL}</code>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Authentication
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Authenticate requests using the <code>Authorization</code> header with a Bearer API key.
            </p>
            <div className="rounded-lg bg-muted p-4">
              <code className="text-sm">
                Authorization: Bearer <span className="text-primary">API_KEY</span>
              </code>
            </div>
            <p className="text-sm text-muted-foreground">
              Public endpoints (ad serving, events) do not require authentication.
              API keys are managed in the Admin dashboard under Platform Settings.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>All requests are validated server-side. The platform implements:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Rate limiting per IP and API key</li>
              <li>Request validation with Zod schemas</li>
              <li>Idempotency for event endpoints (unique request_id index)</li>
              <li>Fraud detection for impressions and clicks</li>
              <li>CORS headers for cross-origin requests</li>
              <li>API versioning via /api/v1 prefix</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code2 className="h-5 w-5" />
              Endpoints
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="ads" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="ads">Ads</TabsTrigger>
                <TabsTrigger value="events">Events</TabsTrigger>
                <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
                <TabsTrigger value="publisher">Publisher</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
              </TabsList>

              <TabsContent value="ads" className="space-y-4">
                {ENDPOINTS.filter((e) => e.path.startsWith("/ads")).map((ep) => (
                  <EndpointCard key={ep.path} endpoint={ep} copiedPath={copiedPath} onCopy={copyToClipboard} />
                ))}
              </TabsContent>

              <TabsContent value="events" className="space-y-4">
                {ENDPOINTS.filter((e) => e.path.startsWith("/events")).map((ep) => (
                  <EndpointCard key={ep.path} endpoint={ep} copiedPath={copiedPath} onCopy={copyToClipboard} />
                ))}
              </TabsContent>

              <TabsContent value="campaigns" className="space-y-4">
                {ENDPOINTS.filter((e) => e.path.startsWith("/campaigns")).map((ep) => (
                  <EndpointCard key={ep.path} endpoint={ep} copiedPath={copiedPath} onCopy={copyToClipboard} />
                ))}
              </TabsContent>

              <TabsContent value="publisher" className="space-y-4">
                {ENDPOINTS.filter((e) => e.path.startsWith("/websites") || e.path.startsWith("/ad-zones")).map((ep) => (
                  <EndpointCard key={ep.path} endpoint={ep} copiedPath={copiedPath} onCopy={copyToClipboard} />
                ))}
              </TabsContent>

              <TabsContent value="analytics" className="space-y-4">
                {ENDPOINTS.filter((e) => e.path === "/analytics").map((ep) => (
                  <EndpointCard key={ep.path} endpoint={ep} copiedPath={copiedPath} onCopy={copyToClipboard} />
                ))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Error Codes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="pb-2 text-left font-medium">Code</th>
                    <th className="pb-2 text-left font-medium">Status</th>
                    <th className="pb-2 text-left font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {ERROR_CODES.map((err) => (
                    <tr key={err.code} className="border-b last:border-0">
                      <td className="py-2">
                        <code className="rounded bg-muted px-2 py-1 text-xs">{err.code}</code>
                      </td>
                      <td className="py-2">
                        <span className="rounded bg-muted px-2 py-1 text-xs">{err.status}</span>
                      </td>
                      <td className="py-2 text-muted-foreground">{err.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              API Key Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              API keys are managed through the Admin dashboard. Each key is associated with an organization
              and can have specific permissions. Keys are hashed before storage and never exposed in full.
            </p>
            <div className="space-y-2">
              <p className="font-medium text-foreground">Key Fields:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Key ID:</strong> Public identifier for the key</li>
                <li><strong>Secret:</strong> Private secret (hashed, never stored in plaintext)</li>
                <li><strong>Organization ID:</strong> The organization the key belongs to</li>
                <li><strong>Permissions:</strong> JSON object defining allowed actions</li>
                <li><strong>Status:</strong> active, revoked, or expired</li>
                <li><strong>Expires At:</strong> Optional expiration timestamp</li>
                <li><strong>Last Used At:</strong> Timestamp of last successful authentication</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EndpointCard({
  endpoint,
  copiedPath,
  onCopy,
}: {
  endpoint: (typeof ENDPOINTS)[number];
  copiedPath: string | null;
  onCopy: (text: string, path: string) => void;
}) {
  const methodColor =
    endpoint.method === "GET"
      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      : endpoint.method === "POST"
        ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
        : endpoint.method === "PATCH"
          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
          : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center gap-3 mb-2">
        <span className={`rounded px-2 py-1 text-xs font-mono font-medium ${methodColor}`}>
          {endpoint.method}
        </span>
        <code className="text-sm font-mono">{endpoint.path}</code>
        {endpoint.auth && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" />
            Auth required
          </span>
        )}
      </div>
      <h4 className="font-medium mb-1">{endpoint.title}</h4>
      <p className="text-sm text-muted-foreground mb-3">{endpoint.description}</p>

      {endpoint.params.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium text-muted-foreground mb-1">Parameters</p>
          <div className="space-y-1">
            {endpoint.params.map((param) => (
              <div key={param.name} className="flex gap-2 text-xs">
                <code className="font-mono text-primary">{param.name}</code>
                <span className="text-muted-foreground">{param.type}</span>
                {param.required && <span className="text-red-500">*</span>}
                <span className="text-muted-foreground">{param.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="relative">
        <p className="text-xs font-medium text-muted-foreground mb-1">Response</p>
        <pre className="rounded bg-muted p-3 text-xs overflow-x-auto">
          <code>{endpoint.response}</code>
        </pre>
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-6 right-2 h-6 w-6 p-0"
          onClick={() => onCopy(endpoint.response, endpoint.path)}
        >
          {copiedPath === endpoint.path ? (
            <span className="text-xs">Copied</span>
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
      </div>
    </div>
  );
}
