import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, type DataTableColumn } from "@/components/patterns/data-table";
import { EmptyState, ErrorState, LoadingState } from "@/components/patterns/states";
import { StatusBadge, statusTone } from "@/components/patterns/status-badge";
import { PageHeader } from "@/components/patterns/page-header";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import {
  useAllViolations,
  useCreatePublisherPolicy,
  useDeletePublisherPolicy,
  usePublisherOrg,
  usePublisherPolicies,
  useUpdatePublisherPolicy,
  useWebsites,
} from "@/hooks/use-publisher";
import { toFriendlyError } from "@/lib/errors";
import type {
  PolicyStatus,
  ViolationSeverity,
  ViolationStatus,
} from "@/lib/publisher-policy.domain";

export const Route = createFileRoute("/_authenticated/publisher/policies")({
  head: () => ({
    meta: [
      { title: "Policy Center — Publisher — TradeMall" },
      {
        name: "description",
        content: "Manage publisher policies and review violations.",
      },
      { property: "og:title", content: "Policy Center — Publisher — TradeMall" },
      {
        property: "og:description",
        content: "Manage publisher policies and review violations.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

type PolicyRow = {
  id: string;
  title: string;
  category: string;
  severity: ViolationSeverity;
  is_active: boolean;
  description: string;
  created_at: string;
  updated_at: string;
};

type ViolationRow = {
  id: string;
  violation_type: string;
  severity: ViolationSeverity;
  status: ViolationStatus;
  description: string;
  website_id: string;
  websiteName: string;
  created_at: string;
};

function severityTone(severity: ViolationSeverity) {
  if (severity === "critical" || severity === "high") return "suspended";
  if (severity === "medium") return "pending";
  return "neutral";
}

function violationStatusTone(status: ViolationStatus) {
  if (status === "open" || status === "in_review") return "pending";
  if (status === "resolved") return "active";
  return "neutral";
}

function policyActiveTone(isActive: boolean) {
  return isActive ? "active" : "suspended";
}

const POLICY_CATEGORIES = [
  "Content",
  "Ads",
  "User Experience",
  "Security",
  "Privacy",
  "SEO",
  "Brand",
  "Other",
];

const SEVERITIES: { value: ViolationSeverity; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

function Page() {
  const { organizationId } = usePublisherOrg();
  const policies = usePublisherPolicies(organizationId);
  const violations = useAllViolations(organizationId);
  const { data: websites } = useWebsites(organizationId);

  const createPolicy = useCreatePublisherPolicy();
  const updatePolicy = useUpdatePublisherPolicy();
  const deletePolicy = useDeletePublisherPolicy();

  const [policyOpen, setPolicyOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<PolicyRow | null>(null);
  const [policyTitle, setPolicyTitle] = useState("");
  const [policyDescription, setPolicyDescription] = useState("");
  const [policyCategory, setPolicyCategory] = useState(POLICY_CATEGORIES[0] ?? "");
  const [policySeverity, setPolicySeverity] = useState<ViolationSeverity>("medium");

  const websiteNameMap = new Map((websites ?? []).map((w) => [w.id, w.name]));

  const policyRows: PolicyRow[] = (policies.data ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    category: p.category,
    severity: p.severity as ViolationSeverity,
    is_active: p.is_active,
    description: p.description,
    created_at: p.created_at,
    updated_at: p.updated_at,
  }));

  const violationRows: ViolationRow[] = (violations.data ?? []).map((v) => ({
    id: v.id,
    violation_type: v.violation_type,
    severity: v.severity as ViolationSeverity,
    status: v.status as ViolationStatus,
    description: v.description,
    website_id: v.website_id,
    websiteName: websiteNameMap.get(v.website_id) ?? "Unknown website",
    created_at: v.created_at,
  }));

  function resetPolicyForm() {
    setPolicyTitle("");
    setPolicyDescription("");
    setPolicyCategory(POLICY_CATEGORIES[0] ?? "");
    setPolicySeverity("medium");
    setEditingPolicy(null);
  }

  async function submitPolicy() {
    if (!organizationId) {
      toast.error("You need a publisher organization to manage policies.");
      return;
    }
    if (policyTitle.trim().length < 2) {
      toast.error("Give the policy a title.");
      return;
    }
    if (policyDescription.trim().length < 10) {
      toast.error("Description must be at least 10 characters.");
      return;
    }
    try {
      if (editingPolicy) {
        await updatePolicy.mutateAsync({
          policyId: editingPolicy.id,
          title: policyTitle.trim(),
          description: policyDescription.trim(),
          category: policyCategory,
          severity: policySeverity,
        });
        toast.success("Policy updated.");
      } else {
        await createPolicy.mutateAsync({
          organizationId,
          title: policyTitle.trim(),
          description: policyDescription.trim(),
          category: policyCategory,
          severity: policySeverity,
        });
        toast.success("Policy created.");
      }
      setPolicyOpen(false);
      resetPolicyForm();
    } catch (error) {
      const friendly = toFriendlyError(error, "We couldn't save that policy");
      toast.error(friendly.message);
    }
  }

  function startEdit(policy: PolicyRow) {
    setEditingPolicy(policy);
    setPolicyTitle(policy.title);
    setPolicyDescription(policy.description);
    setPolicyCategory(policy.category);
    setPolicySeverity(policy.severity);
    setPolicyOpen(true);
  }

  async function handleDelete(policyId: string) {
    try {
      await deletePolicy.mutateAsync({ policyId });
      toast.success("Policy deleted.");
    } catch (error) {
      const friendly = toFriendlyError(error, "We couldn't delete that policy");
      toast.error(friendly.message);
    }
  }

  const policyColumns: DataTableColumn<PolicyRow>[] = [
    { id: "title", header: "Title", cell: (row) => row.title },
    { id: "category", header: "Category", cell: (row) => row.category },
    {
      id: "severity",
      header: "Severity",
      cell: (row) => (
        <StatusBadge tone={severityTone(row.severity)}>
          {row.severity}
        </StatusBadge>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => (
        <StatusBadge tone={policyActiveTone(row.is_active)}>
          {row.is_active ? "Active" : "Inactive"}
        </StatusBadge>
      ),
    },
    {
      id: "created",
      header: "Created",
      cell: (row) => new Date(row.created_at).toLocaleDateString(),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      className: "w-24",
      cell: (row) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => startEdit(row)}
          >
            <ShieldAlert className="size-3.5" />
            <span className="sr-only">Edit</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-destructive hover:text-destructive"
            onClick={() => handleDelete(row.id)}
            disabled={deletePolicy.isPending}
          >
            <Trash2 className="size-3.5" />
            <span className="sr-only">Delete</span>
          </Button>
        </div>
      ),
    },
  ];

  const violationColumns: DataTableColumn<ViolationRow>[] = [
    { id: "type", header: "Type", cell: (row) => row.violation_type },
    { id: "website", header: "Website", cell: (row) => row.websiteName },
    {
      id: "severity",
      header: "Severity",
      cell: (row) => (
        <StatusBadge tone={severityTone(row.severity)}>
          {row.severity}
        </StatusBadge>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => (
        <StatusBadge tone={violationStatusTone(row.status)}>
          {row.status.replace("_", " ")}
        </StatusBadge>
      ),
    },
    {
      id: "description",
      header: "Description",
      className: "max-w-xs",
      cell: (row) => (
        <span className="truncate block" title={row.description}>
          {row.description}
        </span>
      ),
    },
    {
      id: "created",
      header: "Created",
      cell: (row) => new Date(row.created_at).toLocaleDateString(),
    },
  ];

  if (policies.isLoading || violations.isLoading) {
    return (
      <WorkspaceGuard workspace="publisher">
        <LoadingState rows={4} label="Loading policy center" />
      </WorkspaceGuard>
    );
  }

  return (
    <WorkspaceGuard workspace="publisher">
      <PageHeader
        eyebrow="Publisher"
        title="Policy Center"
        description="Manage your content and ad policies, and review violations."
        actions={
          <Dialog open={policyOpen} onOpenChange={setPolicyOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1.5 size-4" />
                New policy
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingPolicy ? "Edit policy" : "Create a new policy"}
                </DialogTitle>
                <DialogDescription>
                  {editingPolicy
                    ? "Update the policy details below."
                    : "Add a new policy to help govern your ad inventory."}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="policy-title">Title</Label>
                  <Input
                    id="policy-title"
                    placeholder="e.g. No misleading claims"
                    value={policyTitle}
                    onChange={(e) => setPolicyTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="policy-description">Description</Label>
                  <Textarea
                    id="policy-description"
                    rows={3}
                    placeholder="Describe what this policy covers..."
                    value={policyDescription}
                    onChange={(e) => setPolicyDescription(e.target.value)}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="policy-category">Category</Label>
                    <Select
                      value={policyCategory}
                      onValueChange={setPolicyCategory}
                    >
                      <SelectTrigger id="policy-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {POLICY_CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="policy-severity">Severity</Label>
                    <Select
                      value={policySeverity}
                      onValueChange={(value) =>
                        setPolicySeverity(value as ViolationSeverity)
                      }
                    >
                      <SelectTrigger id="policy-severity">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SEVERITIES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setPolicyOpen(false);
                    resetPolicyForm();
                  }}
                  disabled={createPolicy.isPending || updatePolicy.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => void submitPolicy()}
                  disabled={createPolicy.isPending || updatePolicy.isPending}
                >
                  {createPolicy.isPending || updatePolicy.isPending
                    ? "Saving..."
                    : editingPolicy
                      ? "Update policy"
                      : "Create policy"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Tabs defaultValue="policies" className="mt-6">
        <TabsList>
          <TabsTrigger value="policies">Policies</TabsTrigger>
          <TabsTrigger value="violations">Violations</TabsTrigger>
        </TabsList>

        <TabsContent value="policies" className="mt-4 space-y-3">
          {policies.error ? (
            <ErrorState
              title="Couldn't load policies"
              message={policies.error.message}
              onRetry={() => void policies.refetch()}
            />
          ) : policyRows.length === 0 ? (
            <EmptyState
              icon={<ShieldAlert className="size-5" />}
              title="No policies yet"
              description="Create your first policy to start governing your ad inventory."
              action={
                <Button onClick={() => setPolicyOpen(true)} size="sm">
                  <Plus className="mr-1.5 size-4" />
                  Create policy
                </Button>
              }
            />
          ) : (
            <DataTable
              columns={policyColumns}
              rows={policyRows}
              rowKey={(row) => row.id}
              emptyTitle="No policies yet"
              emptyDescription="Create your first policy to get started."
              caption="Publisher policies"
            />
          )}
        </TabsContent>

        <TabsContent value="violations" className="mt-4 space-y-3">
          {violations.error ? (
            <ErrorState
              title="Couldn't load violations"
              message={violations.error.message}
              onRetry={() => void violations.refetch()}
            />
          ) : violationRows.length === 0 ? (
            <EmptyState
              icon={<ShieldAlert className="size-5" />}
              title="No violations yet"
              description="Violations will appear here when they are detected."
            />
          ) : (
            <DataTable
              columns={violationColumns}
              rows={violationRows}
              rowKey={(row) => row.id}
              emptyTitle="No violations yet"
              emptyDescription="All clear — no violations have been reported."
              caption="Policy violations"
            />
          )}
        </TabsContent>
      </Tabs>
    </WorkspaceGuard>
  );
}
