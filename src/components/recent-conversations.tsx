"use client";

import { ArrowRightIcon, CheckIcon, EyeIcon, Loader2Icon, StarIcon, Trash2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ApiTool } from "@/lib/aitools/api";
import { catLabel, fmtDateShort } from "@/components/admin-format";
import { AppIcon, CategoryIcon } from "@/components/aitools/ui";
import { apiToolToTool } from "@/components/aitools/tools-provider";

type ReviewAction = "approve" | "reject";

/**
 * Moderation review queue — pending community submissions with inline actions.
 * Standalone module: wide table, every row opens the full submission.
 */
export function ReviewQueueTable({
  tools,
  busy,
  featureBusyId,
  featureDrafts,
  onToggleFeatureDraft,
  onApprove,
  onRemove,
  onView,
  className,
  ...props
}: ComponentProps<typeof Card> & {
  tools: ApiTool[];
  busy: { id: string; action: ReviewAction } | null;
  featureBusyId: string | null;
  /** Per-row "also feature on approval" draft flag */
  featureDrafts: Record<string, boolean>;
  onToggleFeatureDraft: (id: string) => void;
  onApprove: (id: string, featured: boolean) => void;
  onRemove: (id: string) => void;
  /** Open the full submission (all fields + images). */
  onView: (tool: ApiTool) => void;
}) {
  return (
    <Card
      className={cn("gap-0 shadow-none dark:ring-0", className)}
      {...props}
    >
      <CardHeader className="border-b">
        <CardTitle>Review queue</CardTitle>
        <CardDescription>
          {tools.length > 0
            ? `${tools.length} community ${tools.length === 1 ? "submission" : "submissions"} awaiting editorial review — open one to see the full submission`
            : "Community submissions appear here for review"}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {tools.length === 0 ? (
          <div className="grid place-items-center px-6 py-14 text-center">
            <p className="text-sm text-muted-foreground">Queue is clear.</p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Nothing pending — nice work.
            </p>
          </div>
        ) : (
          <div className="thin-scroll max-h-[62vh] overflow-auto">
            <Table className="min-w-[760px]">
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Tool</TableHead>
                  <TableHead className="hidden sm:table-cell">Category</TableHead>
                  <TableHead className="hidden md:table-cell">Description</TableHead>
                  <TableHead className="hidden md:table-cell">Submitted</TableHead>
                  <TableHead className="hidden lg:table-cell">By</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                  <TableHead className="pr-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tools.map((t) => {
                  const rowBusy = busy?.id === t.id ? busy.action : null;
                  const anyBusy = busy !== null;
                  const feature = featureDrafts[t.id] ?? false;
                  const tool = apiToolToTool(t);
                  return (
                    <TableRow className="h-14" key={t.id}>
                      <TableCell className="max-w-64 pl-6">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <AppIcon tool={tool} size="sm" />
                          <div className="min-w-0">
                            <button
                              className="block max-w-full truncate font-medium text-sm transition-colors hover:text-accent"
                              onClick={() => onView(t)}
                              type="button"
                            >
                              {t.name}
                            </button>
                            <p className="truncate font-mono text-[11px] text-muted-foreground">
                              {t.repo}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground text-sm">
                          <CategoryIcon id={t.cat} className="h-3.5 w-3.5" />
                          {catLabel(t.cat)}
                        </span>
                      </TableCell>
                      <TableCell className="hidden max-w-72 md:table-cell">
                        <p className="truncate text-muted-foreground text-sm">{t.desc}</p>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground text-sm md:table-cell">
                        {fmtDateShort(t.createdAt)}
                      </TableCell>
                      <TableCell className="hidden max-w-40 truncate text-muted-foreground text-sm lg:table-cell">
                        {t.submitter ?? "anonymous"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">In queue</Badge>
                      </TableCell>
                      <TableCell className="pr-6">
                        <div
                          className="flex items-center justify-end gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            aria-label={`View ${t.name} submission`}
                            className="size-8 text-muted-foreground hover:text-foreground"
                            disabled={anyBusy}
                            onClick={() => onView(t)}
                            size="icon"
                            variant="ghost"
                          >
                            <EyeIcon className="size-3.5" />
                          </Button>
                          <Button
                            aria-label={
                              feature
                                ? `Don't feature ${t.name} on approval`
                                : `Also feature ${t.name} on approval`
                            }
                            aria-pressed={feature}
                            className={cn(
                              "size-8",
                              feature && "border-primary/40 bg-accent-soft text-accent hover:bg-accent-soft",
                            )}
                            disabled={anyBusy}
                            onClick={() => onToggleFeatureDraft(t.id)}
                            size="icon"
                            variant="outline"
                          >
                            <StarIcon
                              className={cn("size-3.5", feature && "fill-current")}
                            />
                          </Button>
                          <Button
                            aria-label={`Approve ${t.name}${feature ? " and feature it" : ""}`}
                            className="h-8 bg-primary px-2.5 text-primary-foreground hover:bg-primary/90"
                            disabled={anyBusy}
                            onClick={() => onApprove(t.id, feature)}
                            size="sm"
                          >
                            {rowBusy === "approve" ? (
                              <Loader2Icon className="size-3.5 animate-spin" />
                            ) : (
                              <CheckIcon className="size-3.5" />
                            )}
                            {rowBusy === "approve"
                              ? "Approving…"
                              : feature
                                ? "Approve & feature"
                                : "Approve"}
                          </Button>
                          <Button
                            aria-label={`Remove ${t.name}`}
                            className="size-8 text-muted-foreground hover:text-foreground"
                            disabled={anyBusy}
                            onClick={() => onRemove(t.id)}
                            size="icon"
                            variant="ghost"
                          >
                            {rowBusy === "reject" ? (
                              <Loader2Icon className="size-3.5 animate-spin" />
                            ) : (
                              <Trash2Icon className="size-3.5" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        {tools.length > 0 && (
          <div className="flex items-center justify-between border-t px-6 py-3">
            <p className="text-xs text-muted-foreground">
              Click a tool name (or the eye icon) to inspect the full submission before deciding.
            </p>
            <Button asChild size="sm" variant="ghost">
              <button onClick={() => onView(tools[0])} type="button">
                Review next
                <ArrowRightIcon />
              </button>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
