"use client";

import { useState } from "react";
import { Check, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { catById, type ViewId } from "@/lib/aitools/data";
import { fetchTools, moderateTool, type ApiTool, type ToolsPage } from "@/lib/aitools/api";
import { apiToolToTool } from "../tools-provider";
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
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["tools", "pending"],
    queryFn: () => fetchTools({ status: "pending", limit: 999, sort: "newest" }),
    refetchInterval: 20_000,
  });

  const rows: ApiTool[] = query.data?.tools ?? [];
  const count = query.data ? query.data.total : null;

  const moderate = async (id: string, action: Action) => {
    if (pendingAction) return;
    setActionError(null);
    setPendingAction({ id, action });
    try {
      await moderateTool(id, action);
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
              onApprove={() => void moderate(a.id, "approve")}
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
  onApprove: () => void;
  onRemove: () => void;
}) {
  const t = apiToolToTool(tool);
  const cat = catById(t.cat);

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
                <CategoryIcon id={cat.id} className="h-3 w-3" />
                {cat.label}
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
            onClick={onApprove}
            disabled={anyBusy}
            aria-label={`Approve ${t.name}`}
            className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-solid px-3.5 text-[13px] font-medium text-solidfg transition-colors hover:bg-solidhover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "approve" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            {busy === "approve" ? "Approving…" : "Approve"}
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
