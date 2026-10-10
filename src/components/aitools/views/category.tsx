"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { matchTool, catById, countByCat, type Tool, type Platform } from "@/lib/aitools/data";
import { fetchTools } from "@/lib/aitools/api";
import { useTools, apiToolToTool } from "../tools-provider";
import { useDebounced } from "../use-debounced";
import { CountRow, FilterBar, ToolCard } from "../browse-parts";
import { EmptyState } from "./trending";

const PAGE_SIZE = 24;

export function CategoryView({
  catId,
  onNavigate,
  onOpenTool,
  onOpenCategory,
}: {
  catId: string;
  onNavigate: (v: "categories" | "browse") => void;
  onOpenTool: (t: Tool) => void;
  onOpenCategory?: (catId: string) => void;
}) {
  const [q, setQ] = useState("");
  const [platform, setPlatform] = useState("all");
  const [selfHosted, setSelfHosted] = useState(false);
  const [sourceAvailable, setSourceAvailable] = useState(false);
  const [sort, setSort] = useState("momentum");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const { tools: liveTools, getTool } = useTools();
  const debouncedQ = useDebounced(q, 250);

  const cat = catById(catId);

  /* resetting the page window whenever filters change (adjust-during-render) */
  const filterKey = `${q}|${platform}|${selfHosted}|${sourceAvailable}|${sort}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey);
    setVisible(PAGE_SIZE);
  }

  const onFilters = (v: string) => {
    if (v === "selfhosted") setSelfHosted((s) => !s);
    if (v === "sourceavail") setSourceAvailable((s) => !s);
  };

  /* server-driven listing; previous data stays on screen while switching filters */
  const query = useQuery({
    queryKey: [
      "tools",
      "category",
      catId,
      { q: debouncedQ, platform, selfHosted, sourceAvailable, sort },
    ],
    queryFn: () =>
      fetchTools({
        cat: catId,
        q: debouncedQ || undefined,
        platform: platform !== "all" ? platform : undefined,
        selfHosted: selfHosted || undefined,
        sourceAvailable: sourceAvailable || undefined,
        sort,
        limit: 999,
      }),
    placeholderData: keepPreviousData,
  });

  const page = query.data;
  const isError = query.isError;

  const results = useMemo<Tool[]>(() => {
    if (page) return page.tools.map((a) => getTool(a.id) ?? apiToolToTool(a));
    /* graceful fallback: if the API is unreachable, filter the live/static list client-side */
    if (isError) {
      let list = liveTools.filter((t) => t.cat === catId);
      if (platform !== "all") list = list.filter((t) => t.platforms.includes(platform as Platform));
      if (selfHosted) list = list.filter((t) => t.selfHosted);
      if (sourceAvailable) list = list.filter((t) => t.sourceAvailable);
      list = list.filter((t) => matchTool(t, q));
      if (sort === "newest") list = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      if (sort === "stars") list = [...list].sort((a, b) => b.stars - a.stars);
      if (sort === "votes") list = [...list].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0));
      if (sort === "momentum")
        list = [...list].sort((a, b) => (b.weeklyGain ?? -1) - (a.weeklyGain ?? -1));
      return list;
    }
    return [];
  }, [page, isError, liveTools, getTool, catId, platform, selfHosted, sourceAvailable, q, sort]);

  const total = page ? page.total : isError ? results.length : 0;
  const shown = results.slice(0, visible);
  /* live count of every app in this category (curated + community) */
  const catTotal = countByCat(catId, liveTools);

  /* chips inside the shared FilterBar: picking a category opens its page,
     "All apps" returns to the full catalog */
  const onChipCategory = (v: string | null) => {
    if (v === null) onNavigate("browse");
    else if (v !== catId) onOpenCategory?.(v);
  };

  return (
    <div className="mx-auto max-w-6xl px-5 pb-24">
      <header className="pb-8 pt-14">
        <button
          onClick={() => onNavigate("categories")}
          className="flex items-center gap-1.5 text-[13px] text-faint transition-colors hover:text-ink"
          aria-label="Back to all categories"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All categories
        </button>
        <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.22em] text-faint">{cat.short}</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-ink">{cat.label}</h1>
        <p className="mt-2 text-[15px] text-mute">
          {cat.blurb} · {catTotal} apps
        </p>
      </header>

      {/* the shared FilterBar's dropdown cluster can't wrap by itself; let it
          wrap on narrow screens so a long sort label never overflows the page */}
      <div className="[&>div>div:first-child>div:last-child]:flex-wrap">
        <FilterBar
          q={q}
          onQ={setQ}
          category={catId}
          onCategory={onChipCategory}
          platform={platform}
          onPlatform={setPlatform}
          selfHosted={selfHosted}
          onSelfHosted={setSelfHosted}
          sourceAvailable={sourceAvailable}
          onSourceAvailable={setSourceAvailable}
          sort={sort}
          onSort={setSort}
          sortOptions={[
            { value: "momentum", label: "Momentum" },
            { value: "votes", label: "Most upvoted" },
            { value: "stars", label: "Most stars" },
            { value: "newest", label: "Newest" },
          ]}
          onFilters={onFilters}
        />
      </div>

      <div className="mt-6">
        <CountRow count={total} selfHosted={selfHosted} onToggleSelfHosted={() => setSelfHosted((s) => !s)} />
      </div>

      {!page && !isError ? (
        <div className="mt-10 font-mono text-sm text-faint">Loading apps…</div>
      ) : shown.length > 0 ? (
        <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((t) => (
            <ToolCard key={t.id} tool={t} showWeekly onClick={() => onOpenTool(t)} />
          ))}
        </div>
      ) : (
        <EmptyState />
      )}

      {shown.length > 0 && (
        <div className="mt-14 text-center">
          <p className="text-[13px] text-faint">
            Showing {shown.length} of {total} apps
          </p>
          {visible < results.length && (
            <button
              onClick={() => setVisible((v) => v + PAGE_SIZE)}
              className="mx-auto mt-4 flex items-center gap-1.5 rounded-lg border border-line bg-card px-4 py-2.5 text-sm text-ink transition-colors hover:border-line2 hover:bg-elev"
            >
              Show more apps
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
