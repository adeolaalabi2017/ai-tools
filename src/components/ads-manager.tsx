"use client";

/* ------------------------------------------------------------------ */
/*  AdsManager — create, edit, activate, and track the small           */
/*  sponsored cards shown on the public site (browse / blog / wanted). */
/*  Small cards only: headline ≤60, body ≤120, one CTA link.           */
/* ------------------------------------------------------------------ */

import { useMemo, useState } from "react";
import {
  EyeIcon,
  EyeOffIcon,
  Loader2Icon,
  MegaphoneIcon,
  MousePointerClickIcon,
  PenLineIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  createAd,
  deleteAd,
  fetchAllAds,
  updateAd,
  type AdPlacement,
  type ApiAd,
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

const PLACEMENTS: { value: AdPlacement; label: string; hint: string }[] = [
  { value: "browse", label: "Newest projects", hint: "between tool cards" },
  { value: "blog", label: "Blog", hint: "above the footer CTA" },
  { value: "wanted", label: "Wanted board", hint: "below the board" },
];

const PLACEMENT_LABEL: Record<string, string> = {
  browse: "Catalog",
  blog: "Blog",
  wanted: "Wanted board",
};

type FormState = {
  name: string;
  headline: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  imageUrl: string;
  emoji: string;
  placement: AdPlacement;
  weight: number;
  active: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  headline: "",
  body: "",
  ctaLabel: "Learn more",
  ctaUrl: "",
  imageUrl: "",
  emoji: "✨",
  placement: "browse",
  weight: 1,
  active: false,
};

function ctr(ad: ApiAd): string {
  return ad.impressions > 0 ? `${((ad.clicks / ad.impressions) * 100).toFixed(1)}%` : "—";
}

export function AdsManager({ className }: { className?: string }) {
  const queryClient = useQueryClient();
  const adsQuery = useQuery({
    queryKey: ["ads", "all"],
    queryFn: fetchAllAds,
    staleTime: 10_000,
  });
  const ads = useMemo(() => adsQuery.data?.ads ?? [], [adsQuery.data]);
  const activeCount = ads.filter((a) => a.active).length;
  const impressions = ads.reduce((acc, a) => acc + a.impressions, 0);
  const clicks = ads.reduce((acc, a) => acc + a.clicks, 0);

  const [editing, setEditing] = useState<{ ad: ApiAd | null } | null>(null); // null ad = new
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);
  const [armedDelete, setArmedDelete] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const openNew = () => {
    setForm(EMPTY_FORM);
    setError(null);
    setEditing({ ad: null });
  };
  const openEdit = (a: ApiAd) => {
    setForm({
      name: a.name,
      headline: a.headline,
      body: a.body,
      ctaLabel: a.ctaLabel,
      ctaUrl: a.ctaUrl,
      imageUrl: a.imageUrl ?? "",
      emoji: a.emoji,
      placement: a.placement as AdPlacement,
      weight: a.weight,
      active: a.active,
    });
    setError(null);
    setEditing({ ad: a });
  };

  const save = async () => {
    if (busy || !editing) return;
    setBusy(true);
    setError(null);
    const payload = {
      name: form.name,
      headline: form.headline,
      body: form.body,
      ctaLabel: form.ctaLabel,
      ctaUrl: form.ctaUrl,
      imageUrl: form.imageUrl.trim() || null,
      emoji: form.emoji,
      placement: form.placement,
      weight: form.weight,
      active: form.active,
    };
    try {
      if (editing.ad) await updateAd(editing.ad.id, payload);
      else await createAd(payload);
      await queryClient.invalidateQueries({ queryKey: ["ads"] });
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
      setError(first ?? "Couldn't save the ad. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (a: ApiAd) => {
    if (rowBusyId) return;
    setRowBusyId(a.id);
    try {
      await updateAd(a.id, { active: !a.active });
      await queryClient.invalidateQueries({ queryKey: ["ads"] });
    } catch {
      /* leave the row as-is on failure */
    } finally {
      setRowBusyId(null);
    }
  };

  const remove = async (a: ApiAd) => {
    if (armedDelete !== a.id) {
      setArmedDelete(a.id);
      return;
    }
    setArmedDelete(null);
    if (rowBusyId) return;
    setRowBusyId(a.id);
    try {
      await deleteAd(a.id);
      await queryClient.invalidateQueries({ queryKey: ["ads"] });
    } catch {
      /* keep the row on failure */
    } finally {
      setRowBusyId(null);
    }
  };

  const httpUrl = /^https?:\/\/\S+$/i.test(form.ctaUrl.trim());
  const canSave =
    form.name.trim().length >= 2 &&
    form.headline.trim().length >= 2 &&
    form.body.trim().length >= 2 &&
    form.ctaLabel.trim().length >= 1 &&
    httpUrl;

  return (
    <Card className={cn("gap-0 shadow-none dark:ring-0", className)}>
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MegaphoneIcon className="size-4 text-accent" />
              Ad management
            </CardTitle>
            <CardDescription>
              {ads.length > 0
                ? `${activeCount} active of ${ads.length} · ${impressions.toLocaleString("en-US")} impressions · ${clicks.toLocaleString("en-US")} clicks · ${impressions > 0 ? `${((clicks / impressions) * 100).toFixed(1)}%` : "—"} CTR`
                : "Small sponsored cards — never banners, never popups"}
            </CardDescription>
          </div>
          <Button
            className="h-8 bg-primary px-2.5 text-primary-foreground hover:bg-primary/90"
            onClick={openNew}
            size="sm"
          >
            <PlusIcon className="size-3.5" />
            New ad
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {adsQuery.isLoading ? (
          <div className="grid place-items-center px-6 py-14">
            <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : ads.length === 0 ? (
          <div className="grid place-items-center px-6 py-14 text-center">
            <p className="text-sm text-muted-foreground">No ads yet.</p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Create one — it stays a small card and only shows where you place it.
            </p>
          </div>
        ) : (
          <div className="thin-scroll max-h-[62vh] overflow-auto">
            <Table className="min-w-[860px]">
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Ad</TableHead>
                  <TableHead>Placement</TableHead>
                  <TableHead className="hidden lg:table-cell">Weight</TableHead>
                  <TableHead className="text-right">
                    <span className="inline-flex items-center gap-1">
                      <MousePointerClickIcon className="size-3" />
                      Stats
                    </span>
                  </TableHead>
                  <TableHead className="text-right">Status</TableHead>
                  <TableHead className="pr-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ads.map((a) => (
                  <TableRow className="h-14" key={a.id}>
                    <TableCell className="max-w-80 pl-6">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span
                          aria-hidden
                          className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-muted/40"
                        >
                          {a.imageUrl ? (
                             
                            <img src={a.imageUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-sm leading-none">{a.emoji || "✨"}</span>
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-sm">{a.headline}</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {a.body} · <span className="font-mono">{a.ctaUrl}</span>
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{PLACEMENT_LABEL[a.placement] ?? a.placement}</Badge>
                    </TableCell>
                    <TableCell className="hidden font-mono text-sm text-muted-foreground lg:table-cell">
                      ×{a.weight}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {a.impressions.toLocaleString("en-US")} imp · {a.clicks.toLocaleString("en-US")} clk
                      <span className="ml-1 text-foreground/70">({ctr(a)})</span>
                    </TableCell>
                    <TableCell className="text-right">
                      {a.active ? (
                        <Badge className="border-primary/40 bg-accent-soft text-accent" variant="outline">
                          Live
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Paused</Badge>
                      )}
                    </TableCell>
                    <TableCell className="pr-6">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          aria-label={a.active ? `Pause ${a.name}` : `Activate ${a.name}`}
                          className={cn(
                            "size-8",
                            a.active && "border-primary/40 bg-accent-soft text-accent hover:bg-accent-soft",
                          )}
                          disabled={rowBusyId === a.id}
                          onClick={() => void toggleActive(a)}
                          size="icon"
                          variant="outline"
                        >
                          {rowBusyId === a.id ? (
                            <Loader2Icon className="size-3.5 animate-spin" />
                          ) : a.active ? (
                            <EyeIcon className="size-3.5" />
                          ) : (
                            <EyeOffIcon className="size-3.5" />
                          )}
                        </Button>
                        <Button
                          aria-label={`Edit ${a.name}`}
                          className="size-8 text-muted-foreground hover:text-foreground"
                          disabled={rowBusyId === a.id}
                          onClick={() => openEdit(a)}
                          size="icon"
                          variant="ghost"
                        >
                          <PenLineIcon className="size-3.5" />
                        </Button>
                        <Button
                          aria-label={
                            armedDelete === a.id ? `Confirm delete ${a.name}` : `Delete ${a.name}`
                          }
                          className={cn(
                            "size-8",
                            armedDelete === a.id
                              ? "text-destructive hover:text-destructive"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                          disabled={rowBusyId === a.id}
                          onBlur={() => setArmedDelete((x) => (x === a.id ? null : x))}
                          onClick={() => void remove(a)}
                          size="icon"
                          variant="ghost"
                        >
                          {rowBusyId === a.id ? (
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
      <Dialog onOpenChange={(o) => !o && !busy && setEditing(null)} open={editing !== null}>
        <DialogContent className="flex max-h-[88vh] flex-col overflow-hidden sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing?.ad ? "Edit ad" : "New ad"}</DialogTitle>
            <DialogDescription>
              Small cards only — one headline, one line of copy, one CTA. Nothing intrusive.
            </DialogDescription>
          </DialogHeader>

          <div className="thin-scroll -mx-1 flex-1 space-y-4 overflow-y-auto px-1 pr-3">
            {/* live preview */}
            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Preview
              </p>
              <div className="mt-2 flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                <span
                  aria-hidden
                  className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-muted/40"
                >
                  {form.imageUrl.trim() && /^https?:\/\/\S+$/i.test(form.imageUrl.trim()) ? (
                     
                    <img src={form.imageUrl.trim()} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-lg leading-none">{form.emoji || "✨"}</span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[13px] font-semibold">
                      {form.headline || "Your headline"}
                    </p>
                    <span className="shrink-0 rounded border border-border px-1 py-px font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                      Sponsored
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {form.body || "One line of copy that doesn't get in the way."}
                  </p>
                </div>
                <span className="shrink-0 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  {form.ctaLabel || "CTA"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ad-name">Internal label</Label>
                <Input
                  id="ad-name"
                  maxLength={60}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Acme Cloud — spring"
                  value={form.name}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ad-headline">Headline</Label>
                <Input
                  id="ad-headline"
                  maxLength={60}
                  onChange={(e) => set("headline", e.target.value)}
                  placeholder="Ship AI features this week"
                  value={form.headline}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ad-body">Body</Label>
              <Textarea
                id="ad-body"
                maxLength={120}
                onChange={(e) => set("body", e.target.value)}
                placeholder="One sentence that stays out of the reader's way."
                rows={2}
                value={form.body}
              />
              <p className="text-right font-mono text-[10px] text-muted-foreground">
                {form.body.length}/120
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ad-cta-label">CTA label</Label>
                <Input
                  id="ad-cta-label"
                  maxLength={24}
                  onChange={(e) => set("ctaLabel", e.target.value)}
                  value={form.ctaLabel}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ad-cta-url">CTA URL</Label>
                <Input
                  id="ad-cta-url"
                  onChange={(e) => set("ctaUrl", e.target.value)}
                  placeholder="https://example.com"
                  type="url"
                  value={form.ctaUrl}
                />
                {form.ctaUrl.trim() && !httpUrl && (
                  <p className="text-xs text-amber-500">Enter a full http(s) URL.</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="ad-emoji">Fallback emoji</Label>
                <Input
                  id="ad-emoji"
                  maxLength={8}
                  onChange={(e) => set("emoji", e.target.value)}
                  value={form.emoji}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ad-image">Image URL (optional)</Label>
                <Input
                  id="ad-image"
                  onChange={(e) => set("imageUrl", e.target.value)}
                  placeholder="https://…/mark.png"
                  type="url"
                  value={form.imageUrl}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ad-weight">Rotation weight (1–10)</Label>
                <Input
                  id="ad-weight"
                  max={10}
                  min={1}
                  onChange={(e) => set("weight", Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
                  type="number"
                  value={form.weight}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Placement</Label>
                <Select onValueChange={(v) => set("placement", v as AdPlacement)} value={form.placement}>
                  <SelectTrigger id="ad-placement" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLACEMENTS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label} — {p.hint}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>First status</Label>
                <button
                  aria-pressed={form.active}
                  className={cn(
                    "flex h-9 w-full items-center gap-2 rounded-md border px-3 text-xs transition-colors",
                    form.active
                      ? "border-primary/40 bg-accent-soft text-accent"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setForm((f) => ({ ...f, active: !f.active }))}
                  type="button"
                >
                  {form.active ? <EyeIcon className="size-3.5" /> : <EyeOffIcon className="size-3.5" />}
                  {form.active ? "Live immediately" : "Save paused"}
                </button>
              </div>
            </div>
            {error && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            {editing?.ad && (
              <p className="font-mono text-[10px] text-muted-foreground">
                created {fmtDateShort(editing.ad.createdAt)} · {editing.ad.impressions.toLocaleString("en-US")} impressions
                · {editing.ad.clicks.toLocaleString("en-US")} clicks
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t pt-4">
            <Button disabled={busy} onClick={() => setEditing(null)} variant="outline">
              Cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={busy || !canSave}
              onClick={() => void save()}
            >
              {busy && <Loader2Icon className="size-3.5 animate-spin" />}
              {editing?.ad ? "Save changes" : "Create ad"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
