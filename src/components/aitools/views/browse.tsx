"use client";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { TOOLS, matchTool, type Tool, type Platform } from "@/lib/aitools/data";
import { CountRow, FilterBar, ToolCard } from "../browse-parts";
import { EmptyState } from "./trending";

const PAGE_SIZE = 24;

export function Browse({
  initialQuery = "",
  initialCategory = null,
  onOpenTool,
}: {
  initialQuery?: string;
  initialCategory?: string | null;
  onOpenTool: (t: Tool) => void;
}) {
  const [q, setQ] = useState(initialQuery);
  const [category, setCategory] = useState<string | null>(initialCategory);
  const [platform, setPlatform] = useState("all");
  const [selfHosted, setSelfHosted] = useState(false);
  const [sourceAvailable, setSourceAvailable] = useState(false);
  const [sort, setSort] = useState("newest");
  const [visible, setVisible] = useState(PAGE_SIZE);

  /* resetting the page window whenever filters change (adjust-during-render) */
  const filterKey = `${q}|${category}|${platform}|${selfHosted}|${sourceAvailable}|${sort}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey);
    setVisible(PAGE_SIZE);
  }

  const onFilters = (v: string) => {
    if (v === "selfhosted") setSelfHosted((s) => !s);
    if (v === "sourceavail") setSourceAvailable((s) => !s);
  };

  const results = useMemo(() => {
    let list = TOOLS;
    if (category) list = list.filter((t) => t.cat === category);
    if (platform !== "all") list = list.filter((t) => t.platforms.includes(platform as Platform));
    if (selfHosted) list = list.filter((t) => t.selfHosted);
    if (sourceAvailable) list = list.filter((t) => t.sourceAvailable);
    list = list.filter((t) => matchTool(t, q));
    if (sort === "newest") list = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (sort === "stars") list = [...list].sort((a, b) => b.stars - a.stars);
    if (sort === "momentum")
      list = [...list].sort((a, b) => (b.weeklyGain ?? -1) - (a.weeklyGain ?? -1));
    return list;
  }, [q, category, platform, selfHosted, sourceAvailable, sort]);

  const shown = results.slice(0, visible);

  return (
    <div className="mx-auto max-w-6xl px-5 pb-24">
      <header className="pb-8 pt-14">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-faint">Newest</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-ink">Newest projects</h1>
        <p className="mt-2 text-[15px] text-mute">Sorted by repository creation date.</p>
      </header>

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
        sort={sort}
        onSort={setSort}
        sortOptions={[
          { value: "newest", label: "Newest" },
          { value: "stars", label: "Most stars" },
          { value: "momentum", label: "Momentum" },
        ]}
        onFilters={onFilters}
      />

      <div className="mt-6">
        <CountRow count={results.length} selfHosted={selfHosted} onToggleSelfHosted={() => setSelfHosted((s) => !s)} />
      </div>

      {shown.length > 0 ? (
        <div className="mt-4 grid gap-x-8 gap-y-10 md:grid-cols-2 xl:grid-cols-3">
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
            Showing {shown.length} of {results.length} apps
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

      <p className="mt-12 border-t border-line pt-6 text-xs text-faint">
        Stars from GitHub · Oct 5, 2026. Repository age does not imply product maturity.
      </p>
    </div>
  );
}
