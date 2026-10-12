"use client";

/* ------------------------------------------------------------------ */
/*  BlogManager — CMS for the blog: list, create, edit, publish,       */
/*  delete posts. Content is markdown rendered by aitools/md.          */
/* ------------------------------------------------------------------ */

import { useMemo, useState } from "react";
import {
  EyeIcon,
  EyeOffIcon,
  Loader2Icon,
  PenLineIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  createPost,
  deletePost,
  fetchPosts,
  updatePost,
  type ApiPost,
} from "@/lib/aitools/api";
import { fmtDateShort } from "@/components/admin-format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { UploadButton } from "@/components/aitools/image-upload";

type FormState = {
  title: string;
  excerpt: string;
  content: string;
  author: string;
  tags: string; // comma separated in the form
  coverEmoji: string;
  coverUrl: string;
};

const EMPTY_FORM: FormState = {
  title: "",
  excerpt: "",
  content: "",
  author: "AIStore Editors",
  tags: "",
  coverEmoji: "📝",
  coverUrl: "",
};

function toForm(p: ApiPost): FormState {
  return {
    title: p.title,
    excerpt: p.excerpt,
    content: p.content,
    author: p.author,
    tags: p.tags.join(", "),
    coverEmoji: p.coverEmoji,
    coverUrl: p.coverUrl ?? "",
  };
}

export function BlogManager({ className, ...props }: React.ComponentProps<typeof Card>) {
  const queryClient = useQueryClient();

  const postsQuery = useQuery({
    queryKey: ["posts", "admin"],
    queryFn: () => fetchPosts({ all: true }),
  });
  const posts = useMemo(() => postsQuery.data?.posts ?? [], [postsQuery.data]);
  const publishedCount = posts.filter((p) => p.status === "published").length;

  /* editor dialog state */
  const [editing, setEditing] = useState<{ post: ApiPost | null } | null>(null); // null post = new
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [armedDelete, setArmedDelete] = useState<string | null>(null);
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);

  const openNew = () => {
    setForm(EMPTY_FORM);
    setError(null);
    setEditing({ post: null });
  };
  const openEdit = (p: ApiPost) => {
    setForm(toForm(p));
    setError(null);
    setEditing({ post: p });
  };

  const set = <K extends keyof FormState>(key: K, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  /** Split + trim the tags field for the API. */
  const tagsList = () =>
    form.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 6);

  const save = async (status: "draft" | "published") => {
    if (busy || !editing) return;
    setBusy(true);
    setError(null);
    const payload = {
      title: form.title,
      excerpt: form.excerpt,
      content: form.content,
      author: form.author,
      tags: tagsList(),
      coverEmoji: form.coverEmoji,
      coverUrl: form.coverUrl.trim() || null,
      status,
    };
    try {
      if (editing.post) {
        await updatePost(editing.post.id, payload);
      } else {
        await createPost(payload);
      }
      await queryClient.invalidateQueries({ queryKey: ["posts"] });
      setEditing(null);
    } catch (err) {
      const issues =
        err && typeof err === "object" && "issues" in err
          ? (err as { issues: unknown }).issues
          : null;
      const first =
        Array.isArray(issues) && issues.length > 0
          ? typeof issues[0] === "string"
            ? issues[0]
            : ((issues[0] as { message?: string })?.message ?? null)
          : null;
      setError(first ?? "Couldn't save the post. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const togglePublish = async (p: ApiPost) => {
    if (rowBusyId) return;
    setRowBusyId(p.id);
    try {
      await updatePost(p.id, { status: p.status === "published" ? "draft" : "published" });
      await queryClient.invalidateQueries({ queryKey: ["posts"] });
    } catch {
      /* row stays as-is; the admin sees the toggle not move */
    } finally {
      setRowBusyId(null);
    }
  };

  const remove = async (p: ApiPost) => {
    if (armedDelete !== p.id) {
      setArmedDelete(p.id);
      return;
    }
    setArmedDelete(null);
    if (rowBusyId) return;
    setRowBusyId(p.id);
    try {
      await deletePost(p.id);
      await queryClient.invalidateQueries({ queryKey: ["posts"] });
    } catch {
      /* keep the row on failure */
    } finally {
      setRowBusyId(null);
    }
  };

  return (
    <Card className={cn("gap-0 shadow-none md:col-span-2 dark:ring-0", className)} {...props}>
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Blog posts</CardTitle>
            <CardDescription>
              {posts.length > 0
                ? `${publishedCount} published · ${posts.length - publishedCount} draft${posts.length - publishedCount === 1 ? "" : "s"}`
                : "Editorial content for the public blog"}
            </CardDescription>
          </div>
          <Button
            className="h-8 bg-primary px-2.5 text-primary-foreground hover:bg-primary/90"
            onClick={openNew}
            size="sm"
          >
            <PlusIcon className="size-3.5" />
            New post
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {postsQuery.isLoading ? (
          <div className="grid place-items-center px-6 py-14">
            <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : posts.length === 0 ? (
          <div className="grid place-items-center px-6 py-14 text-center">
            <p className="text-sm text-muted-foreground">No posts yet.</p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Write the first one — it ships to the public blog instantly.
            </p>
          </div>
        ) : (
          <div className="thin-scroll max-h-[62vh] overflow-auto">
            <Table className="min-w-[760px]">
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Title</TableHead>
                  <TableHead className="hidden sm:table-cell">Tags</TableHead>
                  <TableHead className="hidden md:table-cell">Updated</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                  <TableHead className="pr-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((p) => (
                  <TableRow className="h-14" key={p.id}>
                    <TableCell className="max-w-64 pl-6">
                      <div className="flex min-w-0 items-center gap-2.5">
                        {p.coverUrl ? (
                          <img
                            src={p.coverUrl}
                            alt=""
                            className="h-9 w-9 shrink-0 rounded-md border border-border object-cover"
                          />
                        ) : (
                          <span aria-hidden className="text-lg select-none">
                            {p.coverEmoji}
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium text-sm">{p.title}</p>
                          <p className="truncate font-mono text-[11px] text-muted-foreground">
                            /{p.slug}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="truncate font-mono text-[11px] text-muted-foreground">
                        {p.tags.join(", ") || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground text-sm md:table-cell">
                      {fmtDateShort(p.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      {p.status === "published" ? (
                        <Badge className="border-primary/40 bg-accent-soft text-accent" variant="outline">
                          Published
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Draft</Badge>
                      )}
                    </TableCell>
                    <TableCell className="pr-6">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          aria-label={
                            p.status === "published"
                              ? `Unpublish ${p.title}`
                              : `Publish ${p.title}`
                          }
                          className={cn(
                            "size-8",
                            p.status === "published" &&
                              "border-primary/40 bg-accent-soft text-accent hover:bg-accent-soft",
                          )}
                          disabled={rowBusyId === p.id}
                          onClick={() => void togglePublish(p)}
                          size="icon"
                          variant="outline"
                        >
                          {rowBusyId === p.id ? (
                            <Loader2Icon className="size-3.5 animate-spin" />
                          ) : p.status === "published" ? (
                            <EyeIcon className="size-3.5" />
                          ) : (
                            <EyeOffIcon className="size-3.5" />
                          )}
                        </Button>
                        <Button
                          aria-label={`Edit ${p.title}`}
                          className="size-8 text-muted-foreground hover:text-foreground"
                          disabled={rowBusyId === p.id}
                          onClick={() => openEdit(p)}
                          size="icon"
                          variant="ghost"
                        >
                          <PenLineIcon className="size-3.5" />
                        </Button>
                        <Button
                          aria-label={
                            armedDelete === p.id
                              ? `Confirm delete ${p.title}`
                              : `Delete ${p.title}`
                          }
                          className={cn(
                            "size-8",
                            armedDelete === p.id
                              ? "text-destructive hover:text-destructive"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                          disabled={rowBusyId === p.id}
                          onBlur={() => setArmedDelete((a) => (a === p.id ? null : a))}
                          onClick={() => void remove(p)}
                          size="icon"
                          variant="ghost"
                        >
                          {rowBusyId === p.id ? (
                            <Loader2Icon className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2Icon className="size-3.5" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* ------------------------------- editor ------------------------------- */}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && !busy && setEditing(null)}>
        <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.post ? "Edit post" : "New post"}</DialogTitle>
            <DialogDescription>
              Markdown is supported: headings, lists, **bold**, *italic*, `code`, links, quotes.
            </DialogDescription>
          </DialogHeader>

          <div className="thin-scroll -mx-1 flex-1 space-y-4 overflow-y-auto px-1 pr-3">
            <div className="space-y-1.5">
              <Label htmlFor="post-title">Title</Label>
              <Input
                id="post-title"
                maxLength={120}
                onChange={(e) => set("title", e.target.value)}
                placeholder="How we pick featured tools"
                value={form.title}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="post-excerpt">Excerpt</Label>
              <Textarea
                id="post-excerpt"
                maxLength={280}
                onChange={(e) => set("excerpt", e.target.value)}
                placeholder="One or two sentences shown on cards."
                rows={2}
                value={form.excerpt}
              />
              <p className="text-right font-mono text-[10px] text-muted-foreground">
                {form.excerpt.length}/280
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="post-cover-url">Cover image</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="post-cover-url"
                  placeholder="https://…/cover.png or upload"
                  value={form.coverUrl}
                  onChange={(e) => set("coverUrl", e.target.value)}
                  className="min-w-0 flex-1"
                />
                <UploadButton
                  label="Upload"
                  className="h-9 shrink-0"
                  onUploaded={(url) => set("coverUrl", url)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="post-cover">Cover emoji</Label>
                <Input
                  id="post-cover"
                  maxLength={8}
                  onChange={(e) => set("coverEmoji", e.target.value)}
                  value={form.coverEmoji}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="post-author">Author</Label>
                <Input
                  id="post-author"
                  maxLength={80}
                  onChange={(e) => set("author", e.target.value)}
                  value={form.author}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="post-tags">Tags (comma separated)</Label>
                <Input
                  id="post-tags"
                  maxLength={160}
                  onChange={(e) => set("tags", e.target.value)}
                  placeholder="news, guide"
                  value={form.tags}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="post-content">Content (markdown)</Label>
              <Textarea
                className="min-h-[240px] font-mono text-[13px] leading-relaxed"
                id="post-content"
                onChange={(e) => set("content", e.target.value)}
                placeholder={"## Heading\n\nWrite the body here…"}
                value={form.content}
              />
              <p className="text-right font-mono text-[10px] text-muted-foreground">
                {form.content.trim().split(/\s+/).filter(Boolean).length} words
              </p>
            </div>
            {error && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t pt-4">
            <Button
              disabled={busy}
              onClick={() => void save("draft")}
              variant="outline"
            >
              {busy && <Loader2Icon className="size-3.5 animate-spin" />}
              Save draft
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={busy}
              onClick={() => void save("published")}
            >
              {busy ? <Loader2Icon className="size-3.5 animate-spin" /> : <EyeIcon className="size-3.5" />}
              {editing?.post?.status === "published" ? "Update & keep published" : "Publish"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
