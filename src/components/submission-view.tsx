"use client";

/* ------------------------------------------------------------------ */
/*  SubmissionDialog — the full, filled submission for one pending     */
/*  tool: every field the submitter entered plus branding images,      */
/*  with the same approve / feature / remove actions as the queue.     */
/* ------------------------------------------------------------------ */

import {
  CheckIcon,
  ExternalLinkIcon,
  Loader2Icon,
  ServerIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { ApiTool } from "@/lib/aitools/api";
import { PLATFORM_LABEL, type Platform } from "@/lib/aitools/data";
import { catLabel, fmtDateShort, fmtRelative } from "@/components/admin-format";
import { AppIcon, CategoryIcon } from "@/components/aitools/ui";
import { apiToolToTool } from "@/components/aitools/tools-provider";

type ReviewAction = "approve" | "reject";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 text-sm text-foreground/90">{children}</div>
    </div>
  );
}

function ImagePreview({ label, src, tall }: { label: string; src: string; tall?: boolean }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-1.5 overflow-hidden rounded-lg border border-border bg-muted/40">
        { }
        <img
          src={src}
          alt={`${label} submitted for this tool`}
          className={cn("w-full object-cover", tall ? "h-40" : "h-24")}
        />
      </div>
      <a
        className="mt-1 inline-flex max-w-full items-center gap-1 truncate font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground"
        href={src}
        onClick={(e) => e.stopPropagation()}
        target="_blank"
        rel="noreferrer"
      >
        <ExternalLinkIcon className="size-3 shrink-0" />
        {src}
      </a>
    </div>
  );
}

export function SubmissionDialog({
  tool,
  busy,
  featureDraft,
  onToggleFeatureDraft,
  onApprove,
  onRemove,
  onClose,
}: {
  tool: ApiTool | null;
  busy: { id: string; action: ReviewAction } | null;
  featureDraft: boolean;
  onToggleFeatureDraft: () => void;
  onApprove: (id: string, featured: boolean) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}) {
  const rowBusy = tool && busy?.id === tool.id ? busy.action : null;
  const iconTool = tool ? apiToolToTool(tool) : null;

  return (
    <Dialog onOpenChange={(o) => !o && !rowBusy && onClose()} open={tool !== null}>
      <DialogContent className="flex max-h-[88vh] flex-col overflow-hidden sm:max-w-2xl">
        {tool && iconTool && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <AppIcon tool={iconTool} size="lg" />
                <span className="min-w-0">
                  <span className="block truncate">{tool.name}</span>
                  <a
                    className="mt-0.5 flex items-center gap-1 font-mono text-[11px] font-normal text-muted-foreground transition-colors hover:text-foreground"
                    href={`https://github.com/${tool.repo}`}
                    onClick={(e) => e.stopPropagation()}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {tool.repo}
                    <ExternalLinkIcon className="size-3 shrink-0" />
                  </a>
                </span>
                <Badge className="ml-auto" variant="secondary">
                  In queue
                </Badge>
              </DialogTitle>
              <DialogDescription>
                Submitted {fmtRelative(tool.createdAt)} ({fmtDateShort(tool.createdAt)}) by{" "}
                {tool.submitter ?? "an anonymous visitor"}.
              </DialogDescription>
            </DialogHeader>

            <div className="thin-scroll -mx-1 flex-1 space-y-5 overflow-y-auto px-1 pr-3">
              <Field label="Description">{tool.desc}</Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Alternative to">{tool.replaces}</Field>
                <Field label="Category">
                  <span className="inline-flex items-center gap-1.5">
                    <CategoryIcon id={tool.cat} className="size-3.5" />
                    {catLabel(tool.cat)}
                  </span>
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Platforms">
                  <span className="flex flex-wrap gap-1.5">
                    {tool.platforms.map((p) => (
                      <Badge key={p} variant="outline">
                        {PLATFORM_LABEL[p as Platform] ?? p}
                      </Badge>
                    ))}
                  </span>
                </Field>
                <Field label="Flags">
                  <span className="flex flex-wrap gap-1.5">
                    <Badge variant="outline">Open source</Badge>
                    {tool.selfHosted && (
                      <Badge className="border-primary/40 bg-accent-soft text-accent" variant="outline">
                        <ServerIcon className="size-3" />
                        Self-hostable
                      </Badge>
                    )}
                    {tool.sourceAvailable && (
                      <Badge className="border-amber-500/25 bg-amber-500/10 text-amber-500" variant="outline">
                        Source-available
                      </Badge>
                    )}
                  </span>
                </Field>
              </div>

              {(tool.logoUrl || tool.screenshotUrl || tool.headerUrl) && (
                <>
                  <Separator />
                  <div className="grid grid-cols-1 gap-4">
                    {tool.logoUrl && <ImagePreview label="Logo" src={tool.logoUrl} />}
                    {tool.screenshotUrl && (
                      <ImagePreview label="Screenshot" src={tool.screenshotUrl} tall />
                    )}
                    {tool.headerUrl && <ImagePreview label="Header image" src={tool.headerUrl} tall />}
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
              <Button
                aria-label={
                  featureDraft
                    ? `Don't feature ${tool.name} on approval`
                    : `Also feature ${tool.name} on approval`
                }
                aria-pressed={featureDraft}
                className={cn(
                  featureDraft && "border-primary/40 bg-accent-soft text-accent hover:bg-accent-soft",
                )}
                disabled={rowBusy !== null}
                onClick={onToggleFeatureDraft}
                size="sm"
                variant="outline"
              >
                <StarIcon className={cn("size-3.5", featureDraft && "fill-current")} />
                {featureDraft ? "Will feature on approval" : "Feature on approval"}
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  aria-label={`Remove ${tool.name}`}
                  className="text-muted-foreground hover:text-foreground"
                  disabled={rowBusy !== null}
                  onClick={() => onRemove(tool.id)}
                  size="sm"
                  variant="ghost"
                >
                  {rowBusy === "reject" ? (
                    <Loader2Icon className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2Icon className="size-3.5" />
                  )}
                  Remove
                </Button>
                <Button
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={rowBusy !== null}
                  onClick={() => onApprove(tool.id, featureDraft)}
                  size="sm"
                >
                  {rowBusy === "approve" ? (
                    <Loader2Icon className="size-3.5 animate-spin" />
                  ) : (
                    <CheckIcon className="size-3.5" />
                  )}
                  {rowBusy === "approve"
                    ? "Approving…"
                    : featureDraft
                      ? "Approve & feature"
                      : "Approve"}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
