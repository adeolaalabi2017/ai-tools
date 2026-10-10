"use client";

import { useMemo } from "react";
import { ArrowRight, Search, Star } from "lucide-react";
import {
  CATEGORIES,
  GOOD_STARTS,
  countByCat,
  fmtK,
  type Tool,
  type ViewId,
} from "@/lib/aitools/data";
import { useTools } from "../tools-provider";
import { CategoryIcon, SectionHeader, SourceBadge, ToolRow } from "../ui";

export function Categories({
  onNavigate,
  onOpenCategory,
  onOpenSearch,
  onOpenTool,
}: {
  onNavigate: (v: ViewId) => void;
  onOpenCategory: (cat: string) => void;
  onOpenSearch: () => void;
  onOpenTool: (t: Tool) => void;
}) {
  const { tools, votes } = useTools();
  const goodStarts = GOOD_STARTS(tools);

  /* aggregate GitHub stars + community votes per category, from live data */
  const catStats = useMemo(() => {
    const m = new Map<string, { stars: number; votes: number }>();
    for (const c of CATEGORIES) m.set(c.id, { stars: 0, votes: 0 });
    for (const t of tools) {
      const s = m.get(t.cat);
      if (!s) continue;
      s.stars += t.stars;
      s.votes += votes[t.id] ?? t.votes ?? 0;
    }
    return m;
  }, [tools, votes]);

  return (
    <div className="mx-auto max-w-6xl px-5 pb-24">
      {/* header */}
      <div className="flex flex-col justify-between gap-6 pb-10 pt-14 md:flex-row md:items-end">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-ink">Categories</h1>
          <p className="mt-2 text-[15px] text-mute">
            Every app in the collection, grouped by what it helps you do.
          </p>
        </div>
        <button
          onClick={onOpenSearch}
          className="flex h-11 w-full items-center gap-3 rounded-lg border border-line bg-card px-4 text-left transition-colors hover:border-line2 md:w-80"
        >
          <Search className="h-4 w-4 shrink-0 text-faint" />
          <span className="flex-1 truncate font-mono text-[13px] text-faint">Search open-source apps...</span>
          <span className="shrink-0 rounded-[5px] border border-line bg-elev px-1.5 py-0.5 font-mono text-[10px] text-faint">⌘K</span>
        </button>
      </div>

      {/* grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {CATEGORIES.map((c) => {
          const stats = catStats.get(c.id) ?? { stars: 0, votes: 0 };
          return (
            <button
              key={c.id}
              onClick={() => onOpenCategory(c.id)}
              className="group rounded-xl border border-line bg-card p-5 text-left transition-colors hover:border-line2 hover:bg-elev"
            >
              <div className="flex items-center gap-3">
                <CategoryIcon id={c.id} className="h-[18px] w-[18px] text-ink2" />
                <span className="text-[15px] font-semibold text-ink">{c.label}</span>
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-[13px] text-faint">
                {countByCat(c.id, tools)} apps
                <ArrowRight className="h-3.5 w-3.5 text-accent transition-transform group-hover:translate-x-0.5" />
              </p>
              <div className="mt-3.5 flex items-center gap-4 border-t border-line pt-3 font-mono text-xs">
                <span
                  className="flex items-center gap-1.5 text-faint transition-colors group-hover:text-ink2"
                  title={`${stats.stars.toLocaleString("en-US")} GitHub stars in ${c.label}`}
                >
                  <Star className="h-3 w-3" />
                  {fmtK(stats.stars)}
                  <span className="hidden sm:inline">stars</span>
                </span>
                <span
                  className="flex items-center gap-1.5 text-faint transition-colors group-hover:text-accent"
                  title={`${stats.votes.toLocaleString("en-US")} community votes in ${c.label}`}
                >
                  ▲ {stats.votes}
                  <span className="hidden sm:inline">{stats.votes === 1 ? "vote" : "votes"}</span>
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* good places to start */}
      <section className="pt-20">
        <SectionHeader
          title="Good places to start"
          action="All apps"
          onAction={() => onNavigate("browse")}
        />
        <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2 xl:grid-cols-3">
          {goodStarts.map((t) => (
            <ToolRow
              key={t.id}
              tool={t}
              badge={t.sourceAvailable ? <SourceBadge /> : undefined}
              onClick={() => onOpenTool(t)}
            />
          ))}
        </div>
      </section>

      {/* collection footnote */}
      <p className="border-t border-line pt-6 text-xs text-faint">
        {tools.length} apps tracked across {CATEGORIES.length} categories · Stars update weekly.
      </p>
    </div>
  );
}
