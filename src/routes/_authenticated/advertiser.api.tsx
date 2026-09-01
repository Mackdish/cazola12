import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Copy,
  Eye,
  EyeOff,
  Key,
  Plus,
  RefreshCw,
  Trash2,
  BookOpen,
  Activity,
  Terminal,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, type DataTableColumn } from "@/components/patterns/data-table";
import { EmptyState, ErrorState, LoadingState } from "@/components/patterns/states";
import { StatusBadge } from "@/components/patterns/status-badge";
import { PageHeader } from "@/components/patterns/page-header";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import {
  useApiKeys,
  useApiStats,
  useApiRequestLogs,
  useCreateApiKey,
  useRevokeApiKey,
} from "@/hooks/use-api-management";
import { useAdvertiserOrg } from "@/hooks/use-advertiser";
import { toFriendlyError } from "@/lib/errors";

const BASE_URL = "https://trademall.co.ke/api/v1";

const ADVERTISER_SCOPES = [
  { value: "campaigns:read", label: "Campaigns: Read" },
  { value: "campaigns:write", label: "Campaigns: Write" },
  { value: "creatives:read", label: "Creatives: Read" },
  { value: "creatives:write", label: "Creatives: Write" },
  { value: "analytics:read", label: "Analytics: Read" },
];

const ADVERTISER_ENDPOINTS = [
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
    params: [{ name: "status", type: "string", required: true, desc: "pending_review" }],
    response: `{
  "ok": true,
  "data": { "id": "uuid", ... }
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

export const Route = createFileRoute("/_authenticated/advertiser/api")({
  head: () => ({
    meta: [
      { title: "API Management — Advertiser — TradeMall" },
      {
        name: "description",
        content: "Manage API keys and view documentation for the TradeMall API.",
      },
      { property: "og:title", content: "API Management — Advertiser — TradeMall" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdvertiserApiPage,
});

function AdvertiserApiPage() {
  const { organizationId } = useAdvertiserOrg();
  const keys = useApiKeys(organizationId);
  const stats = useApiStats(organizationId);
  const logs = useApiRequestLogs(organizationId);
  const createKey = useCreateApiKey();
  const revokeKey = useRevokeApiKey();

  const [createOpen, setCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>([
    "campaigns:read",
    "analytics:read",
  ]);
  const [newKeyExpiry, setNewKeyExpiry] = useState<string>("");
  const [revealToken, setRevealToken] = useState<string | null>(null);

  const keyColumns: DataTableColumn<{
    id: string;
    key_id: string;
    secret_last4: string;
    status: string;
    created_at: string;
    expires_at: string | null;
    organization_id: string;
  }>[] = [
    { id: "key_id", header: "Key ID", cell: (key) => key.key_id },
    {
      id: "status",
      header: "Status",
      cell: (key) => <StatusBadge tone={statusTone(key.status)}>{key.status}</StatusBadge>,
    },
    { id: "last4", header: "Last 4", cell: (key) => `...${key.secret_last4}` },
    {
      id: "created",
      header: "Created",
      cell: (key) => new Date(key.created_at).toLocaleDateString(),
    },
    {
      id: "expires",
      header: "Expires",
      cell: (key) => (key.expires_at ? new Date(key.expires_at).toLocaleDateString() : "Never"),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (key) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              navigator.clipboard.writeText(`${key.key_id}:${key.secret_last4}`);
              toast.success("Key prefix copied");
            }}
          >
            <Copy className="size-3.5" />
          </Button>
          {key.status === "active" && (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              onClick={() => {
                void revokeKey.mutateAsync({ organizationId: organizationId!, keyId: key.key_id });
                toast.success("API key revoked");
              }}
              disabled={revokeKey.isPending}
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  async function handleCreate() {
    if (!newKeyName.trim()) {
      toast.error("Give the key a name.");
      return;
    }
    try {
      const result = await createKey.mutateAsync({
        organizationId: organizationId!,
        name: newKeyName.trim(),
        permissions: Object.fromEntries(newKeyPermissions.map((p) => [p, ["read", "write"]])),
        expiresAt: newKeyExpiry || null,
      });
      setRevealToken(result.token ?? null);
      setCreateOpen(false);
      setNewKeyName("");
      setNewKeyPermissions(["campaigns:read", "analytics:read"]);
      setNewKeyExpiry("");
      toast.success("API key created. Save it now — it will not be shown again.");
    } catch (error) {
      toast.error(toFriendlyError(error, "We couldn't create that API key").message);
    }
  }

  if (!organizationId) {
    return (
      <WorkspaceGuard workspace="advertiser">
        <LoadingState rows={4} label="Loading API management" />
      </WorkspaceGuard>
    );
  }

  return (
    <WorkspaceGuard workspace="advertiser">
      <PageHeader
        eyebrow="Advertiser"
        title="API Management"
        description="Manage API keys, view documentation, and monitor usage."
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 size-4" />
            New API Key
          </Button>
        }
      />

      <Tabs defaultValue="overview" className="mt-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="keys">API Keys</TabsTrigger>
          <TabsTrigger value="docs">Documentation</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">API Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-success" />
                  <span className="text-sm font-medium">Active</span>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Base URL</CardTitle>
              </CardHeader>
              <CardContent>
                <code className="text-xs text-muted-foreground">{BASE_URL}</code>
              </CardContent>
            </Card>
            <Card className="shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Requests Today</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{stats.data?.todayRequests ?? 0}</div>
              </CardContent>
            </Card>
            <Card className="shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Requests This Month</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{stats.data?.monthRequests ?? 0}</div>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Quick Start</CardTitle>
              <CardDescription>Get started with the TradeMall API in minutes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Authentication</Label>
                <p className="text-sm text-muted-foreground">
                  Include your API key in the Authorization header:
                </p>
                <div className="rounded-md bg-muted p-3 font-mono text-sm">
                  Authorization: Bearer {"<"}key_id{":"}secret{">"}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Example Request</Label>
                <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto">
                  {`curl -X GET "${BASE_URL}/campaigns" \\
  -H "Authorization: Bearer ${"<"}key_id{":"}secret{">"}`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="keys" className="space-y-4">
          {keys.isLoading ? (
            <LoadingState rows={3} label="Loading API keys" />
          ) : keys.error ? (
            <ErrorState title="Failed to load API keys" message={keys.error.message} />
          ) : (
            <DataTable
              columns={keyColumns}
              rows={keys.data ?? []}
              rowKey={(key) => key.id}
              emptyTitle="No API keys yet"
              emptyDescription="Create an API key to start integrating."
              emptyAction={
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-1.5 size-4" />
                  Create API Key
                </Button>
              }
            />
          )}
        </TabsContent>

        <TabsContent value="docs" className="space-y-4">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="size-4" />
                Advertiser API Endpoints
              </CardTitle>
              <CardDescription>Available endpoints for advertiser integrations.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {ADVERTISER_ENDPOINTS.map((ep) => (
                  <div key={ep.path} className="rounded-lg border p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <span
                        className={`rounded px-2 py-1 text-xs font-mono font-medium ${
                          ep.method === "GET"
                            ? "bg-green-100 text-green-800"
                            : ep.method === "POST"
                              ? "bg-blue-100 text-blue-800"
                              : ep.method === "PATCH"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {ep.method}
                      </span>
                      <code className="text-sm font-mono">{ep.path}</code>
                      {ep.auth && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Key className="h-3 w-3" />
                          Auth required
                        </span>
                      )}
                    </div>
                    <h4 className="font-medium mb-1">{ep.title}</h4>
                    <p className="text-sm text-muted-foreground mb-3">{ep.description}</p>
                    {ep.params.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Parameters</p>
                        <div className="space-y-1">
                          {ep.params.map((param) => (
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
                        <code>{ep.response}</code>
                      </pre>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-6 right-2 h-6 w-6 p-0"
                        onClick={() => {
                          navigator.clipboard.writeText(ep.response);
                          toast.success("Copied");
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{stats.data?.totalRequests ?? 0}</div>
              </CardContent>
            </Card>
            <Card className="shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Successful</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-success">
                  {stats.data?.successfulRequests ?? 0}
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Failed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-destructive">
                  {stats.data?.failedRequests ?? 0}
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Last Request</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm">
                  {stats.data?.lastRequest
                    ? new Date(stats.data.lastRequest).toLocaleString()
                    : "Never"}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          {logs.isLoading ? (
            <LoadingState rows={3} label="Loading logs" />
          ) : logs.error ? (
            <ErrorState title="Failed to load logs" message={logs.error.message} />
          ) : (
            <DataTable
              columns={[
                { id: "endpoint", header: "Endpoint", cell: (log) => log.endpoint },
                { id: "method", header: "Method", cell: (log) => log.method },
                {
                  id: "status_code",
                  header: "Status",
                  cell: (log) => (
                    <StatusBadge
                      tone={
                        log.status_code >= 200 && log.status_code < 300 ? "active" : "suspended"
                      }
                    >
                      {log.status_code}
                    </StatusBadge>
                  ),
                },
                {
                  id: "response_time_ms",
                  header: "Response Time",
                  cell: (log) => `${log.response_time_ms ?? 0}ms`,
                },
                {
                  id: "created_at",
                  header: "Timestamp",
                  cell: (log) => new Date(log.created_at).toLocaleString(),
                },
              ]}
              rows={logs.data ?? []}
              rowKey={(log) => log.id}
              emptyTitle="No API requests yet"
              emptyDescription="Requests will appear here after you start using the API."
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Create API Key Dialog */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Create API Key</CardTitle>
              <CardDescription>Create a new API key for your organization.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="key-name">Key Name</Label>
                <Input
                  id="key-name"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="My API Key"
                />
              </div>
              <div className="space-y-2">
                <Label>Permissions</Label>
                <Select
                  value={newKeyPermissions[0] ?? ""}
                  onValueChange={(value) => setNewKeyPermissions([value])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ADVERTISER_SCOPES.map((scope) => (
                      <SelectItem key={scope.value} value={scope.value}>
                        {scope.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="key-expiry">Expires (optional)</Label>
                <Input
                  id="key-expiry"
                  type="datetime-local"
                  value={newKeyExpiry}
                  onChange={(e) => setNewKeyExpiry(e.target.value)}
                />
              </div>
            </CardContent>
            <div className="flex justify-end gap-2 p-4 pt-0">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={createKey.isPending}>
                {createKey.isPending ? "Creating..." : "Create Key"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Reveal Token Dialog */}
      {revealToken && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Your API Key</CardTitle>
              <CardDescription>Copy this key now. It will not be shown again.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md bg-muted p-3 font-mono text-sm break-all">
                {revealToken}
              </div>
              <p className="text-xs text-destructive">
                This is the only time your secret will be shown. Store it securely.
              </p>
            </CardContent>
            <div className="flex justify-end gap-2 p-4 pt-0">
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(revealToken);
                  toast.success("API key copied to clipboard");
                }}
              >
                <Copy className="mr-1.5 size-4" />
                Copy Key
              </Button>
              <Button variant="outline" onClick={() => setRevealToken(null)}>
                Done
              </Button>
            </div>
          </Card>
        </div>
      )}
    </WorkspaceGuard>
  );
}

function statusTone(status: string): "active" | "pending" | "suspended" | "neutral" | "info" {
  if (status === "active") return "active";
  if (status === "pending") return "pending";
  if (status === "revoked" || status === "expired") return "suspended";
  return "neutral";
}
