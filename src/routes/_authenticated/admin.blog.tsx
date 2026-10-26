import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Bold,
  Eye,
  EyeOff,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Pencil,
  Plus,
  Quote,
  Search,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable, type DataTableColumn } from "@/components/patterns/data-table";
import { EmptyState, ErrorState, LoadingState } from "@/components/patterns/states";
import { StatusBadge, statusTone } from "@/components/patterns/status-badge";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import { MarkdownBody } from "@/components/blog/blog-body";
import { formatBlogDate } from "@/components/blog/blog-meta";
import {
  useAdminCreateBlogPost,
  useAdminDeleteBlogPost,
  useAdminUpdateBlogPost,
  useAllBlogPosts,
} from "@/hooks/use-blog";
import { builtInBlogSlugs } from "@/lib/blog";
import { estimateReadTime } from "@/lib/blog-content";

type BlogRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  category: string;
  author: string;
  read_time: string;
  content: string;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type FormState = {
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  author: string;
  readTime: string;
  content: string;
  published: boolean;
};

const EMPTY_FORM: FormState = {
  title: "",
  slug: "",
  excerpt: "",
  category: "How To",
  author: "TradeMall",
  readTime: "",
  content: "",
  published: false,
};

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function makeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 120);
}

/** Friendly checks up front, so admins never see a raw validation dump. */
function validate(form: FormState): string | null {
  if (form.title.trim().length < 2) return "Add a title.";
  if (form.slug.trim().length < 2) return "Add a URL slug (it fills in from the title).";
  if (!SLUG_PATTERN.test(form.slug.trim()))
    return "The slug may only contain lowercase letters, numbers and single hyphens.";
  if (builtInBlogSlugs.includes(form.slug.trim()))
    return "That slug is reserved by a built-in article. Choose a different one.";
  if (form.category.trim().length < 2) return "Add a category.";
  if (form.author.trim().length < 2) return "Add an author name.";
  if (form.content.trim().length < 20) return "The article needs at least 20 characters of content.";
  return null;
}

export const Route = createFileRoute("/_authenticated/admin/blog")({
  head: () => ({
    meta: [
      { title: "Blog Management — Platform Admin — TradeMall" },
      { name: "description", content: "Create, edit, publish and unpublish TradeMall blog posts." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminBlogPage,
});

function AdminBlogPage() {
  const posts = useAllBlogPosts();
  const createPost = useAdminCreateBlogPost();
  const updatePost = useAdminUpdateBlogPost();
  const deletePost = useAdminDeleteBlogPost();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BlogRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BlogRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [slugTouched, setSlugTouched] = useState(false);
  const [query, setQuery] = useState("");
  const editorRef = useRef<HTMLTextAreaElement>(null);

  const rows = useMemo<BlogRow[]>(() => (posts.data ?? []) as BlogRow[], [posts.data]);
  const publishedCount = rows.filter((row) => row.is_published).length;
  const visibleRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.title, row.slug, row.category, row.author].some((value) =>
        value.toLowerCase().includes(needle),
      ),
    );
  }, [rows, query]);

  const saving = createPost.isPending || updatePost.isPending;
  const autoReadTime = estimateReadTime(form.content);
  const wordCount = form.content.split(/\s+/).filter(Boolean).length;

  function patch(update: Partial<FormState>) {
    setForm((current) => ({ ...current, ...update }));
  }

  function startNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setSlugTouched(false);
    setOpen(true);
  }

  function startEdit(row: BlogRow) {
    setEditing(row);
    setForm({
      title: row.title,
      slug: row.slug,
      excerpt: row.excerpt ?? "",
      category: row.category,
      author: row.author,
      readTime: row.read_time,
      content: row.content,
      published: row.is_published,
    });
    setSlugTouched(true);
    setOpen(true);
  }

  function closeEditor() {
    setOpen(false);
    setEditing(null);
  }

  // ---- formatting toolbar (inserts Markdown at the cursor) -------------------
  function insertAround(before: string, after: string, placeholder: string) {
    const el = editorRef.current;
    if (!el) return;
    const start = el.selectionStart ?? form.content.length;
    const end = el.selectionEnd ?? form.content.length;
    const selected = form.content.slice(start, end) || placeholder;
    patch({ content: form.content.slice(0, start) + before + selected + after + form.content.slice(end) });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }

  function prefixLines(prefix: (index: number) => string, placeholder: string) {
    const el = editorRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? start;
    const lineStart = form.content.lastIndexOf("\n", start - 1) + 1;
    let lineEnd = form.content.indexOf("\n", end);
    if (lineEnd === -1) lineEnd = form.content.length;
    const block = form.content.slice(lineStart, lineEnd) || placeholder;
    const replaced = block
      .split("\n")
      .map((line, index) => prefix(index) + line)
      .join("\n");
    patch({ content: form.content.slice(0, lineStart) + replaced + form.content.slice(lineEnd) });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(lineStart, lineStart + replaced.length);
    });
  }

  const toolbar: { label: string; icon: typeof Bold; run: () => void }[] = [
    { label: "Heading", icon: Heading2, run: () => prefixLines(() => "## ", "Section heading") },
    { label: "Subheading", icon: Heading3, run: () => prefixLines(() => "### ", "Subheading") },
    { label: "Bold", icon: Bold, run: () => insertAround("**", "**", "bold text") },
    { label: "Italic", icon: Italic, run: () => insertAround("*", "*", "italic text") },
    { label: "Link", icon: Link2, run: () => insertAround("[", "](https://)", "link text") },
    { label: "Bulleted list", icon: List, run: () => prefixLines(() => "- ", "List item") },
    {
      label: "Numbered list",
      icon: ListOrdered,
      run: () => prefixLines((index) => `${index + 1}. `, "List item"),
    },
    { label: "Quote", icon: Quote, run: () => prefixLines(() => "> ", "Quoted text") },
  ];

  // ---- actions ---------------------------------------------------------------
  async function save() {
    const problem = validate(form);
    if (problem) {
      toast.error(problem);
      return;
    }
    const payload = {
      title: form.title.trim(),
      slug: form.slug.trim(),
      excerpt: form.excerpt.trim(),
      category: form.category.trim(),
      author: form.author.trim(),
      readTime: form.readTime.trim() || autoReadTime,
      content: form.content.trim(),
      isPublished: form.published,
    };
    try {
      if (editing) {
        await updatePost.mutateAsync({ blogPostId: editing.id, ...payload });
      } else {
        await createPost.mutateAsync(payload);
      }
      const slug = payload.slug;
      toast.success(form.published ? "Blog published." : "Blog saved as draft.", {
        ...(form.published
          ? { action: { label: "View", onClick: () => window.open(`/blog/${slug}`, "_blank") } }
          : {}),
      });
      closeEditor();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save blog.");
    }
  }

  async function toggle(row: BlogRow) {
    try {
      await updatePost.mutateAsync({ blogPostId: row.id, isPublished: !row.is_published });
      toast.success(row.is_published ? "Blog unpublished." : "Blog published.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update publish status.");
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    try {
      await deletePost.mutateAsync(deleteTarget.id);
      toast.success("Blog deleted.");
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete blog.");
    }
  }

  const columns: DataTableColumn<BlogRow>[] = [
    {
      id: "title",
      header: "Title",
      cell: (row) => (
        <div>
          <div className="font-medium">{row.title}</div>
          <div className="text-xs text-muted-foreground">/blog/{row.slug}</div>
        </div>
      ),
    },
    { id: "category", header: "Category", cell: (row) => row.category },
    { id: "author", header: "Author", cell: (row) => row.author },
    {
      id: "status",
      header: "Status",
      cell: (row) => (
        <StatusBadge tone={statusTone(row.is_published ? "active" : "draft")}>
          {row.is_published ? "Published" : "Draft"}
        </StatusBadge>
      ),
    },
    {
      id: "date",
      header: "Published",
      cell: (row) => (
        <span className="text-muted-foreground">
          {row.published_at ? formatBlogDate(row.published_at) : "—"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex items-center gap-1">
          {row.is_published && (
            <Button size="icon" variant="ghost" title="View live" asChild>
              <a href={`/blog/${row.slug}`} target="_blank" rel="noreferrer">
                <Eye className="size-4" />
              </a>
            </Button>
          )}
          <Button size="icon" variant="ghost" title="Edit" onClick={() => startEdit(row)}>
            <Pencil className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            title={row.is_published ? "Unpublish" : "Publish"}
            onClick={() => void toggle(row)}
            disabled={updatePost.isPending}
          >
            {row.is_published ? <EyeOff className="size-4" /> : <Send className="size-4" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            title="Delete"
            className="text-destructive"
            onClick={() => setDeleteTarget(row)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
    },
  ];

  if (posts.isLoading)
    return (
      <WorkspaceGuard workspace="admin">
        <LoadingState rows={5} label="Loading blogs" />
      </WorkspaceGuard>
    );
  if (posts.error)
    return (
      <WorkspaceGuard workspace="admin">
        <ErrorState
          title="Couldn't load blogs"
          message={posts.error.message}
          onRetry={() => void posts.refetch()}
        />
      </WorkspaceGuard>
    );

  return (
    <WorkspaceGuard workspace="admin">
      <PageHeader
        eyebrow="Platform Admin"
        title="Blog Management"
        description={`Write, preview and publish articles to the public TradeMall blog. ${publishedCount} published · ${rows.length - publishedCount} draft${rows.length - publishedCount === 1 ? "" : "s"}.`}
        actions={
          <Button onClick={startNew}>
            <Plus className="mr-2 size-4" />
            New Blog Post
          </Button>
        }
      />

      <div className="mt-6 space-y-4">
        {rows.length > 0 && (
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title, slug, category or author"
              className="pl-9"
              aria-label="Search blog posts"
            />
          </div>
        )}
        {rows.length ? (
          <DataTable
            columns={columns}
            rows={visibleRows}
            rowKey={(row) => row.id}
            caption="TradeMall blog posts"
            emptyTitle="No matching posts"
            emptyDescription="Try a different search."
          />
        ) : (
          <EmptyState
            title="No blog posts yet"
            description="Create your first article to start publishing content."
          />
        )}
      </div>

      <Dialog open={open} onOpenChange={(value) => (value ? setOpen(true) : closeEditor())}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Blog Post" : "Create Blog Post"}</DialogTitle>
            <DialogDescription>
              Write the article, check the preview, then save it as a draft or publish it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="blog-title">Title</Label>
                <Input
                  id="blog-title"
                  value={form.title}
                  onChange={(e) => {
                    const title = e.target.value;
                    patch({ title, ...(editing || slugTouched ? {} : { slug: makeSlug(title) }) });
                  }}
                  placeholder="How to..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="blog-slug">URL slug</Label>
                <Input
                  id="blog-slug"
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    patch({ slug: makeSlug(e.target.value) });
                  }}
                  placeholder="how-to-example"
                  disabled={Boolean(editing)}
                />
                <p className="text-xs text-muted-foreground">
                  {editing ? "The URL can't change after creation." : `Public link: /blog/${form.slug || "your-slug"}`}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="blog-category">Category</Label>
                <Input id="blog-category" value={form.category} onChange={(e) => patch({ category: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="blog-author">Author</Label>
                <Input id="blog-author" value={form.author} onChange={(e) => patch({ author: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="blog-readtime">Read time</Label>
                <Input
                  id="blog-readtime"
                  value={form.readTime}
                  onChange={(e) => patch({ readTime: e.target.value })}
                  placeholder={`Auto: ${autoReadTime}`}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="blog-excerpt">Short summary (optional)</Label>
              <Textarea
                id="blog-excerpt"
                value={form.excerpt}
                onChange={(e) => patch({ excerpt: e.target.value })}
                rows={2}
                placeholder="Shown under the title and used for search results. Leave blank to use the opening paragraph."
              />
            </div>

            <Tabs defaultValue="write">
              <div className="flex items-center justify-between gap-3">
                <Label>Article content</Label>
                <TabsList>
                  <TabsTrigger value="write">Write</TabsTrigger>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="write" className="mt-3 space-y-2">
                <div className="flex flex-wrap gap-1 rounded-md border bg-muted/40 p-1">
                  {toolbar.map(({ label, icon: Icon, run }) => (
                    <Button
                      key={label}
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      title={label}
                      aria-label={label}
                      onClick={run}
                    >
                      <Icon className="size-4" />
                    </Button>
                  ))}
                </div>
                <Textarea
                  ref={editorRef}
                  value={form.content}
                  onChange={(e) => patch({ content: e.target.value })}
                  rows={18}
                  className="font-mono text-sm"
                  placeholder={"Write the full article here.\n\n## Use ## for a section heading\n\nSeparate paragraphs with a blank line. Use **bold**, *italic*, [links](https://example.com) and lists:\n\n- first point\n- second point"}
                />
                <p className="text-xs text-muted-foreground">
                  {wordCount} words · about {autoReadTime}. Use the toolbar or type Markdown; the Preview tab shows exactly what readers will see.
                </p>
              </TabsContent>

              <TabsContent value="preview" className="mt-3">
                <div className="min-h-[24rem] rounded-lg border bg-card p-6 sm:p-8">
                  <h2 className="text-3xl font-semibold tracking-tight">{form.title || "Untitled article"}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {form.category} · {form.readTime.trim() || autoReadTime} · By {form.author || "TradeMall"}
                  </p>
                  <div className="mt-6 border-t pt-2">
                    {form.content.trim() ? (
                      <MarkdownBody markdown={form.content} />
                    ) : (
                      <p className="mt-4 text-sm text-muted-foreground">Nothing to preview yet — write something first.</p>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex items-center gap-3 rounded-lg border p-4">
              <Switch checked={form.published} onCheckedChange={(published) => patch({ published })} id="blog-published" />
              <div>
                <Label htmlFor="blog-published" className="cursor-pointer">
                  {form.published ? "Published — visible on the public blog" : "Draft — not visible to the public"}
                </Label>
                <p className="text-xs text-muted-foreground">Only published posts appear on the public blog.</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeEditor}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : form.published ? (editing ? "Save & Publish" : "Publish Blog") : "Save Draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(value) => !value && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete blog post?</DialogTitle>
            <DialogDescription>
              “{deleteTarget?.title}” will be permanently removed from the blog. This can't be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void remove()} disabled={deletePost.isPending}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkspaceGuard>
  );
}
