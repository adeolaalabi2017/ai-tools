"use client";

import { useMemo, useState } from "react";
import { Check, Loader2, RefreshCw, Star, Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { catLabel, fmtK, type ViewId } from "@/lib/aitools/data";
import { featureTool, fetchTools, moderateTool, type ApiTool, type ToolsPage } from "@/lib/aitools/api";
import { apiToolToTool, useTools } from "../tools-provider";
import { AppIcon, CategoryIcon, PlatformRow } from "../ui";

type Action = "approve" | "reject";
type PendingAction = { id: string; action: Action } | null;

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/* UTC-safe date formatting so DB timestamps never render as the adjacent day */
function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function AdminQueue({ onNavigate }: { onNavigate: (v: ViewId) => void }) {
  const queryClient = useQueryClient();
  const { tools } = useTools();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [featureBusyId, setFeatureBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["tools", "pending"],
    queryFn: () => fetchTools({ status: "pending", limit: 999, sort: "newest" }),
    refetchInterval: 20_000,
  });

  const rows: ApiTool[] = query.data?.tools ?? [];
  const count = query.data ? query.data.total : null;

  /* every approved tool, featured first — the moderator's editorial list */
  const editorial = useMemo(
    () =>
      tools
        .filter((t) => t.status !== "pending")
        .sort((a, b) => Number(b.featured ?? false) - Number(a.featured ?? false) || b.stars - a.stars),
    [tools],
  );
  const featuredCount = editorial.filter((t) => t.featured).length;

  const moderate = async (id: string, action: Action, featured?: boolean) => {
    if (pendingAction) return;
    setActionError(null);
    setPendingAction({ id, action });
    try {
      await moderateTool(id, action, action === "approve" ? { featured } : {});
      /* optimistic removal — the row leaves the queue immediately */
      queryClient.setQueryData<ToolsPage>(["tools", "pending"], (old) =>
        old
          ? { ...old, tools: old.tools.filter((t) => t.id !== id), total: Math.max(0, old.total - 1) }
          : old,
      );
      /* approved tools must show up in every public list */
      void queryClient.invalidateQueries({ queryKey: ["tools", "all"] });
    } catch {
      setActionError(
        action === "approve"
          ? "Couldn't approve the submission. Please try again."
          : "Couldn't remove the submission. Please try again.",
      );
    } finally {
      setPendingAction(null);
    }
  };

  const toggleFeatured = async (id: string, featured: boolean) => {
    if (featureBusyId) return;
    setActionError(null);
    setFeatureBusyId(id);
    const prev = queryClient.getQueryData<ToolsPage>(["tools", "all"]);
    /* optimistic flip so the toggle feels instant */
    queryClient.setQueryData<ToolsPage>(["tools", "all"], (old) =>
      old
        ? { ...old, tools: old.tools.map((t) => (t.id === id ? { ...t, featured } : t)) }
        : old,
    );
    try {
      await featureTool(id, featured);
      void queryClient.invalidateQueries({ queryKey: ["tools", "all"] });
    } catch {
      queryClient.setQueryData<ToolsPage>(["tools", "all"], prev);
      setActionError(
        featured
          ? "Couldn't feature the tool. Please try again."
          : "Couldn't remove the feature. Please try again.",
      );
    } finally {
      setFeatureBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-5 pb-24">
      <header className="pb-8 pt-14">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-faint">Moderation</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-ink">Review queue</h1>
        <p className="mt-2 text-[15px] text-mute">
          Community submissions awaiting editorial approval
          {count !== null ? (
            <span className="ml-2 font-mono text-[13px] text-faint">
              · {count} {count === 1 ? "submission" : "submissions"}
            </span>
          ) : null}
        </p>
      </header>

      {query.isError ? (
        <div className="mt-6 grid place-items-center rounded-xl border border-dashed border-line px-6 py-16 text-center">
          <p className="text-sm text-mute">Couldn't load the review queue.</p>
          <p className="mt-1 text-xs text-faint">Check your connection and try again.</p>
          <button
            onClick={() => void query.refetch()}
            className="mt-5 flex items-center gap-1.5 rounded-lg border border-line bg-card px-4 py-2.5 text-sm text-ink transition-colors hover:border-line2 hover:bg-elev"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      ) : !query.data ? (
        <div className="mt-10 font-mono text-sm text-faint">Loading queue…</div>
      ) : rows.length > 0 ? (
        <div className="space-y-3">
          {rows.map((a) => (
            <PendingRow
              key={a.id}
              tool={a}
              busy={pendingAction?.id === a.id ? pendingAction.action : null}
              anyBusy={pendingAction !== null}
              onApprove={(featured) => void moderate(a.id, "approve", featured)}
              onRemove={() => void moderate(a.id, "reject")}
            />
          ))}
        </div>
      ) : (
        <div className="mt-6 grid place-items-center rounded-xl border border-dashed border-line px-6 py-16 text-center">
          <p className="text-sm text-mute">Queue is clear.</p>
          <p className="mt-1 text-xs text-faint">Community submissions appear here for editorial review.</p>
          <button
            onClick={() => onNavigate("browse")}
            className="mt-5 rounded-lg border border-line bg-card px-4 py-2.5 text-sm text-ink transition-colors hover:border-line2 hover:bg-elev"
          >
            Browse all apps
          </button>
        </div>
      )}

      {actionError && (
        <p role="alert" className="mt-5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-500">
          {actionError}
        </p>
      )}

      {/* ------------------------- editorial picks manager ------------------------- */}
      <section className="mt-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-ink">Featured picks</h2>
            <p className="mt-1.5 text-sm text-mute">
              Toggle a tool to badge it as an editors&rsquo; pick across the directory.
            </p>
          </div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
            {featuredCount} featured
          </p>
        </div>

        <div className="thin-scroll mt-5 max-h-96 overflow-y-auto rounded-xl border border-line bg-card">
          {editorial.map((t, i) => (
            <div
              key={t.id}
              className={cn(
                "flex items-center gap-3.5 px-4 py-3",
                i > 0 && "border-t border-line",
                t.featured && "bg-accent-soft/40",
              )}
            >
              <AppIcon tool={t} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-medium text-ink">{t.name}</span>
                  <span className="hidden shrink-0 items-center gap-1 text-xs text-faint sm:flex">
                    <CategoryIcon id={t.cat} className="h-3 w-3" />
                    {catLabel(t.cat)}
                  </span>
                </div>
                <p className="mt-0.5 truncate font-mono text-[11px] text-faint">{t.repo}</p>
              </div>
              <span className="hidden shrink-0 items-center gap-1.5 font-mono text-xs text-faint md:flex">
                ★ {fmtK(t.stars)}
              </span>
              <button
                type="button"
                onClick={() => void toggleFeatured(t.id, !t.featured)}
                disabled={featureBusyId !== null}
                aria-pressed={Boolean(t.featured)}
                aria-label={
                  t.featured ? `Remove ${t.name} from featured picks` : `Feature ${t.name} as an editors' pick`
                }
                title={t.featured ? "Remove feature" : "Feature on AIStore"}
                className={cn(
                  "grid h-9 w-9 shrink-0 place-items-center rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                  t.featured
                    ? "border-accent/40 bg-accent-soft text-accent"
                    : "border-line text-mute hover:border-line2 hover:text-ink",
                )}
              >
                {featureBusyId === t.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Star className={cn("h-4 w-4", t.featured && "fill-current")} />
                )}
              </button>
            </div>
          ))}
          {editorial.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-mute">No approved tools yet.</p>
          )}
        </div>
        <p className="mt-3 text-xs text-faint">
          Featured tools carry the badge on cards and rows everywhere in the directory.
        </p>
      </section>
    </div>
  );
}

/* ------------------------------ pending row ------------------------------ */

function PendingRow({
  tool,
  busy,
  anyBusy,
  onApprove,
  onRemove,
}: {
  tool: ApiTool;
  busy: Action | null;
  anyBusy: boolean;
  onApprove: (featured: boolean) => void;
  onRemove: () => void;
}) {
  const t = apiToolToTool(tool);
  const cat = catLabel(t.cat);
  /* the editorial flag the moderator can flip before approving */
  const [feature, setFeature] = useState(false);

  return (
    <article className="rounded-xl border border-line bg-card p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex min-w-0 flex-1 items-start gap-3.5">
          <AppIcon tool={t} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h3 className="text-[15px] font-semibold text-ink">{t.name}</h3>
              <span className="font-mono text-xs text-faint">{t.repo}</span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-mute">{t.desc}</p>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs text-mute">
                <CategoryIcon id={t.cat} className="h-3 w-3" />
                {cat}
              </span>
              <PlatformRow platforms={t.platforms} />
            </div>
            <p className="mt-2.5 text-xs text-faint">
              Submitted by {t.submitter ?? "an anonymous reader"} · {fmtDate(t.createdAt)}
            </p>
          </div>
        </div>

        {/* stopPropagation-safe action cluster */}
        <div
          className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-stretch"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setFeature((f) => !f)}
            aria-pressed={feature}
            aria-label={feature ? `Don't feature ${t.name} on approval` : `Also feature ${t.name} on approval`}
            title={feature ? "Will be featured on approval" : "Feature on AIStore when approved"}
            disabled={anyBusy}
            className={cn(
              "grid h-9 w-9 place-items-center rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              feature
                ? "border-accent/40 bg-accent-soft text-accent"
                : "border-line text-mute hover:border-line2 hover:text-ink",
            )}
          >
            <Star className={cn("h-4 w-4", feature && "fill-current")} />
          </button>
          <button
            type="button"
            onClick={() => onApprove(feature)}
            disabled={anyBusy}
            aria-label={`Approve ${t.name}${feature ? " and feature it" : ""}`}
            className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-accent px-3.5 text-[13px] font-medium text-zinc-950 transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "approve" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            {busy === "approve" ? "Approving…" : feature ? "Approve & feature" : "Approve"}
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={anyBusy}
            aria-label={`Remove ${t.name}`}
            className={cn(
              "flex h-9 items-center justify-center gap-1.5 rounded-lg border border-line px-3.5 text-[13px] text-mute transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {busy === "reject" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            {busy === "reject" ? "Removing…" : "Remove"}
          </button>
        </div>
      </div>
    </article>
  );
}
