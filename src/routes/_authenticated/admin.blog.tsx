import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Pencil, Trash2, Eye, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable, type DataTableColumn } from "@/components/patterns/data-table";
import { EmptyState, ErrorState, LoadingState } from "@/components/patterns/states";
import { StatusBadge, statusTone } from "@/components/patterns/status-badge";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import { useAdminCreateBlogPost, useAdminDeleteBlogPost, useAdminUpdateBlogPost, useAllBlogPosts } from "@/hooks/use-blog";

type BlogRow = {
  id: string;
  slug: string;
  title: string;
  category: string;
  author: string;
  read_time: string;
  is_published: boolean;
  published_at: string | null;
};

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
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [category, setCategory] = useState("How To");
  const [author, setAuthor] = useState("TradeMall");
  const [readTime, setReadTime] = useState("5 min read");
  const [content, setContent] = useState("");
  const [published, setPublished] = useState(false);

  const rows = useMemo<BlogRow[]>(
    () => (posts.data ?? []) as BlogRow[],
    [posts.data],
  );

  function reset() {
    setEditing(null);
    setTitle("");
    setSlug("");
    setExcerpt("");
    setCategory("How To");
    setAuthor("TradeMall");
    setReadTime("5 min read");
    setContent("");
    setPublished(false);
  }

  function edit(row: BlogRow) {
    const full = posts.data?.find((post) => post.id === row.id);
    if (!full) return;
    setEditing(row);
    setTitle(full.title);
    setSlug(full.slug);
    setExcerpt(full.excerpt ?? "");
    setCategory(full.category);
    setAuthor(full.author);
    setReadTime(full.read_time);
    setContent(full.content);
    setPublished(full.is_published);
    setOpen(true);
  }

  function makeSlug(value: string) {
    return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  async function save() {
    if (!title.trim() || !slug.trim() || !content.trim()) {
      toast.error("Title, slug and content are required.");
      return;
    }
    try {
      if (editing) {
        await updatePost.mutateAsync({
          blogPostId: editing.id,
          title: title.trim(),
          slug: slug.trim(),
          excerpt: excerpt.trim(),
          category: category.trim(),
          author: author.trim(),
          readTime: readTime.trim(),
          content: content.trim(),
          isPublished: published,
        });
        toast.success(published ? "Blog published." : "Blog saved as draft.");
      } else {
        await createPost.mutateAsync({
          title: title.trim(),
          slug: slug.trim(),
          excerpt: excerpt.trim(),
          category: category.trim(),
          author: author.trim(),
          readTime: readTime.trim(),
          content: content.trim(),
          isPublished: published,
        });
        toast.success(published ? "Blog published." : "Blog saved as draft.");
      }
      setOpen(false);
      reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save blog.");
    }
  }

  async function toggle(row: BlogRow) {
    try {
      await updatePost.mutateAsync({ blogPostId: row.id, isPublished: !row.is_published });
      toast.success(row.is_published ? "Blog unpublished." : "Blog published.");
    } catch {
      toast.error("Failed to update publish status.");
    }
  }

  async function remove() {
    if (!deleteId) return;
    try {
      await deletePost.mutateAsync(deleteId);
      toast.success("Blog deleted.");
      setDeleteId(null);
    } catch {
      toast.error("Failed to delete blog.");
    }
  }

  const columns: DataTableColumn<BlogRow>[] = [
    { key: "title", header: "Title", cell: (row) => <div><div className="font-medium">{row.title}</div><div className="text-xs text-muted-foreground">/blog/{row.slug}</div></div> },
    { key: "category", header: "Category" },
    { key: "author", header: "Author" },
    { key: "status", header: "Status", cell: (row) => <StatusBadge tone={statusTone(row.is_published ? "active" : "draft")}>{row.is_published ? "Published" : "Draft"}</StatusBadge> },
    { key: "actions", header: "Actions", cell: (row) => (
      <div className="flex items-center gap-1">
        {row.is_published && <Button size="icon" variant="ghost" title="View" asChild><a href={`/blog/${row.slug}`} target="_blank" rel="noreferrer"><Eye className="size-4" /></a></Button>}
        <Button size="icon" variant="ghost" title="Edit" onClick={() => edit(row)}><Pencil className="size-4" /></Button>
        <Button size="icon" variant="ghost" title={row.is_published ? "Unpublish" : "Publish"} onClick={() => void toggle(row)}><ExternalLink className="size-4" /></Button>
        <Button size="icon" variant="ghost" title="Delete" className="text-destructive" onClick={() => setDeleteId(row.id)}><Trash2 className="size-4" /></Button>
      </div>
    )},
  ];

  if (posts.isLoading) return <WorkspaceGuard workspace="admin"><LoadingState rows={5} label="Loading blogs" /></WorkspaceGuard>;
  if (posts.error) return <WorkspaceGuard workspace="admin"><ErrorState title="Couldn't load blogs" message={posts.error.message} onRetry={() => void posts.refetch()} /></WorkspaceGuard>;

  return (
    <WorkspaceGuard workspace="admin">
      <PageHeader
        eyebrow="Platform Admin"
        title="Blog Management"
        description="Create how-to articles, save drafts, and publish them to the public TradeMall blog."
        actions={<Button onClick={() => { reset(); setOpen(true); }}><Plus className="mr-2 size-4" />New Blog Post</Button>}
      />

      <div className="mt-6">
        {rows.length ? <DataTable columns={columns} data={rows} /> : <EmptyState title="No blog posts yet" description="Create your first article to start publishing content." />}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Blog Post" : "Create Blog Post"}</DialogTitle>
            <DialogDescription>Write the article, save it as a draft, or publish it immediately.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Title</Label><Input value={title} onChange={(e) => { setTitle(e.target.value); if (!editing && !slug) setSlug(makeSlug(e.target.value)); }} placeholder="How to..." /></div>
              <div className="space-y-2"><Label>Slug</Label><Input value={slug} onChange={(e) => setSlug(makeSlug(e.target.value))} placeholder="how-to-example" disabled={Boolean(editing)} /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2"><Label>Category</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} /></div>
              <div className="space-y-2"><Label>Author</Label><Input value={author} onChange={(e) => setAuthor(e.target.value)} /></div>
              <div className="space-y-2"><Label>Read time</Label><Input value={readTime} onChange={(e) => setReadTime(e.target.value)} placeholder="7 min read" /></div>
            </div>
            <div className="space-y-2"><Label>Excerpt</Label><Textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={3} placeholder="Short summary shown on the blog listing..." /></div>
            <div className="space-y-2">
              <Label>Article content</Label>
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={18} className="font-mono text-sm" placeholder={"Write the full article here. Separate paragraphs with a blank line.\n\nYou can use simple headings by putting a heading on its own line."} />
              <p className="text-xs text-muted-foreground">Use blank lines between paragraphs. The public article page formats the content automatically.</p>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-4">
              <Switch checked={published} onCheckedChange={setPublished} id="blog-published" />
              <div><Label htmlFor="blog-published" className="cursor-pointer">{published ? "Publish immediately" : "Save as draft"}</Label><p className="text-xs text-muted-foreground">Only published posts appear on the public blog.</p></div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => void save()} disabled={createPost.isPending || updatePost.isPending}>{published ? "Publish Blog" : "Save Draft"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteId)} onOpenChange={(value) => !value && setDeleteId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Delete blog post?</DialogTitle><DialogDescription>This permanently removes the article from the blog.</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button><Button variant="destructive" onClick={() => void remove()} disabled={deletePost.isPending}>Delete</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkspaceGuard>
  );
}
