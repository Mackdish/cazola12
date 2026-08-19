import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  Save,
  GripVertical,
  ChevronDown,
  ChevronUp,
  FileText,
} from "lucide-react";

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
import { Switch } from "@/components/ui/switch";
import { DataTable, type DataTableColumn } from "@/components/patterns/data-table";
import { EmptyState, ErrorState, LoadingState } from "@/components/patterns/states";
import { StatusBadge, statusTone } from "@/components/patterns/status-badge";
import { PageHeader } from "@/components/patterns/page-header";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import {
  useAdminCreatePolicy,
  useAdminDeletePolicy,
  useAdminUpdatePolicy,
  useAllPolicies,
} from "@/hooks/use-policies";

export const Route = createFileRoute("/_authenticated/admin/policies/content")({
  head: () => ({
    meta: [
      { title: "Policy Management — Platform Admin — TradeMall" },
      {
        name: "description",
        content: "Manage platform policies, create articles, and publish documentation.",
      },
      { property: "og:title", content: "Policy Management — Platform Admin — TradeMall" },
      {
        property: "og:description",
        content: "Manage platform policies, create articles, and publish documentation.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPolicyContentPage,
});

const CATEGORIES = [
  { value: "ad_policies", label: "Ad Policies" },
  { value: "publisher_guidelines", label: "Publisher Guidelines" },
  { value: "traffic_quality", label: "Traffic Quality" },
  { value: "prohibited_content", label: "Prohibited Content" },
  { value: "data_privacy", label: "Data & Privacy" },
  { value: "compliance", label: "Compliance" },
  { value: "advertiser_policies", label: "Advertiser Policies" },
  { value: "publisher_policies", label: "Publisher Policies" },
];

type PolicyRow = {
  id: string;
  category: string;
  slug: string;
  title: string;
  description: string;
  is_published: boolean;
  last_updated: string;
  sections_count: number;
};

type SectionEditor = {
  id: string;
  title: string;
  content: string;
  examples: string;
  requirements: string;
  violations: string;
  enforcement: string;
};

function AdminPolicyContentPage() {
  const policies = useAllPolicies();
  const createPolicy = useAdminCreatePolicy();
  const updatePolicy = useAdminUpdatePolicy();
  const deletePolicy = useAdminDeletePolicy();

  const [policyOpen, setPolicyOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<PolicyRow | null>(null);
  const [previewPolicy, setPreviewPolicy] = useState<PolicyRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [category, setCategory] = useState(CATEGORIES[0]?.value ?? "");
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [sections, setSections] = useState<SectionEditor[]>([
    {
      id: crypto.randomUUID(),
      title: "",
      content: "",
      examples: "",
      requirements: "",
      violations: "",
      enforcement: "",
    },
  ]);
  const [relatedPolicies, setRelatedPolicies] = useState("");

  const policyRows: PolicyRow[] = useMemo(
    () =>
      (policies.data ?? []).map((p) => ({
        id: p.id,
        category: p.category,
        slug: p.slug,
        title: p.title,
        description: p.description,
        is_published: p.is_published,
        last_updated: p.last_updated,
        sections_count: Array.isArray(p.sections) ? p.sections.length : 0,
      })),
    [policies.data],
  );

  function resetForm() {
    setEditingPolicy(null);
    setCategory(CATEGORIES[0]?.value ?? "");
    setSlug("");
    setTitle("");
    setDescription("");
    setIsPublished(false);
    setSections([
      {
        id: crypto.randomUUID(),
        title: "",
        content: "",
        examples: "",
        requirements: "",
        violations: "",
        enforcement: "",
      },
    ]);
    setRelatedPolicies("");
  }

  function startEdit(policy: PolicyRow) {
    const fullPolicy = policies.data?.find((p) => p.id === policy.id);
    setEditingPolicy(policy);
    setCategory(policy.category);
    setSlug(policy.slug);
    setTitle(policy.title);
    setDescription(policy.description);
    setIsPublished(policy.is_published);
    if (fullPolicy?.related_policies && Array.isArray(fullPolicy.related_policies)) {
      setRelatedPolicies(fullPolicy.related_policies.join(", "));
    } else {
      setRelatedPolicies("");
    }
    if (
      fullPolicy?.sections &&
      Array.isArray(fullPolicy.sections) &&
      fullPolicy.sections.length > 0
    ) {
      setSections(
        (fullPolicy.sections as unknown[]).map((raw) => {
          const s = (raw ?? {}) as Record<string, unknown>;
          return {
            id: (s["id"] as string) || crypto.randomUUID(),
            title: (s["title"] as string) || "",
            content: (s["content"] as string) || "",
            examples: Array.isArray(s["examples"]) ? (s["examples"] as string[]).join("\n") : "",
            requirements: Array.isArray(s["requirements"])
              ? (s["requirements"] as string[]).join("\n")
              : "",
            violations: Array.isArray(s["violations"])
              ? (s["violations"] as string[]).join("\n")
              : "",
            enforcement: (s["enforcement"] as string) || "",
          };
        }),
      );

    } else {
      setSections([
        {
          id: crypto.randomUUID(),
          title: "",
          content: "",
          examples: "",
          requirements: "",
          violations: "",
          enforcement: "",
        },
      ]);
    }
    setPolicyOpen(true);
  }

  function addSection() {
    setSections((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        title: "",
        content: "",
        examples: "",
        requirements: "",
        violations: "",
        enforcement: "",
      },
    ]);
  }

  function updateSection(index: number, field: keyof SectionEditor, value: string) {
    setSections((prev) => {
      const next = [...prev];
      const current = next[index];
      if (!current) return prev;
      next[index] = { ...current, [field]: value };
      return next;
    });
  }

  function removeSection(index: number) {
    setSections((prev) => prev.filter((_, i) => i !== index));
  }

  function moveSection(index: number, direction: -1 | 1) {
    setSections((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      const a = next[index];
      const b = next[target];
      if (!a || !b) return prev;
      next[index] = b;
      next[target] = a;
      return next;
    });
  }


  function serializeSections() {
    return sections
      .filter((s) => s.title.trim() || s.content.trim())
      .map(({ id, title, content, examples, requirements, violations, enforcement }) => ({
        id: id || crypto.randomUUID(),
        title: title.trim(),
        content: content.trim(),
        ...(examples.trim() ? { examples: examples.split("\n").filter(Boolean) } : {}),
        ...(requirements.trim() ? { requirements: requirements.split("\n").filter(Boolean) } : {}),
        ...(violations.trim() ? { violations: violations.split("\n").filter(Boolean) } : {}),
        ...(enforcement.trim() ? { enforcement: enforcement.trim() } : {}),
      }));
  }

  async function handleSubmit() {
    if (!title.trim() || !description.trim() || !slug.trim()) {
      toast.error("Title, description, and slug are required.");
      return;
    }
    const serialized = serializeSections();
    try {
      if (editingPolicy) {
        await updatePolicy.mutateAsync({
          policyId: editingPolicy.id,
          category,
          slug: slug.trim(),
          title: title.trim(),
          description: description.trim(),
          sections: serialized,
          relatedPolicies: relatedPolicies
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          isPublished,
        });
        toast.success("Policy updated.");
      } else {
        await createPolicy.mutateAsync({
          category,
          slug: slug.trim(),
          title: title.trim(),
          description: description.trim(),
          sections: serialized,
          relatedPolicies: relatedPolicies
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          isPublished,
        });
        toast.success("Policy created.");
      }
      setPolicyOpen(false);
      resetForm();
    } catch (error) {
      toast.error("Failed to save policy.");
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) return;
    try {
      await deletePolicy.mutateAsync(deleteConfirm);
      toast.success("Policy deleted.");
      setDeleteConfirm(null);
    } catch {
      toast.error("Failed to delete policy.");
    }
  }

  async function handleTogglePublish(row: PolicyRow, next: boolean) {
    try {
      await updatePolicy.mutateAsync({ policyId: row.id, isPublished: next });
      toast.success(next ? "Policy published to the website." : "Policy unpublished.");
    } catch {
      toast.error("Failed to update publish status.");
    }
  }

  if (policies.isLoading) {
    return (
      <WorkspaceGuard workspace="admin">
        <LoadingState rows={4} label="Loading policies" />
      </WorkspaceGuard>
    );
  }

  if (policies.error) {
    return (
      <WorkspaceGuard workspace="admin">
        <ErrorState
          title="Couldn't load policies"
          message={policies.error.message}
          onRetry={() => void policies.refetch()}
        />
      </WorkspaceGuard>
    );
  }

  return (
    <WorkspaceGuard workspace="admin">
      <PageHeader
        eyebrow="Platform Admin"
        title="Policy Management"
        description="Create, edit, and publish platform policy documentation."
        actions={
          <Dialog open={policyOpen} onOpenChange={setPolicyOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                onClick={() => {
                  resetForm();
                  setPolicyOpen(true);
                }}
              >
                <Plus className="mr-1.5 size-4" />
                New Policy
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingPolicy ? "Edit Policy" : "Create New Policy"}</DialogTitle>
                <DialogDescription>
                  {editingPolicy
                    ? "Update the policy details below."
                    : "Add a new platform policy article."}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger id="category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slug">Slug</Label>
                    <Input
                      id="slug"
                      placeholder="e.g. ad-policies"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      disabled={Boolean(editingPolicy)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    placeholder="Policy title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Short Description</Label>
                  <Textarea
                    id="description"
                    rows={2}
                    placeholder="Brief summary shown on the policies page..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Related Policy Slugs (comma-separated)</Label>
                  <Input
                    placeholder="traffic_quality, prohibited_content"
                    value={relatedPolicies}
                    onChange={(e) => setRelatedPolicies(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Switch id="published" checked={isPublished} onCheckedChange={setIsPublished} />
                  <Label htmlFor="published" className="cursor-pointer">
                    {isPublished ? "Published" : "Draft"}
                  </Label>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Sections</Label>
                    <Button type="button" size="sm" variant="outline" onClick={addSection}>
                      <Plus className="mr-1 size-3.5" />
                      Add Section
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {sections.map((section, index) => (
                      <div
                        key={section.id}
                        className="rounded-lg border border-border p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <GripVertical className="size-4 text-muted-foreground" />
                            <span className="text-xs font-medium text-muted-foreground">
                              Section {index + 1}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-7"
                              onClick={() => moveSection(index, -1)}
                              disabled={index === 0}
                            >
                              <ChevronUp className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-7"
                              onClick={() => moveSection(index, 1)}
                              disabled={index === sections.length - 1}
                            >
                              <ChevronDown className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-7 text-destructive hover:text-destructive"
                              onClick={() => removeSection(index)}
                              disabled={sections.length === 1}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`section-title-${index}`}>Section Title</Label>
                          <Input
                            id={`section-title-${index}`}
                            value={section.title}
                            onChange={(e) => updateSection(index, "title", e.target.value)}
                            placeholder="e.g. Ad Creative Requirements"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`section-content-${index}`}>Content</Label>
                          <Textarea
                            id={`section-content-${index}`}
                            rows={4}
                            value={section.content}
                            onChange={(e) => updateSection(index, "content", e.target.value)}
                            placeholder="Detailed explanation..."
                          />
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label htmlFor={`section-examples-${index}`} className="text-xs">
                              Examples (one per line)
                            </Label>
                            <Textarea
                              id={`section-examples-${index}`}
                              rows={3}
                              value={section.examples}
                              onChange={(e) => updateSection(index, "examples", e.target.value)}
                              placeholder="Example 1&#10;Example 2"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`section-reqs-${index}`} className="text-xs">
                              Requirements (one per line)
                            </Label>
                            <Textarea
                              id={`section-reqs-${index}`}
                              rows={3}
                              value={section.requirements}
                              onChange={(e) => updateSection(index, "requirements", e.target.value)}
                              placeholder="Requirement 1&#10;Requirement 2"
                            />
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label htmlFor={`section-violations-${index}`} className="text-xs">
                              Violations (one per line)
                            </Label>
                            <Textarea
                              id={`section-violations-${index}`}
                              rows={3}
                              value={section.violations}
                              onChange={(e) => updateSection(index, "violations", e.target.value)}
                              placeholder="Violation 1&#10;Violation 2"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`section-enforcement-${index}`} className="text-xs">
                              Enforcement Note
                            </Label>
                            <Textarea
                              id={`section-enforcement-${index}`}
                              rows={3}
                              value={section.enforcement}
                              onChange={(e) => updateSection(index, "enforcement", e.target.value)}
                              placeholder="Enforcement details..."
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setPolicyOpen(false);
                    resetForm();
                  }}
                  disabled={createPolicy.isPending || updatePolicy.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => void handleSubmit()}
                  disabled={createPolicy.isPending || updatePolicy.isPending}
                >
                  {createPolicy.isPending || updatePolicy.isPending
                    ? "Saving..."
                    : editingPolicy
                      ? "Update Policy"
                      : "Create Policy"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Tabs defaultValue="all" className="mt-6">
        <TabsList>
          <TabsTrigger value="all">All Policies</TabsTrigger>
          <TabsTrigger value="published">Published</TabsTrigger>
          <TabsTrigger value="drafts">Drafts</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <PolicyTable
            rows={policyRows}
            onEdit={startEdit}
            onDelete={(id) => setDeleteConfirm(id)}
            onPreview={(p) => setPreviewPolicy(p)}
            onTogglePublish={handleTogglePublish}
            isDeleting={deletePolicy.isPending}
            isTogglingPublish={updatePolicy.isPending}
          />
        </TabsContent>

        <TabsContent value="published" className="mt-4">
          <PolicyTable
            rows={policyRows.filter((r) => r.is_published)}
            onEdit={startEdit}
            onDelete={(id) => setDeleteConfirm(id)}
            onPreview={(p) => setPreviewPolicy(p)}
            onTogglePublish={handleTogglePublish}
            isDeleting={deletePolicy.isPending}
            isTogglingPublish={updatePolicy.isPending}
          />
        </TabsContent>

        <TabsContent value="drafts" className="mt-4">
          <PolicyTable
            rows={policyRows.filter((r) => !r.is_published)}
            onEdit={startEdit}
            onDelete={(id) => setDeleteConfirm(id)}
            onPreview={(p) => setPreviewPolicy(p)}
            onTogglePublish={handleTogglePublish}
            isDeleting={deletePolicy.isPending}
            isTogglingPublish={updatePolicy.isPending}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={!!previewPolicy} onOpenChange={(open) => !open && setPreviewPolicy(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{previewPolicy?.title}</DialogTitle>
            <DialogDescription>{previewPolicy?.description}</DialogDescription>
          </DialogHeader>
          {previewPolicy && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <StatusBadge tone={previewPolicy.is_published ? "active" : "suspended"}>
                  {previewPolicy.is_published ? "Published" : "Draft"}
                </StatusBadge>
                <span className="text-xs text-muted-foreground">
                  Last updated: {new Date(previewPolicy.last_updated).toLocaleString()}
                </span>
              </div>
              {(() => {
                const policy = policies.data?.find((p) => p.id === previewPolicy.id);
                if (!policy) return null;
                const sections = Array.isArray(policy.sections) ? policy.sections : [];
                return (
                  <div className="space-y-6">
                    {(sections as unknown[]).map((raw, i: number) => {
                      const section = (raw ?? {}) as Record<string, unknown>;
                      const examples = Array.isArray(section["examples"])
                        ? (section["examples"] as string[])
                        : [];
                      return (
                        <div key={i} className="space-y-2">
                          <h3 className="font-semibold">{section["title"] as string}</h3>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {section["content"] as string}
                          </p>
                          {examples.length > 0 && (
                            <div className="rounded-md bg-muted/50 p-3">
                              <p className="text-xs font-medium">Examples</p>
                              <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
                                {examples.map((ex, j) => (
                                  <li key={j}>{ex}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      );
                    })}

                  </div>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Policy</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The policy and all its sections will be permanently
              removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deletePolicy.isPending}>
              {deletePolicy.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkspaceGuard>
  );
}

function PolicyTable({
  rows,
  onEdit,
  onDelete,
  onPreview,
  onTogglePublish,
  isDeleting,
  isTogglingPublish,
}: {
  rows: PolicyRow[];
  onEdit: (policy: PolicyRow) => void;
  onDelete: (id: string) => void;
  onPreview: (policy: PolicyRow) => void;
  onTogglePublish: (policy: PolicyRow, next: boolean) => void;
  isDeleting: boolean;
  isTogglingPublish: boolean;
}) {
  const columns: DataTableColumn<PolicyRow>[] = [
    { id: "title", header: "Title", cell: (row) => row.title },
    {
      id: "category",
      header: "Category",
      cell: (row) => CATEGORIES.find((c) => c.value === row.category)?.label ?? row.category,
    },
    { id: "slug", header: "Slug", cell: (row) => row.slug },
    {
      id: "status",
      header: "Status",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Switch
            checked={row.is_published}
            disabled={isTogglingPublish}
            onCheckedChange={(next) => onTogglePublish(row, next)}
            aria-label={row.is_published ? `Unpublish ${row.title}` : `Publish ${row.title}`}
          />
          <StatusBadge tone={row.is_published ? "active" : "suspended"}>
            {row.is_published ? "Published" : "Draft"}
          </StatusBadge>
        </div>
      ),
    },
    {
      id: "sections",
      header: "Sections",
      cell: (row) => <span className="text-numeric">{row.sections_count}</span>,
    },
    {
      id: "updated",
      header: "Updated",
      cell: (row) => new Date(row.last_updated).toLocaleDateString(),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      className: "w-32",
      cell: (row) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" className="size-8" onClick={() => onPreview(row)}>
            <Eye className="size-3.5" />
            <span className="sr-only">Preview</span>
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={() => onEdit(row)}>
            <Pencil className="size-3.5" />
            <span className="sr-only">Edit</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-destructive hover:text-destructive"
            onClick={() => onDelete(row.id)}
            disabled={isDeleting}
          >
            <Trash2 className="size-3.5" />
            <span className="sr-only">Delete</span>
          </Button>
        </div>
      ),
    },
  ];

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="size-5" />}
        title="No policies"
        description="Create your first policy to get started."
        action={
          <Button size="sm" onClick={() => onEdit({} as PolicyRow)}>
            <Plus className="mr-1.5 size-4" />
            Create policy
          </Button>
        }
      />
    );
  }

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      emptyTitle="No policies"
      emptyDescription="Create your first policy to get started."
      caption="Platform policies"
    />
  );
}
