import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
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
import { useAdminPublishers, useAdminWebsites } from "@/hooks/use-publisher";
import { toFriendlyError } from "@/lib/errors";

const BASE_URL = "https://trademall.co.ke/api/v1";

const ALL_SCOPES = [
  { value: "campaigns:read", label: "Campaigns: Read" },
  { value: "campaigns:write", label: "Campaigns: Write" },
  { value: "creatives:read", label: "Creatives: Read" },
  { value: "creatives:write", label: "Creatives: Write" },
  { value: "analytics:read", label: "Analytics: Read" },
  { value: "websites:read", label: "Websites: Read" },
  { value: "websites:write", label: "Websites: Write" },
  { value: "ad-zones:read", label: "Ad Zones: Read" },
  { value: "ad-zones:write", label: "Ad Zones: Write" },
  { value: "earnings:read", label: "Earnings: Read" },
];

export const Route = createFileRoute("/_authenticated/admin/api")({
  head: () => ({
    meta: [
      { title: "API Management — Platform Admin — TradeMall" },
      {
        name: "description",
        content: "Manage API keys, view usage, and monitor API activity across the platform.",
      },
      { property: "og:title", content: "API Management — Platform Admin — TradeMall" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminApiPage,
});

function AdminApiPage() {
  const publishers = useAdminPublishers();
  const websites = useAdminWebsites();
  const keys = useApiKeys(null);
  const stats = useApiStats(null);
  const logs = useApiRequestLogs(null);
  const createKey = useCreateApiKey();
  const revokeKey = useRevokeApiKey();

  const [createOpen, setCreateOpen] = useState(false);
  const [newKeyOrg, setNewKeyOrg] = useState("");
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>(["campaigns:read"]);
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
    { id: "organization_id", header: "Organization", cell: (key) => key.organization_id },
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
                void revokeKey.mutateAsync({
                  organizationId: key.organization_id,
                  keyId: key.key_id,
                });
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
    if (!newKeyOrg) {
      toast.error("Select an organization.");
      return;
    }
    if (!newKeyName.trim()) {
      toast.error("Give the key a name.");
      return;
    }
    try {
      const result = await createKey.mutateAsync({
        organizationId: newKeyOrg,
        name: newKeyName.trim(),
        permissions: Object.fromEntries(newKeyPermissions.map((p) => [p, ["read", "write"]])),
        expiresAt: newKeyExpiry || null,
      });
      setRevealToken(result.token ?? null);
      setCreateOpen(false);
      setNewKeyOrg("");
      setNewKeyName("");
      setNewKeyPermissions(["campaigns:read"]);
      setNewKeyExpiry("");
      toast.success("API key created. Save it now — it will not be shown again.");
    } catch (error) {
      toast.error(toFriendlyError(error, "We couldn't create that API key").message);
    }
  }

  return (
    <WorkspaceGuard workspace="admin">
      <PageHeader
        eyebrow="Platform Admin"
        title="API Management"
        description="Manage API keys, view usage, and monitor API activity across the platform."
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
                <CardTitle className="text-sm font-medium">Organizations Using API</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{publishers.data?.length ?? 0}</div>
              </CardContent>
            </Card>
            <Card className="shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total API Keys</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{keys.data?.length ?? 0}</div>
              </CardContent>
            </Card>
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
                <CardTitle className="text-sm font-medium">Failed Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-destructive">
                  {stats.data?.failedRequests ?? 0}
                </div>
              </CardContent>
            </Card>
          </div>
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
              emptyDescription="Create an API key to get started."
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
                API Documentation
              </CardTitle>
              <CardDescription>Complete API reference for the TradeMall platform.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="rounded bg-muted px-2 py-1 text-xs font-mono font-medium">
                      BASE URL
                    </span>
                    <code className="text-sm font-mono">{BASE_URL}</code>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    All API endpoints are prefixed with <code>{BASE_URL}</code>. Authentication is
                    required for all endpoints except public ad serving.
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="rounded bg-muted px-2 py-1 text-xs font-mono font-medium">
                      AUTH
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Include your API key in the Authorization header:
                  </p>
                  <pre className="rounded bg-muted p-3 text-xs">
                    Authorization: Bearer {"<"}key_id{":"}secret{">"}
                  </pre>
                </div>
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
                <CardTitle className="text-sm font-medium">Last Activity</CardTitle>
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
              emptyDescription="Requests will appear here after organizations start using the API."
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
              <CardDescription>Create a new API key for an organization.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="key-org">Organization</Label>
                <Select value={newKeyOrg} onValueChange={setNewKeyOrg}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {(publishers.data ?? []).map((pub) => (
                      <SelectItem key={pub.organization_id} value={pub.organization_id}>
                        {pub.business_name || pub.organization_id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                    {ALL_SCOPES.map((scope) => (
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
