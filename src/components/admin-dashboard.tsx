"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangleIcon } from "lucide-react";
import {
  fetchTools,
  featureTool,
  moderateTool,
  type ApiTool,
  type ToolsPage,
} from "@/lib/aitools/api";
import { CATEGORIES, catLabel, fmtK, type Tool, type ViewId } from "@/lib/aitools/data";
import { useTools } from "@/components/aitools/tools-provider";
import { AppShell } from "@/components/app-shell";
import { DashboardStats, statIcons, type AdminStat } from "@/components/stats";
import { CatalogGrowthChart, type CatalogGrowthRow } from "@/components/conversation-volume-chart";
import { CategoryShareChart, type CategoryShareDatum } from "@/components/channel-breakdown-chart";
import { MonthlyAdditionsChart, type MonthlyAdditionsRow } from "@/components/csat-responses-chart";
import { CategoryStarsChart, type CategoryStarsRow } from "@/components/first-reply-time-chart";
import { ReviewQueueTable } from "@/components/recent-conversations";
import { FeaturedPicks } from "@/components/team-on-duty";
import { ModerationActivity } from "@/components/support-activity";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";

type Action = "approve" | "reject";
type PendingAction = { id: string; action: Action } | null;

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const PIE_FILLS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
];
/* the "everything else" slice stays neutral so no accent dominates */
const PIE_OTHER_FILL = "var(--color-line2)";

/** Provider Tool (optional live fields) → strict ApiTool for the widgets. */
function toApiTool(t: Tool): ApiTool {
  return {
    id: t.id,
    name: t.name,
    repo: t.repo,
    desc: t.desc,
    replaces: t.replaces,
    cat: t.cat,
    stars: t.stars,
    platforms: t.platforms,
    selfHosted: Boolean(t.selfHosted),
    sourceAvailable: Boolean(t.sourceAvailable),
    weeklyGain: t.weeklyGain ?? null,
    createdAt: t.createdAt,
    emoji: t.emoji,
    glyph: t.glyph ?? null,
    votes: t.votes ?? 0,
    status: t.status ?? "curated",
    submitter: t.submitter ?? null,
    featured: Boolean(t.featured),
  };
}

function monthKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "1970-01";
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return `${MONTHS[m - 1]} ${String(y).slice(2)}`;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function AdminDashboard({ onNavigate }: { onNavigate: (v: ViewId) => void }) {
  const queryClient = useQueryClient();
  const { tools, loading } = useTools();

  /* ---------------------------- moderation state ---------------------------- */
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [featureBusyId, setFeatureBusyId] = useState<string | null>(null);
  const [featureDrafts, setFeatureDrafts] = useState<Record<string, boolean>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  const pendingQuery = useQuery({
    queryKey: ["tools", "pending"],
    queryFn: () => fetchTools({ status: "pending", limit: 999, sort: "newest" }),
    refetchInterval: 20_000,
  });
  const pendingRows: ApiTool[] = pendingQuery.data?.tools ?? [];

  /* ------------------------------ derived data ------------------------------ */
  const approved = useMemo(() => {
    const list = tools.filter((t) => t.status !== "pending").map(toApiTool);
    return list.sort(
      (a, b) =>
        Number(b.featured) - Number(a.featured) || b.stars - a.stars,
    );
  }, [tools]);

  const stats: AdminStat[] = useMemo(() => {
    const votesTotal = approved.reduce((acc, t) => acc + t.votes, 0);
    const featuredCount = approved.filter((t) => t.featured).length;
    const pendingCount = pendingQuery.data ? pendingQuery.data.total : pendingRows.length;
    return [
      {
        label: "Tools live",
        value: String(approved.length),
        footnote: "curated + community",
        icon: statIcons.tools,
      },
      {
        label: "Pending review",
        value: String(pendingCount),
        footnote: "awaiting moderation",
        icon: statIcons.pending,
        tone: pendingCount > 0 ? "warn" : "default",
      },
      {
        label: "Community votes",
        value: fmtK(votesTotal),
        footnote: "across the catalog",
        icon: statIcons.votes,
      },
      {
        label: "Featured picks",
        value: String(featuredCount),
        footnote: "editors' badges live",
        icon: statIcons.featured,
      },
    ];
  }, [approved, pendingQuery.data, pendingRows.length]);

  const growthData: CatalogGrowthRow[] = useMemo(() => {
    const perMonth = new Map<string, number>();
    for (const t of approved) {
      const k = monthKey(t.createdAt);
      perMonth.set(k, (perMonth.get(k) ?? 0) + 1);
    }
    const keys = [...perMonth.keys()].sort();
    if (keys.length === 0) return [];
    const [startY, startM] = keys[0].split("-").map(Number);
    const [endY, endM] = keys[keys.length - 1].split("-").map(Number);
    const rows: CatalogGrowthRow[] = [];
    let running = 0;
    let y = startY;
    let m = startM;
    /* cap at 240 months as a safety valve */
    for (let i = 0; i < 240 && (y < endY || (y === endY && m <= endM)); i++) {
      const k = `${y}-${String(m).padStart(2, "0")}`;
      running += perMonth.get(k) ?? 0;
      rows.push({ month: monthLabel(k), total: running });
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
    return rows;
  }, [approved]);

  const shareData: CategoryShareDatum[] = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of approved) counts.set(t.cat, (counts.get(t.cat) ?? 0) + 1);
    const total = approved.length || 1;
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const rest = total - top.reduce((acc, [, c]) => acc + c, 0);
    const rows: CategoryShareDatum[] = top.map(([cat, count], i) => ({
      cat,
      label: catLabel(cat),
      share: Math.round((count / total) * 100),
      fill: PIE_FILLS[i],
    }));
    if (rest > 0) {
      rows.push({
        cat: "other",
        label: "Other",
        share: Math.round((rest / total) * 100),
        fill: PIE_OTHER_FILL,
      });
    }
    return rows;
  }, [approved]);

  const additionsData: MonthlyAdditionsRow[] = useMemo(() => {
    const now = new Date();
    const buckets: MonthlyAdditionsRow[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      buckets.push({ month: MONTHS[d.getUTCMonth()], community: 0, curated: 0 });
    }
    const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
    /* numeric month distance from the window start — never compare date strings */
    const keyOf = (iso: string) => {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return null;
      const months =
        (d.getUTCFullYear() - first.getUTCFullYear()) * 12 +
        (d.getUTCMonth() - first.getUTCMonth());
      return months >= 0 && months <= 11 ? months : null;
    };
    for (const t of approved) {
      const idx = keyOf(t.createdAt);
      if (idx === null) continue;
      if (t.status === "community") buckets[idx].community += 1;
      else buckets[idx].curated += 1;
    }
    return buckets;
  }, [approved]);

  const starsData: CategoryStarsRow[] = useMemo(() => {
    const byCat = new Map<string, number[]>();
    for (const t of approved) {
      const arr = byCat.get(t.cat) ?? [];
      arr.push(t.stars);
      byCat.set(t.cat, arr);
    }
    return [...byCat.entries()]
      .map(([cat, arr]) => ({
        cat,
        label: catLabel(cat),
        median: median(arr),
      }))
      .sort((a, b) => b.median - a.median)
      .slice(0, 8);
  }, [approved]);

  /* ------------------------------- moderation ------------------------------- */
  const approve = async (id: string, featured: boolean) => {
    if (pendingAction) return;
    setActionError(null);
    setPendingAction({ id, action: "approve" });
    try {
      await moderateTool(id, "approve", { featured });
      /* optimistic removal — the row leaves the queue immediately */
      queryClient.setQueryData<ToolsPage>(["tools", "pending"], (old) =>
        old
          ? {
              ...old,
              tools: old.tools.filter((t) => t.id !== id),
              total: Math.max(0, old.total - 1),
            }
          : old,
      );
      /* approved tools must show up in every public list */
      void queryClient.invalidateQueries({ queryKey: ["tools", "all"] });
    } catch {
      setActionError("Couldn't approve the submission. Please try again.");
    } finally {
      setPendingAction(null);
    }
  };

  const remove = async (id: string) => {
    if (pendingAction) return;
    setActionError(null);
    setPendingAction({ id, action: "reject" });
    try {
      await moderateTool(id, "reject");
      queryClient.setQueryData<ToolsPage>(["tools", "pending"], (old) =>
        old
          ? {
              ...old,
              tools: old.tools.filter((t) => t.id !== id),
              total: Math.max(0, old.total - 1),
            }
          : old,
      );
    } catch {
      setActionError("Couldn't remove the submission. Please try again.");
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

  /* ------------------------------ recent activity ----------------------------- */
  const recentAdditions = useMemo(
    () =>
      [...approved]
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .slice(0, 4),
    [approved],
  );

  const empty = !loading && tools.length === 0;

  return (
    <AppShell onNavigate={onNavigate} pendingCount={pendingRows.length}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" id="admin-top">
        {empty ? <DashboardSkeleton /> : <DashboardStats stats={stats} />}
        {empty ? null : (
          <>
            <CatalogGrowthChart data={growthData} />
            <CategoryShareChart data={shareData} />
            <MonthlyAdditionsChart data={additionsData} />
            <CategoryStarsChart data={starsData} />
            <ReviewQueueTable
              busy={pendingAction}
              className="scroll-mt-20"
              featureBusyId={featureBusyId}
              featureDrafts={featureDrafts}
              id="admin-queue"
              onApprove={(id, featured) => void approve(id, featured)}
              onRemove={(id) => void remove(id)}
              onToggleFeatureDraft={(id) =>
                setFeatureDrafts((d) => ({ ...d, [id]: !(d[id] ?? false) }))
              }
              onViewCatalog={() => onNavigate("browse")}
              tools={pendingRows}
            />
            <FeaturedPicks
              className="scroll-mt-20"
              id="admin-featured"
              featureBusyId={featureBusyId}
              onToggleFeatured={(id, f) => void toggleFeatured(id, f)}
              tools={approved}
            />
            <ModerationActivity
              className="scroll-mt-20"
              id="admin-activity"
              onViewCatalog={() => onNavigate("browse")}
              tools={recentAdditions}
            />
          </>
        )}
      </div>
      {actionError && (
        <p
          className="mt-2 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          <AlertTriangleIcon className="size-4 shrink-0" />
          {actionError}
        </p>
      )}
    </AppShell>
  );
}
