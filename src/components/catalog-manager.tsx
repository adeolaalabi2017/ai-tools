"use client";

/* ------------------------------------------------------------------ */
/*  CatalogManager — manage every tool in the directory: search,       */
/*  category reassignment, featured toggle, and a metadata editor      */
/*  (desc / replaces / platforms / self-hosted / source / emoji).      */
/* ------------------------------------------------------------------ */

import { useMemo, useState } from "react";
import { Loader2Icon, PenLineIcon, SearchIcon, ServerIcon, StarIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { featureTool, updateTool, type ApiTool } from "@/lib/aitools/api";
import { CATEGORIES, PLATFORM_LABEL, catLabel, fmtK, type Platform, type Tool } from "@/lib/aitools/data";
import { useTools } from "@/components/aitools/tools-provider";
import { AppIcon } from "@/components/aitools/ui";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const PLATFORMS = Object.keys(PLATFORM_LABEL) as Platform[];

export function CatalogManager({ className, ...props }: React.ComponentProps<typeof Card>) {
  const queryClient = useQueryClient();
  const { tools } = useTools();

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Tool | null>(null);
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* edit dialog form */
  const [desc, setDesc] = useState("");
  const [replaces, setReplaces] = useState("");
  const [cat, setCat] = useState("assistants");
  const [platforms, setPlatforms] = useState<Platform[]>(["web"]);
  const [selfHosted, setSelfHosted] = useState(false);
  const [sourceAvailable, setSourceAvailable] = useState(false);
  const [emoji, setEmoji] = useState("🧩");
  const [logoUrl, setLogoUrl] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [headerUrl, setHeaderUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return tools
      .filter((t) => (statusFilter === "all" ? true : t.status === statusFilter))
      .filter(
        (t) =>
          !needle ||
          t.name.toLowerCase().includes(needle) ||
          t.repo.toLowerCase().includes(needle) ||
          t.desc.toLowerCase().includes(needle),
      )
      .sort((a, b) => b.stars - a.stars);
  }, [tools, q, statusFilter]);

  const openEdit = (t: Tool) => {
    setError(null);
    setDesc(t.desc);
    setReplaces(t.replaces);
    setCat(t.cat);
    setPlatforms(t.platforms as Platform[]);
    setSelfHosted(Boolean(t.selfHosted));
    setSourceAvailable(Boolean(t.sourceAvailable));
    setEmoji(t.emoji);
    setLogoUrl(t.logoUrl ?? "");
    setScreenshotUrl(t.screenshotUrl ?? "");
    setHeaderUrl(t.headerUrl ?? "");
    setEditing(t);
  };

  /** Optimistic cache write shared by every mutation. */
  const patchCache = (id: string, patch: Partial<ApiTool>) => {
    queryClient.setQueryData(fetchToolsKey(), (old: ToolsPageLike | undefined) =>
      old
        ? { ...old, tools: old.tools.map((t) => (t.id === id ? { ...t, ...patch } : t)) }
        : old,
    );
  };

  const saveEdit = async () => {
    if (busy || !editing) return;
    setBusy(true);
    setError(null);
    try {
      const { tool } = await updateTool(editing.id, {
        desc,
        replaces,
        cat,
        platforms,
        selfHosted,
        sourceAvailable,
        emoji,
        logoUrl: logoUrl.trim(),
        screenshotUrl: screenshotUrl.trim(),
        headerUrl: headerUrl.trim(),
      });
      patchCache(editing.id, {
        desc: tool.desc,
        replaces: tool.replaces,
        cat: tool.cat,
        platforms: tool.platforms,
        selfHosted: tool.selfHosted,
        sourceAvailable: tool.sourceAvailable,
        emoji: tool.emoji,
        logoUrl: tool.logoUrl,
        screenshotUrl: tool.screenshotUrl,
        headerUrl: tool.headerUrl,
      });
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
      setError(first ?? "Couldn't save the tool. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const toggleFeatured = async (t: Tool) => {
    if (rowBusyId) return;
    setRowBusyId(t.id);
    const next = !t.featured;
    patchCache(t.id, { featured: next });
    try {
      await featureTool(t.id, next);
    } catch {
      patchCache(t.id, { featured: !next });
    } finally {
      setRowBusyId(null);
    }
  };

  const setCategory = async (t: Tool, nextCat: string) => {
    if (rowBusyId || nextCat === t.cat) return;
    setRowBusyId(t.id);
    const prev = t.cat;
    patchCache(t.id, { cat: nextCat });
    try {
      await updateTool(t.id, { cat: nextCat });
    } catch {
      patchCache(t.id, { cat: prev });
    } finally {
      setRowBusyId(null);
    }
  };

  return (
    <Card className={cn("gap-0 shadow-none md:col-span-2 dark:ring-0", className)} {...props}>
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Catalog</CardTitle>
            <CardDescription>
              {filtered.length} of {tools.length} tools · edit metadata, category, and the featured flag
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 items-center gap-2 rounded-lg border bg-background px-2.5">
              <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
              <input
                aria-label="Search tools in catalog"
                className="w-36 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search tools…"
                value={q}
              />
            </div>
            <Select onValueChange={setStatusFilter} value={statusFilter}>
              <SelectTrigger aria-label="Filter by status" className="h-8 w-[120px] text-xs" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem className="text-xs" value="all">All status</SelectItem>
                <SelectItem className="text-xs" value="curated">Curated</SelectItem>
                <SelectItem className="text-xs" value="community">Community</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="thin-scroll max-h-[62vh] overflow-auto">
          <Table className="min-w-[820px]">
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">Tool</TableHead>
                <TableHead className="hidden sm:table-cell">Stars</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="pr-6 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow className="h-14" key={t.id}>
                  <TableCell className="max-w-56 pl-6">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <AppIcon size="sm" tool={t} />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-sm">{t.name}</p>
                        <p className="truncate font-mono text-[11px] text-muted-foreground">{t.repo}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span className="font-mono text-sm text-muted-foreground">{fmtK(t.stars)}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={t.status === "curated" ? "secondary" : "outline"}>
                      {t.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Select
                      onValueChange={(v) => void setCategory(t, v)}
                      value={t.cat}
                      disabled={rowBusyId === t.id}
                    >
                      <SelectTrigger
                        aria-label={`Category for ${t.name}`}
                        className="h-8 w-[150px] text-xs"
                        size="sm"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        {CATEGORIES.map((c) => (
                          <SelectItem className="text-xs" key={c.id} value={c.id}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="pr-6">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        aria-label={
                          t.featured ? `Unfeature ${t.name}` : `Feature ${t.name}`
                        }
                        aria-pressed={Boolean(t.featured)}
                        className={cn(
                          "size-8",
                          t.featured && "border-primary/40 bg-accent-soft text-accent hover:bg-accent-soft",
                        )}
                        disabled={rowBusyId === t.id}
                        onClick={() => void toggleFeatured(t)}
                        size="icon"
                        variant="outline"
                      >
                        {rowBusyId === t.id ? (
                          <Loader2Icon className="size-3.5 animate-spin" />
                        ) : (
                          <StarIcon className={cn("size-3.5", t.featured && "fill-current")} />
                        )}
                      </Button>
                      <Button
                        aria-label={`Edit ${t.name}`}
                        className="size-8 text-muted-foreground hover:text-foreground"
                        onClick={() => openEdit(t)}
                        size="icon"
                        variant="ghost"
                      >
                        <PenLineIcon className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell className="py-10 text-center text-sm text-muted-foreground" colSpan={5}>
                    No tools match “{q}”.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* ------------------------------ edit dialog ------------------------------ */}
      <Dialog onOpenChange={(o) => !o && !busy && setEditing(null)} open={editing !== null}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editing && (
                <>
                  <span aria-hidden>{emoji}</span> Edit {editing.name}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              Name and repo are immutable — ids and links stay stable.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="tool-desc">Description</Label>
                <span className="font-mono text-[10px] text-muted-foreground">{desc.length}/200</span>
              </div>
              <Textarea
                id="tool-desc"
                maxLength={200}
                onChange={(e) => setDesc(e.target.value)}
                rows={2}
                value={desc}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tool-replaces">Replaces</Label>
                <Input
                  id="tool-replaces"
                  maxLength={80}
                  onChange={(e) => setReplaces(e.target.value)}
                  value={replaces}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tool-emoji">Emoji</Label>
                <Input
                  id="tool-emoji"
                  maxLength={8}
                  onChange={(e) => setEmoji(e.target.value)}
                  value={emoji}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Branding images</Label>
              <div className="grid gap-2">
                <Input
                  aria-label="Logo URL"
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="Logo URL — https://…/logo.png"
                  type="url"
                  value={logoUrl}
                />
                <Input
                  aria-label="Screenshot URL"
                  onChange={(e) => setScreenshotUrl(e.target.value)}
                  placeholder="Screenshot URL — https://…/screenshot.png"
                  type="url"
                  value={screenshotUrl}
                />
                <Input
                  aria-label="Header image URL"
                  onChange={(e) => setHeaderUrl(e.target.value)}
                  placeholder="Header image URL — https://…/banner.png"
                  type="url"
                  value={headerUrl}
                />
                <p className="text-[10px] text-muted-foreground">
                  Shown on the tool page: logo next to the title, screenshot in the frame, header as the banner.
                  Clear a field to remove that image.
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Platforms</Label>
              <div className="flex flex-wrap gap-1.5">
                {PLATFORMS.map((p) => {
                  const active = platforms.includes(p);
                  return (
                    <button
                      aria-pressed={active}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs transition-colors",
                        active
                          ? "border-primary/40 bg-accent-soft text-accent"
                          : "border-border text-muted-foreground hover:text-foreground",
                      )}
                      key={p}
                      onClick={() =>
                        setPlatforms((cur) =>
                          cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p],
                        )
                      }
                      type="button"
                    >
                      {PLATFORM_LABEL[p]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                aria-pressed={selfHosted}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors",
                  selfHosted
                    ? "border-primary/40 bg-accent-soft text-accent"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setSelfHosted((v) => !v)}
                type="button"
              >
                <ServerIcon className="size-3" />
                Self-hosted
              </button>
              <button
                aria-pressed={sourceAvailable}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors",
                  sourceAvailable
                    ? "border-amber-500/25 bg-amber-500/10 text-amber-500"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setSourceAvailable((v) => !v)}
                type="button"
              >
                Source-available
              </button>
            </div>
            {error && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            {editing && (
              <p className="font-mono text-[10px] text-muted-foreground">
                currently in {catLabel(editing.cat)} · {fmtK(editing.stars)} stars
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t pt-4">
            <Button disabled={busy} onClick={() => setEditing(null)} variant="outline">
              Cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={busy}
              onClick={() => void saveEdit()}
            >
              {busy && <Loader2Icon className="size-3.5 animate-spin" />}
              Save changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* the ["tools","all"] cache holds ToolsPage — keep a narrow local shape */
type ToolsPageLike = { tools: ApiTool[]; total: number; page: number; limit: number };
function fetchToolsKey(): readonly unknown[] {
  return ["tools", "all"];
}
