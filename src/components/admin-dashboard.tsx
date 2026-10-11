"use client";

/* ------------------------------------------------------------------ */
/*  AIStore Admin — module-based console.                              */
/*  Overview  = traffic analytics + summaries of every other module,   */
/*  Review / Catalog / Wanted / Blog / Ads = standalone wide modules.  */
/* ------------------------------------------------------------------ */

import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangleIcon } from "lucide-react";
import {
  fetchAllAds,
  fetchAnalytics,
  fetchPosts,
  fetchTools,
  fetchWants,
  featureTool,
  moderateTool,
  type ApiTool,
  type ToolsPage,
} from "@/lib/aitools/api";
import { catLabel, fmtK, type Tool, type ViewId } from "@/lib/aitools/data";
import { useTools } from "@/components/aitools/tools-provider";
import { AppShell, scrollToSection } from "@/components/app-shell";
import type { AdminModule } from "@/components/app-shared";
import { DashboardStats, statIcons, type AdminStat } from "@/components/stats";
import { CatalogGrowthChart, type CatalogGrowthRow } from "@/components/conversation-volume-chart";
import { CategoryShareChart, type CategoryShareDatum } from "@/components/channel-breakdown-chart";
import { ReviewQueueTable } from "@/components/recent-conversations";
import { FeaturedPicks } from "@/components/team-on-duty";
import { ModerationActivity } from "@/components/support-activity";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { BlogManager } from "@/components/blog-manager";
import { WantsManager } from "@/components/wants-manager";
import { CatalogManager } from "@/components/catalog-manager";
import { AdsManager } from "@/components/ads-manager";
import { TrafficCard } from "@/components/traffic-chart";
import { TopPagesCard } from "@/components/top-pages";
import { ModuleSummaries } from "@/components/module-summary";
import { SubmissionDialog } from "@/components/submission-view";

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
    logoUrl: t.logoUrl ?? null,
    screenshotUrl: t.screenshotUrl ?? null,
    headerUrl: t.headerUrl ?? null,
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
  const { tools } = useTools();

  /* ------------------------------- module nav ------------------------------- */
  const [module, setModule] = useState<AdminModule>("overview");
  const openModule = useCallback((next: AdminModule, section?: string) => {
    setModule(next);
    if (section) {
      /* wait for the module to render, then scroll inside the admin container */
      window.setTimeout(() => scrollToSection(section), 60);
    } else {
      document.getElementById("admin-scroll")?.scrollTo({ top: 0 });
    }
  }, []);

  /* ---------------------------- moderation state ---------------------------- */
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [featureBusyId, setFeatureBusyId] = useState<string | null>(null);
  const [featureDrafts, setFeatureDrafts] = useState<Record<string, boolean>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);

  const pendingQuery = useQuery({
    queryKey: ["tools", "pending"],
    queryFn: () => fetchTools({ status: "pending", limit: 999, sort: "newest" }),
    refetchInterval: 20_000,
  });
  const pendingRows: ApiTool[] = pendingQuery.data?.tools ?? [];
  const viewing = useMemo(
    () => pendingRows.find((t) => t.id === viewingId) ?? null,
    [pendingRows, viewingId],
  );

  /* ----------------------- summaries for the overview ----------------------- */
  const wantsQuery = useQuery({
    queryKey: ["wants", "admin"],
    queryFn: () => fetchWants("votes"),
    staleTime: 15_000,
  });
  const postsQuery = useQuery({
    queryKey: ["posts", "admin"],
    queryFn: () => fetchPosts({ all: true }),
    staleTime: 15_000,
  });
  const adsQuery = useQuery({
    queryKey: ["ads", "all"],
    queryFn: fetchAllAds,
    staleTime: 15_000,
  });

  /* 14-day traffic for the KPI stats — same cache as the Traffic card */
  const analytics14 = useQuery({
    queryKey: ["analytics", 14],
    queryFn: () => fetchAnalytics(14),
    staleTime: 30_000,
  });
  const trafficViews = analytics14.data?.totalViews ?? 0;
  const trafficVisitors = analytics14.data?.uniqueVisitors ?? 0;

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
        label: "Visitors (14d)",
        value: fmtK(trafficVisitors),
        footnote: "unique sessions",
        icon: statIcons.visitors,
      },
      {
        label: "Pageviews (14d)",
        value: fmtK(trafficViews),
        footnote: "public pages",
        icon: statIcons.views,
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
  }, [approved, pendingQuery.data, pendingRows.length, trafficVisitors, trafficViews]);

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
      if (viewingId === id) setViewingId(null);
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
      if (viewingId === id) setViewingId(null);
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

  const empty = tools.length === 0;

  const reviewModule = (
    <>
      <ReviewQueueTable
        busy={pendingAction}
        featureBusyId={featureBusyId}
        featureDrafts={featureDrafts}
        onApprove={(id, featured) => void approve(id, featured)}
        onRemove={(id) => void remove(id)}
        onToggleFeatureDraft={(id) =>
          setFeatureDrafts((d) => ({ ...d, [id]: !(d[id] ?? false) }))
        }
        onView={(t) => setViewingId(t.id)}
        tools={pendingRows}
      />
      <SubmissionDialog
        busy={pendingAction}
        featureDraft={viewing ? (featureDrafts[viewing.id] ?? false) : false}
        onApprove={(id, featured) => void approve(id, featured)}
        onClose={() => setViewingId(null)}
        onRemove={(id) => void remove(id)}
        onToggleFeatureDraft={() =>
          viewing &&
          setFeatureDrafts((d) => ({ ...d, [viewing.id]: !(d[viewing.id] ?? false) }))
        }
        tool={viewing}
      />
    </>
  );

  return (
    <AppShell module={module} onModule={openModule} onNavigate={onNavigate} pendingCount={pendingRows.length}>
      {actionError && (
        <p
          className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          <AlertTriangleIcon className="size-4 shrink-0" />
          {actionError}
        </p>
      )}

      {module === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" id="admin-top">
            {empty ? <DashboardSkeleton /> : <DashboardStats stats={stats} />}
          </div>

          {/* analytics: users / pages */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <TrafficCard className="lg:col-span-2" />
            <TopPagesCard days={14} />
          </div>

          {/* summary of the other modules */}
          <ModuleSummaries
            data={{
              pending: pendingQuery.data ? pendingQuery.data.total : pendingRows.length,
              wantsOpen: (wantsQuery.data?.wants ?? []).filter((w) => w.status === "open").length,
              postsPublished: (postsQuery.data?.posts ?? []).filter((p) => p.status === "published")
                .length,
              adsActive: (adsQuery.data?.ads ?? []).filter((a) => a.active).length,
              adImpressions: (adsQuery.data?.ads ?? []).reduce((acc, a) => acc + a.impressions, 0),
              adClicks: (adsQuery.data?.ads ?? []).reduce((acc, a) => acc + a.clicks, 0),
            }}
            onOpenModule={(m) => openModule(m)}
          />

          {/* catalog trends + daily moderation surface */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <CatalogGrowthChart className="xl:col-span-2" data={growthData} />
            <CategoryShareChart data={shareData} />
            <FeaturedPicks
              className="scroll-mt-20"
              featureBusyId={featureBusyId}
              id="admin-featured"
              onToggleFeatured={(id, f) => void toggleFeatured(id, f)}
              tools={approved}
            />
          </div>
          <ModerationActivity
            className="scroll-mt-20"
            id="admin-activity"
            onViewCatalog={() => openModule("catalog")}
            tools={recentAdditions}
          />
        </div>
      )}

      {module === "review" && reviewModule}
      {module === "catalog" && <CatalogManager />}
      {module === "wants" && <WantsManager />}
      {module === "blog" && <BlogManager />}
      {module === "ads" && <AdsManager />}
    </AppShell>
  );
}
