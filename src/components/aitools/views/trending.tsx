"use client";

import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { trendingTools, matchTool, PLATFORM_LABEL, type Tool } from "@/lib/aitools/data";
import type { Platform } from "@/lib/aitools/data";
import { fetchTools } from "@/lib/aitools/api";
import { useTools, apiToolToTool } from "../tools-provider";
import { useDebounced } from "../use-debounced";
import { CountRow, FilterBar, ToolCard } from "../browse-parts";

export function Trending({ onOpenTool }: { onOpenTool: (t: Tool) => void }) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [platform, setPlatform] = useState("all");
  const [selfHosted, setSelfHosted] = useState(false);
  const [sourceAvailable, setSourceAvailable] = useState(false);
  const [featured, setFeatured] = useState(false);
  const [sort, setSort] = useState("momentum");

  const { tools: liveTools, getTool } = useTools();
  const debouncedQ = useDebounced(q, 250);

  const onFilters = (v: string) => {
    if (v === "selfhosted") setSelfHosted((s) => !s);
    if (v === "sourceavail") setSourceAvailable((s) => !s);
    if (v === "featured") setFeatured((f) => !f);
  };

  /* server-driven listing; previous data stays on screen while switching filters */
  const query = useQuery({
    queryKey: [
      "tools",
      "trending",
      { q: debouncedQ, category, platform, selfHosted, sourceAvailable, featured, sort },
    ],
    queryFn: () =>
      fetchTools({
        q: debouncedQ || undefined,
        cat: category ?? undefined,
        platform: platform !== "all" ? platform : undefined,
        selfHosted: selfHosted || undefined,
        sourceAvailable: sourceAvailable || undefined,
        featured: featured || undefined,
        trending: true,
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
      let list = trendingTools(liveTools);
      if (category) list = list.filter((t) => t.cat === category);
      if (platform !== "all") list = list.filter((t) => t.platforms.includes(platform as Platform));
      if (selfHosted) list = list.filter((t) => t.selfHosted);
      if (sourceAvailable) list = list.filter((t) => t.sourceAvailable);
      if (featured) list = list.filter((t) => t.featured);
      list = list.filter((t) => matchTool(t, q));
      if (sort === "stars") list = [...list].sort((a, b) => b.stars - a.stars);
      if (sort === "votes") list = [...list].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0));
      if (sort === "newest") list = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      if (sort === "name") list = [...list].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
      /* default: momentum (already sorted by weekly gain) */
      return list;
    }
    return [];
  }, [page, isError, liveTools, getTool, category, platform, selfHosted, sourceAvailable, featured, q, sort]);

  const total = page ? page.total : isError ? results.length : 0;

  return (
    <div className="mx-auto max-w-6xl px-5 pb-24">
      <header className="pb-8 pt-14">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-faint">GitHub Trending</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-ink">Trending this week</h1>
        <p className="mt-2 text-[15px] text-mute">
          Real momentum from GitHub's weekly Trending page. Snapshot Oct 5, 2026.
        </p>
      </header>

      {/* the shared FilterBar's dropdown cluster can't wrap by itself; let it
          wrap on narrow screens so a long sort label never overflows the page */}
      <div className="[&>div>div:first-child>div:last-child]:flex-wrap">
        <FilterBar
          q={q}
          onQ={setQ}
          category={category}
          onCategory={setCategory}
          platform={platform}
          onPlatform={setPlatform}
          selfHosted={selfHosted}
          onSelfHosted={setSelfHosted}
          sourceAvailable={sourceAvailable}
          onSourceAvailable={setSourceAvailable}
          featured={featured}
          onFeatured={setFeatured}
          sort={sort}
          onSort={setSort}
          sortOptions={[
            { value: "momentum", label: "Momentum" },
            { value: "votes", label: "Most upvoted" },
            { value: "stars", label: "Most stars" },
            { value: "newest", label: "Newest" },
            { value: "name", label: "Name (A–Z)" },
          ]}
          onFilters={onFilters}
        />
      </div>

      <div className="mt-6">
        <CountRow count={total} selfHosted={selfHosted} onToggleSelfHosted={() => setSelfHosted((s) => !s)} />
      </div>

      {!page && !isError ? (
        <div className="mt-10 font-mono text-sm text-faint">Loading apps…</div>
      ) : results.length > 0 ? (
        <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-2 xl:grid-cols-3">
          {results.map((t) => (
            <ToolCard key={t.id} tool={t} showWeekly onClick={() => onOpenTool(t)} />
          ))}
        </div>
      ) : (
        <EmptyState />
      )}

      <p className="mt-12 border-t border-line pt-6 text-xs text-faint">
        Stars from GitHub · Oct 5, 2026. Comparisons describe overlapping use cases, not feature parity. Platforms shown:{" "}
        {Object.values(PLATFORM_LABEL).slice(0, 3).join(", ")} and more.
      </p>
    </div>
  );
}

export function EmptyState() {
  return (
    <div className="mt-10 grid place-items-center rounded-xl border border-dashed border-line px-6 py-16 text-center">
      <p className="text-sm text-mute">Nothing matches those filters.</p>
      <p className="mt-1 text-xs text-faint">Try clearing the search or picking another category.</p>
    </div>
  );
}
